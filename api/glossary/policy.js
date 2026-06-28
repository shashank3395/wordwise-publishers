/**
 * Curated policy / news jargon — loads JSON data layers (highest priority after cache).
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { normalizeWord } from "./normalize.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GLOSSARY_DIR = join(__dirname, "..", "..", "data", "glossary");

let policyData = null;
let contextRules = null;
let schemeAcronyms = null;

function loadJson(name) {
  const path = join(GLOSSARY_DIR, name);
  if (!existsSync(path)) {
    return null;
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

function ensureLoaded() {
  if (!policyData) {
    policyData = loadJson("policy-terms.json") || { phrases: {}, terms: {}, acronyms: {} };
  }
  if (!contextRules) {
    contextRules = loadJson("context-rules.json")?.rules || [];
  }
  if (!schemeAcronyms) {
    schemeAcronyms = loadJson("scheme-acronyms.json")?.acronyms || {};
  }
}

function formatExplanation(template, word) {
  if (!template) {
    return null;
  }
  return template.replace(/\{word\}/g, word);
}

function entryToHit(normalized, entry, source, sentence = "") {
  const snippet = sentence.length > 120 ? `${sentence.slice(0, 117)}…` : sentence;
  const explanation = formatExplanation(entry.explanation, normalized);
  return {
    word: normalized,
    definition: entry.definition,
    partOfSpeech: entry.pos || entry.partOfSpeech || "noun",
    domains: entry.domains || [],
    contextExplanation: {
      sentence: snippet || null,
      explanation,
      partOfSpeech: entry.pos || entry.partOfSpeech || "noun",
      matchedDefinition: entry.definition,
      source,
    },
    dictionaryWouldSay: entry.definition,
    showComparison: !!explanation,
  };
}

function acronymToHit(normalized, entry, source, sentence = "") {
  const snippet = sentence.length > 120 ? `${sentence.slice(0, 117)}…` : sentence;
  const explanation =
    formatExplanation(entry.explanation, normalized) ||
    `${normalized.toUpperCase()} stands for ${entry.fullForm}.`;
  return {
    word: normalized,
    fullForm: entry.fullForm,
    definition: entry.definition,
    partOfSpeech: "acronym",
    domains: entry.domains || [],
    contextExplanation: {
      sentence: snippet || null,
      explanation,
      partOfSpeech: "acronym",
      matchedDefinition: entry.definition,
      source,
    },
    dictionaryWouldSay: "No standard dictionary entry — readers typically leave to search Google.",
    showComparison: true,
    isAcronym: true,
  };
}

function wordRelatesToPhrase(word, phraseKey) {
  if (word === phraseKey) {
    return true;
  }
  if (!phraseKey.includes(" ")) {
    return false;
  }
  return phraseKey.split(/\s+/).includes(word);
}

export function findPolicyPhraseInSentence(lowerSentence, word = null) {
  ensureLoaded();
  let best = null;
  for (const key of Object.keys(policyData.phrases || {})) {
    if (!key.includes(" ") || !lowerSentence.includes(key)) {
      continue;
    }
    if (word && !wordRelatesToPhrase(word, key)) {
      continue;
    }
    if (!best || key.length > best.key.length) {
      best = { key, entry: policyData.phrases[key] };
    }
  }
  return best;
}

export function findGlossaryMatch(word, lowerSentence) {
  ensureLoaded();

  const term = policyData.terms?.[word];
  if (term && !term.requiresContext) {
    return term;
  }

  const phrase = findPolicyPhraseInSentence(lowerSentence, word);
  if (phrase) {
    return phrase.entry;
  }

  return null;
}

function lookupAcronymEntry(normalized) {
  ensureLoaded();
  const key = normalized.replace(/[^a-z0-9\s-]/g, "");
  return (
    policyData.acronyms?.[key] ||
  schemeAcronyms[key] ||
    null
  );
}

export function lookupCuratedAcronym(normalized, context) {
  const entry = lookupAcronymEntry(normalized);
  if (!entry) {
    return null;
  }
  const sentence = (context || "").trim();
  return acronymToHit(normalized, entry, "acronym_glossary", sentence);
}

function applyContextRule(normalized, sentence) {
  ensureLoaded();
  const lower = sentence.toLowerCase();
  for (const rule of contextRules) {
    if (!rule.terms?.includes(normalized)) {
      continue;
    }
    if (rule.avoid && new RegExp(rule.avoid, "i").test(lower)) {
      continue;
    }
    if (rule.match && new RegExp(rule.match, "i").test(lower)) {
      return {
        definition: rule.definition,
        pos: "noun",
        explanation: formatExplanation(rule.explanation, normalized),
      };
    }
  }
  return null;
}

export function lookupPolicyDirect(normalized) {
  ensureLoaded();

  const phraseEntry = policyData.phrases?.[normalized];
  if (phraseEntry) {
    return entryToHit(normalized, phraseEntry, "policy_glossary");
  }

  const termEntry = policyData.terms?.[normalized];
  if (termEntry && !termEntry.requiresContext && termEntry.explanation) {
    return entryToHit(normalized, termEntry, "policy_glossary");
  }

  return null;
}

export function lookupPolicyWithContext(normalized, context) {
  const sentence = (context || "").trim();
  if (!sentence) {
    return null;
  }

  ensureLoaded();
  const lower = sentence.toLowerCase();

  const ruleHit = applyContextRule(normalized, sentence);
  if (ruleHit?.explanation) {
    return entryToHit(normalized, ruleHit, "policy_context_rule", sentence);
  }

  const phraseInSentence = findPolicyPhraseInSentence(lower, normalized);
  if (phraseInSentence) {
    return entryToHit(normalized, phraseInSentence.entry, "policy_glossary", sentence);
  }

  const termEntry = policyData.terms?.[normalized];
  if (termEntry) {
    if (termEntry.requiresContext) {
      if (termEntry.contextMatch && !new RegExp(termEntry.contextMatch, "i").test(lower)) {
        return null;
      }
      if (!termEntry.explanation) {
        return null;
      }
    }
    const hit = entryToHit(normalized, termEntry, "policy_glossary", sentence);
    if (hit.contextExplanation?.explanation) {
      return hit;
    }
    return null;
  }

  return null;
}

export function getPolicyStats() {
  ensureLoaded();
  return {
    phrases: Object.keys(policyData.phrases || {}).length,
    terms: Object.keys(policyData.terms || {}).length,
    acronyms: Object.keys(policyData.acronyms || {}).length,
    schemeAcronyms: Object.keys(schemeAcronyms).length,
    contextRules: contextRules.length,
  };
}

/** @deprecated kept for result.js compatibility — data now in JSON */
export const POLICY_GLOSSARY = {};
export const ACRONYM_GLOSSARY = {};
