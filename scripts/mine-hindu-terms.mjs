#!/usr/bin/env node
/**
 * Mine candidate glossary terms from saved Hindu HTML articles.
 * Flags words/phrases not covered by policy + static layers.
 *
 * Usage: node scripts/mine-hindu-terms.mjs [path/to/article.html ...]
 */

import { readFileSync, existsSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { normalizeWord } from "../api/glossary/normalize.js";
import { lookupPolicyDirect } from "../api/glossary/policy.js";
import { lookupStatic } from "../api/glossary/static.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const STOPWORDS = new Set(
  "a an the and or but in on at to for of is are was were be been being have has had do does did will would could should may might must can this that these those it its they them their he she we you i not no nor so if then than when while with from by as about into over after before during through between under above up down out off again further once here there all each few more most other some such only own same both too very just also now new one two three four five six seven eight nine ten".split(
    " "
  )
);

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTokens(text) {
  const words = new Map();
  const phrases = new Map();

  const wordRe = /\b[a-z][a-z'-]{1,30}\b/gi;
  let m;
  while ((m = wordRe.exec(text)) !== null) {
    const w = normalizeWord(m[0]);
    if (w.length < 3 || STOPWORDS.has(w)) {
      continue;
    }
    words.set(w, (words.get(w) || 0) + 1);
  }

  const phraseRe = /\b([a-z][a-z'-]+(?:\s+[a-z][a-z'-]+){1,4})\b/gi;
  while ((m = phraseRe.exec(text)) !== null) {
    const p = normalizeWord(m[1]);
    if (p.split(" ").some((w) => STOPWORDS.has(w))) {
      continue;
    }
    phrases.set(p, (phrases.get(p) || 0) + 1);
  }

  return { words, phrases };
}

function isCovered(token) {
  if (lookupPolicyDirect(token)) {
    return "policy";
  }
  if (lookupStatic(token)) {
    return "static";
  }
  return null;
}

function mineFile(filePath) {
  const html = readFileSync(filePath, "utf8");
  const text = stripHtml(html).toLowerCase();
  const { words, phrases } = extractTokens(text);

  const missingWords = [];
  const missingPhrases = [];

  for (const [word, count] of words) {
    if (!isCovered(word)) {
      missingWords.push({ word, count });
    }
  }

  for (const [phrase, count] of phrases) {
    if (!isCovered(phrase)) {
      missingPhrases.push({ phrase, count });
    }
  }

  missingWords.sort((a, b) => b.count - a.count);
  missingPhrases.sort((a, b) => b.count - a.count);

  return { filePath, missingWords, missingPhrases };
}

function defaultArticles() {
  const candidates = [
    join(ROOT, "demo_article_3.html"),
    join(ROOT, "public", "demo", "index.html"),
  ];
  try {
    const saved = readdirSync(ROOT).filter((f) => f.endsWith(".html") && f.startsWith("demo"));
    for (const f of saved) {
      candidates.push(join(ROOT, f));
    }
  } catch {
    /* ignore */
  }
  return [...new Set(candidates)].filter((p) => existsSync(p));
}

const files = process.argv.slice(2).length ? process.argv.slice(2) : defaultArticles();

if (!files.length) {
  console.error("No HTML files found. Pass paths or add demo_article_3.html to project root.");
  process.exit(1);
}

console.log(`Mining ${files.length} article(s)…\n`);

const aggregateWords = new Map();
const aggregatePhrases = new Map();

for (const file of files) {
  const { missingWords, missingPhrases } = mineFile(file);
  console.log(`## ${file}`);
  console.log(`Missing words (top 25):`);
  for (const { word, count } of missingWords.slice(0, 25)) {
    console.log(`  ${word.padEnd(24)} ×${count}`);
    aggregateWords.set(word, (aggregateWords.get(word) || 0) + count);
  }
  console.log(`Missing phrases (top 15):`);
  for (const { phrase, count } of missingPhrases.slice(0, 15)) {
    console.log(`  ${phrase.padEnd(32)} ×${count}`);
    aggregatePhrases.set(phrase, (aggregatePhrases.get(phrase) || 0) + count);
  }
  console.log("");
}

console.log("=== Aggregate priority queue (words) ===");
const topWords = [...aggregateWords.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40);
for (const [word, count] of topWords) {
  console.log(`${word.padEnd(24)} ×${count}`);
}

console.log("\n=== Aggregate priority queue (phrases) ===");
const topPhrases = [...aggregatePhrases.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
for (const [phrase, count] of topPhrases) {
  console.log(`${phrase.padEnd(32)} ×${count}`);
}
