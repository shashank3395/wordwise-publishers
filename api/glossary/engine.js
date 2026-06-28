/**
 * Layered glossary lookup engine.
 *
 * Order (fastest → slowest):
 *   1. Result cache (Map, context-hash key)
 *   2. Curated acronym glossary (policy moat)
 *   3. Policy glossary with context rules
 *   4. Static index — VocabPro editorial (~6k) + acronyms + idioms
 *   5. WordNet — local, lazy (~140k words)
 *   6. Remote API — Wiktionary then dictionaryapi.dev
 */

import { createHash } from "crypto";
import { normalizeLookupKey } from "./normalize.js";
import { lookupCuratedAcronym, lookupPolicyWithContext, lookupPolicyDirect, getPolicyStats } from "./policy.js";
import { lookupHindi, getHindiStats, enrichWithHindi } from "./hindi.js";
import { lookupStatic } from "./static.js";
import { lookupWordNet, getWordNetStats } from "./wordnet.js";
import { lookupRemote, getRemoteDictStats } from "./remote.js";
import { fromStaticHit, fromDictHit, fromPolicyHit, fromAcronymHit, fromHindiHit } from "./result.js";
import { getStaticIndexStats } from "./static.js";

const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX = 10_000;

const lookupCache = new Map();

function hashContext(context) {
  if (!context) {
    return "";
  }
  return createHash("md5").update(context.slice(0, 200)).digest("hex").slice(0, 8);
}

function getCached(cacheKey) {
  const hit = lookupCache.get(cacheKey);
  if (hit && Date.now() - hit.timestamp < CACHE_TTL_MS) {
    return hit.result;
  }
  return null;
}

function setCache(cacheKey, result) {
  if (lookupCache.size >= CACHE_MAX) {
    const oldest = lookupCache.keys().next().value;
    lookupCache.delete(oldest);
  }
  lookupCache.set(cacheKey, { result, timestamp: Date.now() });
}

export async function lookupWord(word, context = "") {
  const normalized = normalizeLookupKey(word);
  const cacheKey = `${normalized}::${hashContext(context)}`;

  const cached = getCached(cacheKey);
  if (cached) {
    return cached;
  }

  const acronymHit = lookupCuratedAcronym(normalized, context);
  if (acronymHit) {
    const result = fromAcronymHit(acronymHit);
    setCache(cacheKey, result);
    return result;
  }

  const policyDirect = lookupPolicyDirect(normalized);
  if (policyDirect) {
    let result = fromPolicyHit({ ...policyDirect, word: normalized });
    result = enrichWithHindi(normalized, result);
    setCache(cacheKey, result);
    return result;
  }

  const policyHit = lookupPolicyWithContext(normalized, context);
  if (policyHit) {
    let result = fromPolicyHit({ ...policyHit, word: normalized });
    result = enrichWithHindi(normalized, result);
    setCache(cacheKey, result);
    return result;
  }

  const hindiHit = lookupHindi(normalized);
  if (hindiHit) {
    const result = fromHindiHit(hindiHit);
    setCache(cacheKey, result);
    return result;
  }

  const staticHit = lookupStatic(normalized);
  if (staticHit) {
    let result = fromStaticHit(normalized, staticHit, context);
    result = enrichWithHindi(normalized, result);
    setCache(cacheKey, result);
    return result;
  }

  const wordnetHit = await lookupWordNet(normalized);
  if (wordnetHit) {
    let result = fromDictHit(normalized, wordnetHit, context, "wordnet");
    result = enrichWithHindi(normalized, result);
    setCache(cacheKey, result);
    return result;
  }

  const remoteHit = await lookupRemote(normalized);
  if (!remoteHit.ok) {
    const result = { ok: false, error: remoteHit.error, word: normalized };
    setCache(cacheKey, result);
    return result;
  }

  let result = fromDictHit(normalized, remoteHit, context, remoteHit.source || "remote");
  result = enrichWithHindi(normalized, result);
  setCache(cacheKey, result);
  return result;
}

export function getGlossaryStats() {
  return {
    lookupCacheSize: lookupCache.size,
    hindi: getHindiStats(),
    policy: getPolicyStats(),
    static: getStaticIndexStats(),
    wordnet: getWordNetStats(),
    remote: getRemoteDictStats(),
  };
}

export { normalizeLookupKey as normalizeWord };
