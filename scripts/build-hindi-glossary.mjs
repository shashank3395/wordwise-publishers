#!/usr/bin/env node
/**
 * Build compact Hindi→English index for newspaper lookup.
 *
 * Sources (reliable):
 *   1. Wiktionary Hindi compact JSONL (tdulcet) — ~32k Devanagari lemmas, English defs
 *   2. data/glossary/hindi-terms.json — curated overrides (newspaper / policy terms)
 *
 * Output: data/glossary/hindi-index.json
 *   t[id] → [hindi, roman, pos, definition, source]
 *   h[devanagari] → id
 *   r[roman key] → id   (ascii-simplified + IAST lower)
 *
 * Run: npm run build:hindi
 *
 * Note: AI4Bharat IndoWordNet/Bharatavani S3 zips return 403 as of 2026 — re-enable when URLs work.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { createInterface } from "readline";
import { Readable } from "stream";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GLOSSARY_DIR = join(__dirname, "..", "data", "glossary");
const CURATED_PATH = join(GLOSSARY_DIR, "hindi-terms.json");
const OUT_FILE = join(GLOSSARY_DIR, "hindi-index.json");

const WIKTIONARY_HI_URL =
  "https://gitlab.com/tdulcet/compact-dictionaries/-/raw/main/wiktionary/dictionary-hi.json";

const DEVANAGARI = /[\u0900-\u097F]/;

function simplifyRoman(text) {
  if (!text) {
    return "";
  }
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

function isAsciiRoman(text) {
  return /^[a-z][a-z'-]{0,30}$/i.test(text);
}

function joinDefs(defs) {
  if (!Array.isArray(defs) || !defs.length) {
    return "";
  }
  const text = defs
    .slice(0, 3)
    .map((d) => String(d).replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("; ");
  return text.length > 280 ? `${text.slice(0, 277)}…` : text;
}

function pickRoman(forms) {
  if (!Array.isArray(forms) || !forms.length) {
    return "";
  }
  const ascii = forms.find((f) => isAsciiRoman(String(f).replace(/^-/, "")));
  if (ascii) {
    return String(ascii).replace(/^-/, "").toLowerCase();
  }
  return String(forms[0]).replace(/^-/, "");
}

function shouldSkipHeadword(word) {
  if (!word || word.length < 1) {
    return true;
  }
  if (/^[-0-9$]/.test(word)) {
    return true;
  }
  if (!DEVANAGARI.test(word) && !isAsciiRoman(word)) {
    return true;
  }
  return false;
}

async function fetchWiktionaryLines() {
  console.log(`Fetching ${WIKTIONARY_HI_URL} …`);
  const res = await fetch(WIKTIONARY_HI_URL);
  if (!res.ok) {
    throw new Error(`Wiktionary fetch failed: ${res.status}`);
  }
  const text = await res.text();
  return text.split("\n").filter((line) => line.trim());
}

function loadCurated() {
  if (!existsSync(CURATED_PATH)) {
    return {};
  }
  const data = JSON.parse(readFileSync(CURATED_PATH, "utf8"));
  return data.terms || {};
}

function buildIndex(wiktionaryLines, curatedTerms) {
  const tuples = [];
  const hIndex = new Map();
  const rIndex = new Map();

  function addEntry({ hindi, roman, pos, definition, source, priority = 1 }) {
    if (!hindi || !definition) {
      return;
    }

    let id = hIndex.get(hindi);
    if (id === undefined) {
      id = tuples.length;
      tuples.push([hindi, roman || "", pos || "noun", definition, source]);
      if (hindi) {
        hIndex.set(hindi, id);
      }
    } else if (priority >= 10) {
      tuples[id] = [hindi || tuples[id][0], roman || tuples[id][1], pos || tuples[id][2], definition, source];
    }

    const romanKeys = new Set();
    if (roman) {
      romanKeys.add(roman.toLowerCase());
      const simple = simplifyRoman(roman);
      if (simple.length >= 2) {
        romanKeys.add(simple);
      }
    }
    if (isAsciiRoman(hindi)) {
      romanKeys.add(hindi.toLowerCase());
      const simple = simplifyRoman(hindi);
      if (simple.length >= 2) {
        romanKeys.add(simple);
      }
    }

    for (const key of romanKeys) {
      const existing = rIndex.get(key);
      if (existing === undefined || priority >= 10) {
        rIndex.set(key, id);
      }
    }
  }

  let parsed = 0;
  let skipped = 0;

  for (const line of wiktionaryLines) {
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      skipped += 1;
      continue;
    }

    const headword = row[""] || row.w || row.word;
    if (shouldSkipHeadword(headword)) {
      skipped += 1;
      continue;
    }

    const definition = joinDefs(row.d);
    if (!definition) {
      skipped += 1;
      continue;
    }

    const pos = Array.isArray(row.p) ? row.p[0] : row.p || "noun";
    const roman = pickRoman(row.f);

    addEntry({
      hindi: DEVANAGARI.test(headword) ? headword : "",
      roman: DEVANAGARI.test(headword) ? roman : headword.toLowerCase(),
      pos,
      definition,
      source: "wiktionary-hi",
      priority: 1,
    });

    parsed += 1;
  }

  console.log(`Wiktionary: ${parsed} entries, ${skipped} skipped`);

  for (const [key, entry] of Object.entries(curatedTerms)) {
    addEntry({
      hindi: entry.hindi || (DEVANAGARI.test(key) ? key : ""),
      roman: entry.transliteration || (isAsciiRoman(key) ? key : ""),
      pos: entry.pos || "noun",
      definition: entry.definition,
      source: "curated",
      priority: 10,
    });
    for (const alias of entry.aliases || []) {
      addEntry({
        hindi: entry.hindi,
        roman: alias,
        pos: entry.pos || "noun",
        definition: entry.definition,
        source: "curated",
        priority: 10,
      });
    }
    if (isAsciiRoman(key)) {
      addEntry({
        hindi: entry.hindi,
        roman: key,
        pos: entry.pos || "noun",
        definition: entry.definition,
        source: "curated",
        priority: 10,
      });
    }
  }

  const h = Object.fromEntries(hIndex);
  const r = Object.fromEntries(rIndex);

  return {
    v: 2,
    built: new Date().toISOString(),
    sources: ["wiktionary-hi-cc", "curated-hindi-terms"],
    license: "Wiktionary CC BY-SA 3.0; curated terms MIT",
    c: {
      tuples: tuples.length,
      devanagari: Object.keys(h).length,
      roman: Object.keys(r).length,
    },
    t: tuples,
    h,
    r,
  };
}

async function main() {
  mkdirSync(GLOSSARY_DIR, { recursive: true });
  const lines = await fetchWiktionaryLines();
  console.log(`Downloaded ${lines.length} JSONL lines`);
  const curated = loadCurated();
  const index = buildIndex(lines, curated);
  writeFileSync(OUT_FILE, JSON.stringify(index));
  const sizeMb = (readFileSync(OUT_FILE).length / (1024 * 1024)).toFixed(2);
  console.log(`Wrote ${OUT_FILE} (${sizeMb} MB)`);
  console.log(`  tuples: ${index.c.tuples}`);
  console.log(`  Devanagari keys: ${index.c.devanagari}`);
  console.log(`  Roman keys: ${index.c.roman}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
