/**
 * Remote dictionary fallback — Free Dictionary API (Wiktionary) then dictionaryapi.dev.
 * Only called when static + WordNet miss. Circuit breaker shared with store.
 */

const FREE_DICT_URL = "https://api.freedictionaryapi.com/api/v1/entries/en/";
const LEGACY_DICT_URL = "https://api.dictionaryapi.dev/api/v2/entries/en/";
const FETCH_TIMEOUT_MS = 4000;

let failureStreak = 0;
let circuitOpenUntil = 0;
const CIRCUIT_THRESHOLD = 8;
const CIRCUIT_COOLDOWN_MS = 30_000;

const inflight = new Map();
let active = 0;
const MAX_CONCURRENT = 10;
const waitQueue = [];

function acquireSlot() {
  return new Promise((resolve) => {
    if (active < MAX_CONCURRENT) {
      active += 1;
      resolve();
      return;
    }
    waitQueue.push(resolve);
  });
}

function releaseSlot() {
  active = Math.max(0, active - 1);
  const next = waitQueue.shift();
  if (next) {
    active += 1;
    next();
  }
}

function recordFailure() {
  failureStreak += 1;
  if (failureStreak >= CIRCUIT_THRESHOLD) {
    circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
  }
}

function recordSuccess() {
  failureStreak = 0;
}

function parseFreeDict(data) {
  const definitions = [];
  let phonetic = "";

  for (const entry of data.entries || []) {
    if (!phonetic && entry.pronunciations?.[0]?.text) {
      phonetic = entry.pronunciations[0].text;
    }
    const pos = entry.partOfSpeech || "";
    for (const sense of entry.senses || []) {
      if (sense.definition) {
        definitions.push({
          partOfSpeech: pos,
          definition: sense.definition,
          example: sense.examples?.[0] || null,
        });
      }
      if (definitions.length >= 3) {
        return { definitions, phonetic };
      }
    }
  }
  return { definitions, phonetic };
}

function parseLegacyDict(data) {
  const definitions = [];
  const entry = Array.isArray(data) ? data[0] : null;
  if (!entry) {
    return { definitions: [], phonetic: "" };
  }
  const phonetic =
    entry.phonetic || entry.phonetics?.find((p) => p.text)?.text || "";

  for (const meaning of entry.meanings || []) {
    const pos = meaning.partOfSpeech || "";
    for (const def of meaning.definitions || []) {
      if (def.definition) {
        definitions.push({
          partOfSpeech: pos,
          definition: def.definition,
          example: def.example || null,
        });
      }
      if (definitions.length >= 3) {
        return { definitions, phonetic };
      }
    }
  }
  return { definitions, phonetic };
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeout);
    return response;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

async function tryFreeDictionary(word) {
  const response = await fetchWithTimeout(`${FREE_DICT_URL}${encodeURIComponent(word)}`);
  if (response.status === 404) {
    return { ok: false, error: "not_found" };
  }
  if (!response.ok) {
    return { ok: false, error: "fetch_failed" };
  }
  const data = await response.json();
  const { definitions, phonetic } = parseFreeDict(data);
  if (definitions.length === 0) {
    return { ok: false, error: "not_found" };
  }
  return { ok: true, definitions, phonetic, source: "wiktionary_api" };
}

async function tryLegacyDictionary(word) {
  const response = await fetchWithTimeout(`${LEGACY_DICT_URL}${encodeURIComponent(word)}`);
  if (response.status === 404) {
    return { ok: false, error: "not_found" };
  }
  if (!response.ok) {
    return { ok: false, error: "fetch_failed" };
  }
  const data = await response.json();
  const { definitions, phonetic } = parseLegacyDict(data);
  if (definitions.length === 0) {
    return { ok: false, error: "not_found" };
  }
  return { ok: true, definitions, phonetic, source: "dictionaryapi" };
}

async function fetchRemoteDictionary(word) {
  if (Date.now() < circuitOpenUntil) {
    return { ok: false, error: "dictionary_busy" };
  }

  await acquireSlot();
  try {
    try {
      const free = await tryFreeDictionary(word);
      if (free.ok) {
        recordSuccess();
        return free;
      }
      if (free.error === "fetch_failed") {
        throw new Error("free_dict_failed");
      }
    } catch {
      /* fall through to legacy */
    }

    try {
      const legacy = await tryLegacyDictionary(word);
      if (legacy.ok) {
        recordSuccess();
        return legacy;
      }
      if (legacy.error === "not_found") {
        recordSuccess();
        return legacy;
      }
      recordFailure();
      return legacy;
    } catch {
      recordFailure();
      return { ok: false, error: "fetch_failed" };
    }
  } finally {
    releaseSlot();
  }
}

export async function lookupRemote(word) {
  if (inflight.has(word)) {
    return inflight.get(word);
  }

  const promise = fetchRemoteDictionary(word);
  inflight.set(word, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(word);
  }
}

export function getRemoteDictStats() {
  return {
    circuitOpen: Date.now() < circuitOpenUntil,
    failureStreak,
    active,
    queue: waitQueue.length,
  };
}
