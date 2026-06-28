/**
 * Hindi / Devanagari glossary — curated terms + built Wiktionary index.
 *
 * Lookup order:
 *   1. data/glossary/hindi-terms.json (curated, newspaper/policy)
 *   2. data/glossary/hindi-index.json (built via npm run build:hindi)
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { normalizeLookupKey, isDevanagari } from "./normalize.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GLOSSARY_DIR = join(__dirname, "..", "..", "data", "glossary");
const CURATED_PATH = join(GLOSSARY_DIR, "hindi-terms.json");
const INDEX_PATH = join(GLOSSARY_DIR, "hindi-index.json");

let curatedMap = null;
let bulkIndex = null;
let loadError = null;

function loadCurated() {
  if (curatedMap) {
    return curatedMap;
  }
  curatedMap = new Map();
  if (!existsSync(CURATED_PATH)) {
    return curatedMap;
  }
  const data = JSON.parse(readFileSync(CURATED_PATH, "utf8"));
  for (const [key, entry] of Object.entries(data.terms || {})) {
    const payload = packCuratedEntry(key, entry);
    curatedMap.set(normalizeLookupKey(key), payload);
    if (entry.hindi) {
      curatedMap.set(entry.hindi, payload);
    }
    for (const alias of entry.aliases || []) {
      curatedMap.set(normalizeLookupKey(alias), payload);
    }
  }
  return curatedMap;
}

function packCuratedEntry(key, entry) {
  return {
    word: key,
    hindi: entry.hindi,
    transliteration: entry.transliteration || (isDevanagari(key) ? null : key),
    definition: entry.definition,
    partOfSpeech: entry.pos || "noun",
    usage: entry.usage || null,
    layer: "hindi_glossary",
    source: "curated",
  };
}

function loadBulkIndex() {
  if (bulkIndex || loadError === "missing_bulk") {
    return bulkIndex;
  }
  if (!existsSync(INDEX_PATH)) {
    loadError = "missing_bulk";
    return null;
  }
  try {
    bulkIndex = JSON.parse(readFileSync(INDEX_PATH, "utf8"));
    return bulkIndex;
  } catch (err) {
    loadError = err.message;
    return null;
  }
}

function unpackTuple(id, db) {
  const tuple = db.t[id];
  if (!tuple) {
    return null;
  }
  const [hindi, roman, pos, definition, source] = tuple;
  return {
    hindi,
    transliteration: roman || null,
    definition,
    partOfSpeech: pos || "noun",
    source: source || "wiktionary-hi",
  };
}

function lookupBulk(word) {
  const db = loadBulkIndex();
  if (!db) {
    return null;
  }

  const key = normalizeLookupKey(word);
  let id = resolveBulkId(db, key);

  if (id === undefined) {
    return null;
  }

  const entry = unpackTuple(id, db);
  if (!entry) {
    return null;
  }

  return {
    word: key,
    hindi: entry.hindi || (isDevanagari(key) ? key : null),
    transliteration: entry.transliteration || (isDevanagari(key) ? null : key),
    definition: entry.definition,
    partOfSpeech: entry.partOfSpeech,
    usage: null,
    layer: "hindi_wiktionary",
    source: entry.source,
  };
}

function resolveBulkId(db, key) {
  let id = db.h?.[key];
  if (id !== undefined) {
    return id;
  }
  id = db.r?.[key] ?? db.r?.[key.toLowerCase()];
  if (id !== undefined) {
    return id;
  }
  if (/^[a-z]{3,}$/.test(key)) {
    const variants = [key.replace(/aa/g, "a")];
    if (key.endsWith("a") && key.length > 3) {
      variants.push(key.slice(0, -1));
    }
    if (key.endsWith("i") && key.length > 3) {
      variants.push(key.slice(0, -1));
    }
    for (const v of variants) {
      id = db.r?.[v];
      if (id !== undefined) {
        return id;
      }
    }
  }
  return undefined;
}

export function lookupHindi(word) {
  const key = normalizeLookupKey(word);
  if (!key) {
    return null;
  }

  const curated = loadCurated().get(key);
  if (curated) {
    return { ...curated, word: key };
  }

  return lookupBulk(key);
}

export function getHindiStats() {
  const curated = loadCurated();
  const bulk = loadBulkIndex();
  return {
    curatedLoaded: curated.size > 0,
    curatedKeys: curated.size,
    bulkLoaded: !!bulk,
    bulkError: loadError,
    bulkCounts: bulk?.c || null,
    bulkBuilt: bulk?.built || null,
    sources: bulk?.sources || ["curated-only"],
  };
}

export function enrichWithHindi(normalized, existingResult) {
  if (existingResult?.hindi) {
    return existingResult;
  }
  const hit = lookupHindi(normalized);
  if (!hit?.hindi) {
    return existingResult;
  }
  return {
    ...existingResult,
    hindi: hit.hindi,
    transliteration: hit.transliteration,
    hindiUsage: hit.usage,
  };
}
