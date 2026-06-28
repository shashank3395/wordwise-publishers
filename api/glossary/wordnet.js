/**
 * WordNet — lazy-loaded local dictionary (~27 MB RAM on first use).
 * O(1) index lookup inside the wordnet package after init.
 */

import { createRequire } from "module";

const require = createRequire(import.meta.url);

let wordnetModule = null;
let initPromise = null;
let initError = null;

async function ensureWordNet() {
  if (initError) {
    return null;
  }
  if (wordnetModule) {
    return wordnetModule;
  }
  if (!initPromise) {
    initPromise = (async () => {
      try {
        const wn = require("wordnet");
        await wn.init();
        wordnetModule = wn;
        return wn;
      } catch (err) {
        initError = err.message;
        return null;
      }
    })();
  }
  return initPromise;
}

const POS_MAP = {
  noun: "noun",
  verb: "verb",
  adjective: "adjective",
  "adjective satellite": "adjective",
  adverb: "adverb",
};

export async function lookupWordNet(normalized) {
  const wn = await ensureWordNet();
  if (!wn) {
    return null;
  }

  try {
    const defs = await wn.lookup(normalized, true);
    if (!defs || defs.length === 0) {
      return null;
    }

    const definitions = [];
    for (const def of defs) {
      const pos = POS_MAP[def.meta?.synsetType] || def.meta?.synsetType || "";
      const gloss = def.glossary?.split(";")[0]?.trim();
      if (gloss) {
        definitions.push({
          partOfSpeech: pos,
          definition: gloss,
          example: null,
        });
      }
      if (definitions.length >= 3) {
        break;
      }
    }

    if (definitions.length === 0) {
      return null;
    }

    return {
      word: normalized,
      definitions,
      phonetic: "",
      layer: "wordnet",
    };
  } catch {
    return null;
  }
}

export function getWordNetStats() {
  return {
    loaded: !!wordnetModule,
    error: initError,
    pending: !!initPromise && !wordnetModule && !initError,
  };
}

export async function preloadWordNet() {
  return ensureWordNet();
}
