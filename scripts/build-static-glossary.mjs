#!/usr/bin/env node
/**
 * Build compact static glossary index from VocabPro (GitHub).
 * Output: data/glossary/static-index.json
 *
 * Tuple format minimizes JSON size vs nested objects.
 * Run: npm run build:glossary
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "data", "glossary");
const OUT_FILE = join(OUT_DIR, "static-index.json");

const VOCABPRO_BASE =
  "https://raw.githubusercontent.com/vishwanathbite/vocabpro/main/js/data";

const SOURCES = [
  { file: "vocab-easy.js", varName: "vocabEasy", type: "word", difficulty: "easy" },
  { file: "vocab-medium.js", varName: "vocabMedium", type: "word", difficulty: "medium" },
  { file: "vocab-hard.js", varName: "vocabHard", type: "word", difficulty: "hard" },
  { file: "acronyms.js", varName: "acronymsDB", type: "acronym" },
  { file: "idioms.js", varName: "idiomsDB", type: "idiom" },
  { file: "oneword.js", varName: "oneWordDB", type: "oneword" },
];

const DIFF_RANK = { easy: 1, medium: 2, hard: 3 };

function parseVocabProJs(content, varName) {
  const cleaned = content
    .replace(/window\.\w+\s*=\s*\w+\s*;?/g, "")
    .replace(/export\s+default\s+\w+\s*;?/g, "")
    .replace(/module\.exports\s*=\s*\w+\s*;?/g, "");
  const fn = new Function(`${cleaned}; return typeof ${varName} !== 'undefined' ? ${varName} : null;`);
  return fn();
}

async function fetchSource({ file, varName }) {
  const url = `${VOCABPRO_BASE}/${file}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }
  const content = await res.text();
  const data = parseVocabProJs(content, varName);
  if (!Array.isArray(data)) {
    throw new Error(`Expected array from ${file}`);
  }
  return data;
}

function normWord(w) {
  return String(w || "")
    .toLowerCase()
    .trim()
    .replace(/^['-]+|['-]+$/g, "");
}

function normPhrase(p) {
  return normWord(p).replace(/\s+/g, " ");
}

function mergeWord(index, key, tuple, difficulty) {
  if (!key) {
    return;
  }
  const existing = index.w[key];
  if (!existing) {
    index.w[key] = tuple;
    return;
  }
  const existingRank = DIFF_RANK[existing[3]] || 0;
  const newRank = DIFF_RANK[difficulty] || 0;
  if (newRank >= existingRank) {
    index.w[key] = tuple;
  }
}

async function main() {
  console.log("Building static glossary index from VocabPro…");

  const index = {
    v: 1,
    built: new Date().toISOString(),
    sources: ["vishwanathbite/vocabpro"],
    c: { w: 0, a: 0, p: 0, o: 0 },
    w: {},
    a: {},
    p: {},
    o: {},
  };

  for (const src of SOURCES) {
    console.log(`  Fetching ${src.file}…`);
    const rows = await fetchSource(src);

    if (src.type === "word") {
      for (const row of rows) {
        const key = normWord(row.word);
        if (!key || key.includes(" ")) {
          continue;
        }
        mergeWord(
          index,
          key,
          [
            "word",
            row.definition || "",
            row.example || null,
            src.difficulty,
            row.exam || "",
            src.file.replace(".js", ""),
          ],
          src.difficulty
        );
      }
    } else if (src.type === "acronym") {
      for (const row of rows) {
        const key = normWord(row.acronym).replace(/[^a-z0-9]/g, "");
        if (!key) {
          continue;
        }
        if (!index.a[key]) {
          index.a[key] = [row.full || row.fullForm || "", row.category || "", row.exam || ""];
        }
      }
    } else if (src.type === "idiom") {
      for (const row of rows) {
        const key = normPhrase(row.idiom);
        if (!key) {
          continue;
        }
        if (!index.p[key]) {
          index.p[key] = [row.meaning || "", row.example || null, "idiom"];
        }
      }
    } else if (src.type === "oneword") {
      for (const row of rows) {
        const key = normWord(row.answer);
        if (!key) {
          continue;
        }
        if (!index.o[key]) {
          index.o[key] = [row.phrase || "", row.explanation || "", row.exam || ""];
        }
      }
    }
  }

  index.c.w = Object.keys(index.w).length;
  index.c.a = Object.keys(index.a).length;
  index.c.p = Object.keys(index.p).length;
  index.c.o = Object.keys(index.o).length;

  if (!existsSync(OUT_DIR)) {
    mkdirSync(OUT_DIR, { recursive: true });
  }

  writeFileSync(OUT_FILE, JSON.stringify(index));
  const sizeKb = Math.round(JSON.stringify(index).length / 1024);
  console.log(`\nWrote ${OUT_FILE}`);
  console.log(
    `  Words: ${index.c.w} | Acronyms: ${index.c.a} | Idioms: ${index.c.p} | One-word: ${index.c.o} (~${sizeKb} KB)`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
