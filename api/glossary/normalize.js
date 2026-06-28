/** Normalize lookup keys — single canonical form for O(1) index access */

const NON_WORD = /[^a-z0-9\s'-]/g;
const DEVANAGARI_RE = /[\u0900-\u097F]/;

export function isDevanagari(text) {
  return DEVANAGARI_RE.test(text || "");
}

export function normalizeWord(word) {
  if (!word || typeof word !== "string") {
    return "";
  }
  return word
    .toLowerCase()
    .trim()
    .replace(/^['-]+|['-]+$/g, "")
    .replace(/\s+/g, " ");
}

/** Preserves Devanagari; lowercases roman text */
export function normalizeLookupKey(word) {
  if (!word || typeof word !== "string") {
    return "";
  }
  const trimmed = word.trim().replace(/\s+/g, " ");
  if (isDevanagari(trimmed)) {
    return trimmed;
  }
  return normalizeWord(trimmed);
}

export function normalizePhrase(phrase) {
  return normalizeWord(phrase).replace(NON_WORD, "");
}

export function isValidLookupWord(word) {
  const n = normalizeLookupKey(word);
  if (isDevanagari(n)) {
    return n.length >= 1 && n.length <= 32;
  }
  return n.length >= 2 && n.length <= 64 && /^[a-z][a-z'-]*[a-z]$|^[a-z]{2}$/.test(n.replace(/\s/g, ""));
}

export function isValidLookupText(text) {
  const n = normalizeLookupKey(text);
  if (isDevanagari(n)) {
    return n.length >= 1 && n.length <= 80;
  }
  if (n.length < 2 || n.length > 80) {
    return false;
  }
  if (!n.includes(" ")) {
    return isValidLookupWord(n);
  }
  const words = n.split(" ");
  if (words.length > 8) {
    return false;
  }
  return words.every((w) => isDevanagari(w) || /^[a-z][a-z'-]*[a-z]$|^[a-z]{2}$/.test(w));
}
