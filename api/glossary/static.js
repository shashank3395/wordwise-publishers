/**
 * Static glossary index — compact JSON, O(1) object property lookups.
 *
 * Storage format (built by scripts/build-static-glossary.mjs):
 *   w[word]  → [pos, definition, example?, difficulty, exam, source]
 *   a[acronym] → [fullForm, category, exam]
 *   p[phrase] → [meaning, example?, type]  (idioms)
 *   o[word] → [phrase, explanation, exam]  (one-word substitutes)
 *
 * Loaded once on first static lookup (~1–2 MB). No Map rebuild — V8 inline caches
 * on plain objects are optimal for read-heavy exact-match workloads.
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { normalizeWord } from "./normalize.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const INDEX_PATH = join(__dirname, "..", "..", "data", "glossary", "static-index.json");

let index = null;
let loadError = null;

const DIFF_RANK = { easy: 1, medium: 2, hard: 3 };

function loadIndex() {
  if (index || loadError) {
    return index;
  }
  if (!existsSync(INDEX_PATH)) {
    loadError = "missing_index";
    return null;
  }
  try {
    const raw = readFileSync(INDEX_PATH, "utf8");
    index = JSON.parse(raw);
    return index;
  } catch (err) {
    loadError = err.message;
    return null;
  }
}

/** Tuple: [pos, def, example, difficulty, exam, source] */
function unpackWord(tuple) {
  if (!tuple) {
    return null;
  }
  return {
    partOfSpeech: tuple[0] || "",
    definition: tuple[1] || "",
    example: tuple[2] || null,
    difficulty: tuple[3] || "",
    exam: tuple[4] || "",
    source: tuple[5] || "editorial",
  };
}

export function lookupStaticWord(normalized) {
  const db = loadIndex();
  if (!db?.w) {
    return null;
  }
  const tuple = db.w[normalized];
  if (!tuple) {
    return null;
  }
  const entry = unpackWord(tuple);
  return {
    word: normalized,
    ...entry,
    layer: "editorial_vocab",
  };
}

export function lookupStaticAcronym(normalized) {
  const db = loadIndex();
  if (!db?.a) {
    return null;
  }
  const key = normalized.replace(/[^a-z0-9]/g, "");
  const tuple = db.a[key];
  if (!tuple) {
    return null;
  }
  const fullForm = tuple[0] || "";
  const category = tuple[1] || "";
  const exam = tuple[2] || "";
  const definition = category
    ? `${fullForm} (${category}${exam ? `; ${exam}` : ""})`
    : fullForm;
  return {
    word: normalized,
    fullForm,
    definition,
    partOfSpeech: "acronym",
    category,
    exam,
    layer: "static_acronym",
    contextExplanation: {
      explanation: `${key.toUpperCase()} stands for ${fullForm}.`,
      matchedDefinition: fullForm,
      source: "static_acronym",
      partOfSpeech: "acronym",
    },
    dictionaryWouldSay: "No standard dictionary entry — readers typically leave to search Google.",
    showComparison: true,
    isAcronym: true,
  };
}

export function lookupStaticPhrase(normalized) {
  const db = loadIndex();
  if (!db) {
    return null;
  }

  if (db.p?.[normalized]) {
    const [meaning, example, type] = db.p[normalized];
    return {
      word: normalized,
      definition: meaning,
      partOfSpeech: type === "idiom" ? "idiom" : "phrase",
      example: example || null,
      layer: "static_phrase",
    };
  }

  if (db.o?.[normalized]) {
    const [phrase, explanation, exam] = db.o[normalized];
    const def = explanation || `One-word substitute for: ${phrase}`;
    return {
      word: normalized,
      definition: def,
      partOfSpeech: "noun",
      example: phrase ? `One-word for: "${phrase}"` : null,
      exam,
      layer: "static_oneword",
    };
  }

  return null;
}

export function lookupStatic(normalized) {
  const phrase = lookupStaticPhrase(normalized);
  if (phrase) {
    return phrase;
  }

  const word = lookupStaticWord(normalized);
  if (word) {
    return word;
  }

  return lookupStaticAcronym(normalized);
}

export function getStaticIndexStats() {
  const db = loadIndex();
  if (!db) {
    return { loaded: false, error: loadError };
  }
  return {
    loaded: true,
    version: db.v,
    built: db.built,
    counts: db.c || {},
    sources: db.sources || [],
  };
}

export function ensureStaticIndex() {
  return loadIndex() !== null;
}

/** Used by build script validation */
export function getIndexPath() {
  return INDEX_PATH;
}

export { DIFF_RANK, normalizeWord };
