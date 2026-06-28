import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { lookupWord, getGlossaryStats } from "./glossary/engine.js";

export { lookupWord };

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadJson(filename, fallback) {
  ensureDataDir();
  const path = join(DATA_DIR, filename);
  if (!existsSync(path)) {
    return fallback;
  }
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

function saveJson(filename, data) {
  ensureDataDir();
  writeFileSync(join(DATA_DIR, filename), JSON.stringify(data));
}

/** In-memory data caches — avoid disk read on every request */
let analyticsEvents = null;
let vocabularyStore = null;
let summaryCache = new Map();
const SUMMARY_CACHE_TTL_MS = 5000;
const ARTICLE_GLOSSARY_CACHE_TTL_MS = 60_000;

/** Batched analytics writes — flush every 2s instead of per event */
const pendingAnalytics = [];
let analyticsFlushTimer = null;
const RING_BUFFER_MAX = 20_000;
const SESSION_SET_MAX = 5_000;

/** Pre-aggregated stats — O(1) dashboard reads at scale */
const aggregatesByPublisher = new Map();
const recentLookupsByPublisher = new Map();
const articleLookupIndex = new Map();
const articleGlossaryCache = new Map();
let aggregatesDirty = false;

function flushAnalytics() {
  analyticsFlushTimer = null;
  if (pendingAnalytics.length === 0) {
    return;
  }
  const events = getAnalyticsEvents();
  events.push(...pendingAnalytics);
  pendingAnalytics.length = 0;
  if (events.length > RING_BUFFER_MAX) {
    events.splice(0, events.length - RING_BUFFER_MAX);
  }
  saveJson("analytics.json", events);
  aggregatesDirty = false;
  summaryCache.clear();
}

function scheduleAnalyticsFlush() {
  if (!analyticsFlushTimer) {
    analyticsFlushTimer = setTimeout(flushAnalytics, 2000);
  }
}

function getPublisherKey(publisher) {
  return publisher || "unknown";
}

function getAggregate(publisher) {
  const key = getPublisherKey(publisher);
  if (!aggregatesByPublisher.has(key)) {
    aggregatesByPublisher.set(key, {
      totalLookups: 0,
      totalPageViews: 0,
      totalVocabularySaves: 0,
      contextLookups: 0,
      successfulLookups: 0,
      timeOnPageSum: 0,
      timeOnPageCount: 0,
      sessions: new Set(),
      wordCounts: {},
      wordMeta: {},
      articleCounts: {},
      articleTitles: {},
    });
  }
  return aggregatesByPublisher.get(key);
}

function capSessionSet(set) {
  if (set.size > SESSION_SET_MAX) {
    const excess = set.size - SESSION_SET_MAX;
    const iter = set.values();
    for (let i = 0; i < excess; i++) {
      set.delete(iter.next().value);
    }
  }
}

function updateArticleIndex(event) {
  if (event.type !== "lookup" || event.success === false || !event.word || !event.articleUrl) {
    return;
  }
  const cacheKey = `${getPublisherKey(event.publisher)}::${event.articleUrl}`;
  if (!articleLookupIndex.has(cacheKey)) {
    articleLookupIndex.set(cacheKey, new Map());
  }
  const byWord = articleLookupIndex.get(cacheKey);
  const existing = byWord.get(event.word);
  if (!existing) {
    byWord.set(event.word, {
      word: event.word,
      count: 1,
      definition: event.definition || "",
      contextExplanation: event.contextExplanation || "",
      fullForm: event.fullForm || "",
      partOfSpeech: event.partOfSpeech || "",
    });
  } else {
    existing.count += 1;
    if (event.definition) {
      existing.definition = event.definition;
    }
    if (event.contextExplanation) {
      existing.contextExplanation = event.contextExplanation;
    }
    if (event.fullForm) {
      existing.fullForm = event.fullForm;
    }
  }
  articleGlossaryCache.delete(cacheKey);
}

function ingestEvent(rawEvent) {
  const event = {
    id: rawEvent.id || crypto.randomUUID(),
    timestamp: rawEvent.timestamp || new Date().toISOString(),
    ...rawEvent,
    articleUrl: rawEvent.articleUrl || rawEvent.url || "",
    articleTitle: rawEvent.articleTitle || rawEvent.title || "",
  };

  pendingAnalytics.push(event);
  aggregatesDirty = true;
  scheduleAnalyticsFlush();

  const agg = getAggregate(event.publisher);
  if (event.sessionId) {
    agg.sessions.add(event.sessionId);
    capSessionSet(agg.sessions);
  }

  if (event.type === "lookup") {
    agg.totalLookups += 1;
    if (event.success !== false) {
      agg.successfulLookups += 1;
    }
    if (event.hasContext) {
      agg.contextLookups += 1;
    }
    if (event.word) {
      agg.wordCounts[event.word] = (agg.wordCounts[event.word] || 0) + 1;
      if (event.definition) {
        agg.wordMeta[event.word] = {
          definition: event.definition,
          contextExplanation: event.contextExplanation || "",
          fullForm: event.fullForm || "",
        };
      }
    }
    if (event.articleUrl) {
      agg.articleCounts[event.articleUrl] = (agg.articleCounts[event.articleUrl] || 0) + 1;
    }
    const pubKey = getPublisherKey(event.publisher);
    if (!recentLookupsByPublisher.has(pubKey)) {
      recentLookupsByPublisher.set(pubKey, []);
    }
    const recent = recentLookupsByPublisher.get(pubKey);
    recent.push(event);
    if (recent.length > 50) {
      recent.splice(0, recent.length - 50);
    }
    updateArticleIndex(event);
  } else if (event.type === "pageview") {
    agg.totalPageViews += 1;
  } else if (event.type === "vocabulary_save") {
    agg.totalVocabularySaves += 1;
  } else if (event.type === "time_on_page" && event.seconds) {
    agg.timeOnPageSum += event.seconds;
    agg.timeOnPageCount += 1;
  }

  if (event.articleTitle && event.articleUrl) {
    agg.articleTitles[event.articleUrl] = event.articleTitle;
  }

  summaryCache.delete(getPublisherKey(event.publisher));
  summaryCache.delete("all");
  return event;
}

function rebuildAggregatesFromDisk() {
  aggregatesByPublisher.clear();
  recentLookupsByPublisher.clear();
  articleLookupIndex.clear();
  articleGlossaryCache.clear();

  for (const e of getAnalyticsEvents()) {
    const agg = getAggregate(e.publisher);
    if (e.sessionId) {
      agg.sessions.add(e.sessionId);
    }

    if (e.type === "lookup") {
      agg.totalLookups += 1;
      if (e.success !== false) {
        agg.successfulLookups += 1;
      }
      if (e.hasContext) {
        agg.contextLookups += 1;
      }
      if (e.word) {
        agg.wordCounts[e.word] = (agg.wordCounts[e.word] || 0) + 1;
        if (e.definition) {
          agg.wordMeta[e.word] = {
            definition: e.definition,
            contextExplanation: e.contextExplanation || "",
            fullForm: e.fullForm || "",
          };
        }
      }
      if (e.articleUrl) {
        agg.articleCounts[e.articleUrl] = (agg.articleCounts[e.articleUrl] || 0) + 1;
      }
      const pubKey = getPublisherKey(e.publisher);
      if (!recentLookupsByPublisher.has(pubKey)) {
        recentLookupsByPublisher.set(pubKey, []);
      }
      recentLookupsByPublisher.get(pubKey).push(e);
      updateArticleIndex(e);
    } else if (e.type === "pageview") {
      agg.totalPageViews += 1;
    } else if (e.type === "vocabulary_save") {
      agg.totalVocabularySaves += 1;
    } else if (e.type === "time_on_page" && e.seconds) {
      agg.timeOnPageSum += e.seconds;
      agg.timeOnPageCount += 1;
    }

    if (e.articleTitle && e.articleUrl) {
      agg.articleTitles[e.articleUrl] = e.articleTitle;
    }
  }

  for (const [pubKey, recent] of recentLookupsByPublisher) {
    if (recent.length > 50) {
      recentLookupsByPublisher.set(pubKey, recent.slice(-50));
    }
  }
}

let aggregatesBootstrapped = false;
function ensureAggregates() {
  if (!aggregatesBootstrapped) {
    rebuildAggregatesFromDisk();
    aggregatesBootstrapped = true;
  }
}

function getAnalyticsEvents() {
  if (!analyticsEvents) {
    analyticsEvents = loadJson("analytics.json", []);
  }
  return analyticsEvents;
}

function getVocabularyStore() {
  if (!vocabularyStore) {
    vocabularyStore = loadJson("vocabulary.json", {});
  }
  return vocabularyStore;
}

function invalidateSummaryCache() {
  summaryCache.clear();
}

export function recordEvent(publisher, event) {
  ingestEvent({ publisher, ...event });
  return { ok: true };
}

export function recordEventsBatch(shared, events) {
  if (!Array.isArray(events) || events.length === 0) {
    return { ok: true, accepted: 0 };
  }
  const capped = events.slice(0, 50);
  for (const event of capped) {
    ingestEvent({
      publisher: shared.publisher || event.publisher || "unknown",
      sessionId: shared.sessionId || event.sessionId,
      userId: shared.userId || event.userId,
      url: shared.url || event.url,
      title: shared.title || event.title,
      articleUrl: shared.url || event.url || event.articleUrl,
      articleTitle: shared.title || event.title || event.articleTitle,
      ...event,
    });
  }
  return { ok: true, accepted: capped.length };
}

function mergeAggregateTotals(publisherFilter) {
  ensureAggregates();
  const totals = {
    totalLookups: 0,
    totalPageViews: 0,
    totalVocabularySaves: 0,
    contextLookups: 0,
    successfulLookups: 0,
    timeOnPageSum: 0,
    timeOnPageCount: 0,
    sessions: new Set(),
    wordCounts: {},
    wordMeta: {},
    articleCounts: {},
    articleTitles: {},
  };

  const entries = publisherFilter
    ? [[getPublisherKey(publisherFilter), getAggregate(publisherFilter)]]
    : aggregatesByPublisher.entries();

  for (const [, agg] of entries) {
    totals.totalLookups += agg.totalLookups;
    totals.totalPageViews += agg.totalPageViews;
    totals.totalVocabularySaves += agg.totalVocabularySaves;
    totals.contextLookups += agg.contextLookups;
    totals.successfulLookups += agg.successfulLookups;
    totals.timeOnPageSum += agg.timeOnPageSum;
    totals.timeOnPageCount += agg.timeOnPageCount;
    for (const sid of agg.sessions) {
      totals.sessions.add(sid);
    }
    for (const [word, count] of Object.entries(agg.wordCounts)) {
      totals.wordCounts[word] = (totals.wordCounts[word] || 0) + count;
      if (agg.wordMeta[word]) {
        totals.wordMeta[word] = agg.wordMeta[word];
      }
    }
    for (const [url, count] of Object.entries(agg.articleCounts)) {
      totals.articleCounts[url] = (totals.articleCounts[url] || 0) + count;
    }
    Object.assign(totals.articleTitles, agg.articleTitles);
  }

  return totals;
}

export function getAnalyticsSummary(publisher) {
  const cacheKey = publisher || "all";
  const hit = summaryCache.get(cacheKey);
  if (hit && Date.now() - hit.timestamp < SUMMARY_CACHE_TTL_MS) {
    return hit.data;
  }

  ensureAggregates();
  const totals = mergeAggregateTotals(publisher || null);

  const topWords = Object.entries(totals.wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word, count]) => ({ word, count, ...totals.wordMeta[word] }));

  const topArticles = Object.entries(totals.articleCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([url, count]) => ({
      url,
      count,
      title: totals.articleTitles[url] || url.replace(/^file:\/\//, "").split("/").pop() || url,
    }));

  const pubKey = publisher ? getPublisherKey(publisher) : null;
  const recentSource = pubKey ? recentLookupsByPublisher.get(pubKey) || [] : [];
  const recentLookups = pubKey
    ? recentSource
    : [...recentLookupsByPublisher.values()].flat();

  const data = {
    publisher: cacheKey,
    totalLookups: totals.totalLookups,
    totalPageViews: totals.totalPageViews,
    totalVocabularySaves: totals.totalVocabularySaves,
    uniqueSessions: totals.sessions.size,
    avgTimeOnPageSeconds: Math.round(totals.timeOnPageSum / Math.max(1, totals.timeOnPageCount)),
    contextLookups: totals.contextLookups,
    successfulLookups: totals.successfulLookups,
    lookupRate: totals.totalPageViews > 0 ? Math.round((totals.totalLookups / totals.totalPageViews) * 100) : 0,
    tabSwitchesPrevented: totals.successfulLookups,
    topWords,
    topArticles,
    recentLookups: recentLookups.slice(-10).reverse().map((e) => ({
      ...e,
      articleTitle: e.articleTitle || totals.articleTitles[e.articleUrl] || "",
    })),
  };

  summaryCache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
}

export function getHealthStats() {
  ensureAggregates();
  const glossary = getGlossaryStats();
  return {
    ok: true,
    uptimeSec: Math.round(process.uptime()),
    pendingAnalytics: pendingAnalytics.length,
    ringBufferSize: getAnalyticsEvents().length,
    publishersTracked: aggregatesByPublisher.size,
    glossary,
  };
}

export function saveVocabularyEntry(userId, entry) {
  const store = getVocabularyStore();
  if (!store[userId]) {
    store[userId] = [];
  }

  const existing = store[userId].findIndex((e) => e.word === entry.word && e.articleUrl === entry.articleUrl);
  const record = {
    id: crypto.randomUUID(),
    word: entry.word,
    definition: entry.definition,
    contextExplanation: entry.contextExplanation || null,
    articleUrl: entry.articleUrl || "",
    articleTitle: entry.articleTitle || "",
    savedAt: new Date().toISOString(),
    practiceSentence: entry.practiceSentence || "",
  };

  if (existing >= 0) {
    store[userId][existing] = { ...store[userId][existing], ...record };
  } else {
    store[userId].push(record);
  }

  saveJson("vocabulary.json", store);
  return record;
}

export function getVocabulary(userId) {
  const entries = getVocabularyStore()[userId] || [];
  return entries.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
}

export function updatePracticeSentence(userId, entryId, practiceSentence) {
  const store = getVocabularyStore();
  const entries = store[userId] || [];
  const entry = entries.find((e) => e.id === entryId);
  if (!entry) {
    return null;
  }
  entry.practiceSentence = practiceSentence;
  entry.practicedAt = new Date().toISOString();
  saveJson("vocabulary.json", store);
  return entry;
}

export function deleteVocabularyEntry(userId, entryId) {
  const store = getVocabularyStore();
  if (!store[userId]) {
    return false;
  }
  const before = store[userId].length;
  store[userId] = store[userId].filter((e) => e.id !== entryId);
  saveJson("vocabulary.json", store);
  return store[userId].length < before;
}

export function clearAnalytics() {
  analyticsEvents = [];
  pendingAnalytics.length = 0;
  aggregatesByPublisher.clear();
  recentLookupsByPublisher.clear();
  articleLookupIndex.clear();
  articleGlossaryCache.clear();
  aggregatesBootstrapped = true;
  if (analyticsFlushTimer) {
    clearTimeout(analyticsFlushTimer);
    analyticsFlushTimer = null;
  }
  saveJson("analytics.json", []);
  invalidateSummaryCache();
  return { ok: true, cleared: "analytics" };
}

export function clearAllVocabulary() {
  vocabularyStore = {};
  saveJson("vocabulary.json", {});
  return { ok: true, cleared: "vocabulary" };
}

export function clearAllDemoData() {
  clearAnalytics();
  clearAllVocabulary();
  return { ok: true, cleared: "all" };
}

export function getArticleGlossary(publisher, articleUrl) {
  ensureAggregates();
  const cacheKey = `${getPublisherKey(publisher)}::${articleUrl}`;
  const cached = articleGlossaryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < ARTICLE_GLOSSARY_CACHE_TTL_MS) {
    return cached.data;
  }

  const byWord = articleLookupIndex.get(cacheKey);
  const popular = byWord
    ? [...byWord.values()].sort((a, b) => b.count - a.count).slice(0, 12)
    : [];

  const data = { ok: true, articleUrl, popular };
  articleGlossaryCache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
}
