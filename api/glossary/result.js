import { findGlossaryMatch } from "./policy.js";

export function buildContextExplanation(word, context, definitions) {
  if (!context) {
    return null;
  }

  const sentence = context.trim();
  const lowerSentence = sentence.toLowerCase();

  const glossaryHit = findGlossaryMatch(word.toLowerCase(), lowerSentence);
  if (glossaryHit) {
    let explanation =
      typeof glossaryHit.explanation === "function"
        ? glossaryHit.explanation(word, sentence)
        : glossaryHit.explanation;
    if (explanation) {
      explanation = explanation.replace(/\{word\}/g, word);
      return {
        sentence: sentence.length > 120 ? `${sentence.slice(0, 117)}…` : sentence,
        explanation,
        partOfSpeech: glossaryHit.pos || glossaryHit.partOfSpeech,
        matchedDefinition: glossaryHit.definition,
        source: "policy_glossary",
      };
    }
  }

  if (!definitions?.length) {
    return null;
  }

  let bestDef = definitions[0];
  let bestScore = -1;

  for (const def of definitions) {
    let score = 0;
    const defLower = def.definition.toLowerCase();
    const defWords = defLower.split(/\W+/);

    for (const w of defWords) {
      if (w.length > 4 && lowerSentence.includes(w)) {
        score += 2;
      }
    }

    if (def.example && lowerSentence.includes(def.example.toLowerCase().slice(0, 20))) {
      score += 5;
    }

    if (
      def.partOfSpeech === "noun" &&
      /\b(the|a|an)\s+\w+\s+(period|scheme|bill|allocation|burden|share)\b/i.test(lowerSentence)
    ) {
      score += 2;
    }

    if (/consciousness|medical|anatomy/i.test(defLower) && /scheme|state|government|wage|policy|period|season/i.test(lowerSentence)) {
      score -= 4;
    }

    if (/censorship|media/i.test(defLower) && /employment|scheme|agricultural|wage|labour|labor/i.test(lowerSentence)) {
      score -= 2;
    }

    if (score > bestScore) {
      bestScore = score;
      bestDef = def;
    }
  }

  const snippet = sentence.length > 120 ? `${sentence.slice(0, 117)}…` : sentence;
  const explanation = `In this article, "${word}" (${bestDef.partOfSpeech}) means: ${bestDef.definition.charAt(0).toLowerCase()}${bestDef.definition.slice(1)}`;

  return {
    sentence: snippet,
    explanation,
    partOfSpeech: bestDef.partOfSpeech,
    matchedDefinition: bestDef.definition,
    source: "dictionary",
  };
}

export function packLookupResult({
  word,
  phonetic = "",
  definitions,
  contextExplanation = null,
  dictionaryWouldSay = null,
  showComparison = false,
  fullForm = null,
  isAcronym = false,
  example = null,
  source = null,
  hindi = null,
  transliteration = null,
  hindiUsage = null,
}) {
  return {
    ok: true,
    word,
    phonetic,
    definitions,
    contextExplanation,
    dictionaryWouldSay,
    showComparison,
    fullForm,
    isAcronym,
    example: example ?? definitions?.[0]?.example ?? null,
    source,
    hindi,
    transliteration,
    hindiUsage,
  };
}

export function fromStaticHit(normalized, hit, context) {
  const definitions = [
    {
      partOfSpeech: hit.partOfSpeech || "noun",
      definition: hit.definition,
      example: hit.example || null,
    },
  ];

  if (hit.isAcronym || hit.layer === "static_acronym") {
    return packLookupResult({
      word: normalized,
      definitions,
      contextExplanation: hit.contextExplanation,
      dictionaryWouldSay: hit.dictionaryWouldSay,
      showComparison: true,
      fullForm: hit.fullForm,
      isAcronym: true,
      source: hit.layer,
    });
  }

  const contextExplanation = buildContextExplanation(normalized, context, definitions);
  const dictionaryWouldSay = definitions[0]?.definition || null;

  return packLookupResult({
    word: normalized,
    definitions,
    contextExplanation,
    dictionaryWouldSay,
    showComparison: !!(
      contextExplanation &&
      dictionaryWouldSay &&
      contextExplanation.source !== "dictionary"
    ),
    source: hit.layer,
  });
}

export function fromDictHit(normalized, dictHit, context, layer) {
  const definitions = dictHit.definitions;
  const contextExplanation = buildContextExplanation(normalized, context, definitions);
  const dictionaryWouldSay = definitions[0]?.definition || null;
  const showComparison =
    contextExplanation?.source === "policy_glossary" ||
    (contextExplanation &&
      dictionaryWouldSay &&
      !contextExplanation.explanation.includes(dictionaryWouldSay.slice(0, 30)));

  return packLookupResult({
    word: normalized,
    phonetic: dictHit.phonetic || "",
    definitions,
    contextExplanation,
    dictionaryWouldSay,
    showComparison,
    source: layer,
  });
}

export function fromPolicyHit(hit) {
  const definitions = [
    {
      partOfSpeech: hit.partOfSpeech,
      definition: hit.definition,
      example: null,
    },
  ];
  return packLookupResult({
    word: hit.word,
    definitions,
    contextExplanation: hit.contextExplanation,
    dictionaryWouldSay: hit.dictionaryWouldSay,
    showComparison: true,
    source: "policy_glossary",
  });
}

export function fromAcronymHit(hit) {
  const definitions = [
    {
      partOfSpeech: "acronym",
      definition: hit.definition,
      example: null,
    },
  ];
  return packLookupResult({
    word: hit.word,
    definitions,
    contextExplanation: hit.contextExplanation,
    dictionaryWouldSay: hit.dictionaryWouldSay,
    showComparison: true,
    fullForm: hit.fullForm,
    isAcronym: true,
    source: "acronym_glossary",
  });
}

export function fromHindiHit(hit) {
  const definitions = [
    {
      partOfSpeech: hit.partOfSpeech || "noun",
      definition: hit.definition,
      example: hit.usage || null,
    },
  ];
  return packLookupResult({
    word: hit.word,
    definitions,
    hindi: hit.hindi,
    transliteration: hit.transliteration,
    hindiUsage: hit.usage,
    source: hit.layer,
  });
}
