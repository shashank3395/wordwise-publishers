import { createServer } from "http";
import { readFileSync, existsSync, statSync } from "fs";
import { join, dirname, extname } from "path";
import { fileURLToPath } from "url";
import { gzipSync } from "zlib";
import { checkLookupRateLimit, getClientKey, readBody } from "./api/guard.js";
import { preloadWordNet } from "./api/glossary/wordnet.js";
import {
  lookupWord,
  recordEvent,
  recordEventsBatch,
  getAnalyticsSummary,
  saveVocabularyEntry,
  getVocabulary,
  updatePracticeSentence,
  deleteVocabularyEntry,
  clearAnalytics,
  clearAllVocabulary,
  clearAllDemoData,
  getArticleGlossary,
  getHealthStats,
} from "./api/store.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "public");
const PROJECT_ROOT = __dirname;
const PORT = process.env.PORT || 3847;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

const staticCache = new Map();
const CACHEABLE_EXT = new Set([".js", ".css", ".html", ".svg"]);

function loadStaticFile(filePath) {
  const ext = extname(filePath);
  if (!CACHEABLE_EXT.has(ext)) {
    return { body: readFileSync(filePath), ext, gzip: false };
  }

  const stat = statSync(filePath);
  const cached = staticCache.get(filePath);
  if (cached && cached.mtimeMs === stat.mtimeMs) {
    return cached;
  }

  const raw = readFileSync(filePath);
  const entry = {
    body: raw,
    ext,
    gzip: false,
    mtimeMs: stat.mtimeMs,
    maxAge: ext === ".js" ? 3600 : ext === ".html" ? 120 : 600,
  };

  if (raw.length > 1024 && (ext === ".js" || ext === ".html" || ext === ".css")) {
    entry.gzipBody = gzipSync(raw);
    entry.gzip = true;
  }

  staticCache.set(filePath, entry);
  return entry;
}

function sendJson(res, status, data, extraHeaders = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    ...extraHeaders,
  });
  res.end(JSON.stringify(data));
}

function sendFile(res, filePath, req) {
  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const file = loadStaticFile(filePath);
  const acceptEncoding = req?.headers["accept-encoding"] || "";
  const useGzip = file.gzip && acceptEncoding.includes("gzip");
  const headers = {
    "Content-Type": MIME[file.ext] || "application/octet-stream",
    "Cache-Control": `public, max-age=${file.maxAge || 60}`,
  };

  if (useGzip) {
    headers["Content-Encoding"] = "gzip";
    headers["Vary"] = "Accept-Encoding";
    res.writeHead(200, headers);
    res.end(file.gzipBody);
    return;
  }

  res.writeHead(200, headers);
  res.end(file.body);
}

async function handleApi(req, res, url) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return true;
  }

  if (url.pathname === "/api/health" && req.method === "GET") {
    sendJson(res, 200, getHealthStats());
    return true;
  }

  if (url.pathname === "/api/lookup" && req.method === "POST") {
    let body;
    try {
      body = await readBody(req);
    } catch {
      sendJson(res, 413, { ok: false, error: "body_too_large" });
      return true;
    }

    const clientKey = getClientKey(req, body);
    const rate = checkLookupRateLimit(clientKey);
    if (!rate.allowed) {
      sendJson(res, 429, { ok: false, error: "rate_limited", retryAfterSec: rate.retryAfterSec }, {
        "Retry-After": String(rate.retryAfterSec),
      });
      return true;
    }

    const word = (body.word || "").trim();
    if (!word || word.length < 2 || word.length > 64) {
      sendJson(res, 400, { ok: false, error: "invalid_word" });
      return true;
    }

    const result = await lookupWord(word, body.context || "");
    sendJson(res, 200, result);
    return true;
  }

  if (url.pathname === "/api/analytics/batch" && req.method === "POST") {
    let body;
    try {
      body = await readBody(req);
    } catch {
      sendJson(res, 413, { ok: false, error: "body_too_large" });
      return true;
    }

    const result = recordEventsBatch(body, body.events || []);
    sendJson(res, 202, result);
    return true;
  }

  if (url.pathname === "/api/analytics/event" && req.method === "POST") {
    let body;
    try {
      body = await readBody(req);
    } catch {
      sendJson(res, 413, { ok: false, error: "body_too_large" });
      return true;
    }

    recordEvent(body.publisher || "unknown", body);
    sendJson(res, 202, { ok: true });
    return true;
  }

  if (url.pathname === "/api/analytics/summary" && req.method === "GET") {
    const publisher = url.searchParams.get("publisher") || "";
    sendJson(res, 200, getAnalyticsSummary(publisher || null));
    return true;
  }

  if (url.pathname === "/api/analytics/article-glossary" && req.method === "GET") {
    const publisher = url.searchParams.get("publisher") || "";
    const articleUrl = url.searchParams.get("url") || "";
    if (!articleUrl) {
      sendJson(res, 400, { ok: false, error: "missing_url" });
      return true;
    }
    sendJson(res, 200, getArticleGlossary(publisher || null, articleUrl));
    return true;
  }

  if (url.pathname === "/api/vocabulary" && req.method === "GET") {
    const userId = url.searchParams.get("userId") || "anonymous";
    sendJson(res, 200, { ok: true, entries: getVocabulary(userId) });
    return true;
  }

  if (url.pathname === "/api/vocabulary" && req.method === "POST") {
    let body;
    try {
      body = await readBody(req);
    } catch {
      sendJson(res, 413, { ok: false, error: "body_too_large" });
      return true;
    }
    const userId = body.userId || "anonymous";
    const entry = saveVocabularyEntry(userId, body);
    sendJson(res, 200, { ok: true, entry });
    return true;
  }

  if (url.pathname === "/api/vocabulary/practice" && req.method === "PUT") {
    let body;
    try {
      body = await readBody(req);
    } catch {
      sendJson(res, 413, { ok: false, error: "body_too_large" });
      return true;
    }
    const entry = updatePracticeSentence(body.userId || "anonymous", body.entryId, body.practiceSentence || "");
    if (!entry) {
      sendJson(res, 404, { ok: false, error: "not_found" });
      return true;
    }
    sendJson(res, 200, { ok: true, entry });
    return true;
  }

  if (url.pathname.startsWith("/api/vocabulary/") && req.method === "DELETE") {
    const entryId = url.pathname.split("/").pop();
    const userId = url.searchParams.get("userId") || "anonymous";
    const deleted = deleteVocabularyEntry(userId, entryId);
    sendJson(res, deleted ? 200 : 404, { ok: deleted });
    return true;
  }

  if (url.pathname === "/api/analytics/reset" && req.method === "POST") {
    sendJson(res, 200, clearAnalytics());
    return true;
  }

  if (url.pathname === "/api/vocabulary/reset" && req.method === "POST") {
    sendJson(res, 200, clearAllVocabulary());
    return true;
  }

  if (url.pathname === "/api/demo/reset-all" && req.method === "POST") {
    sendJson(res, 200, clearAllDemoData());
    return true;
  }

  return false;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname.startsWith("/api/")) {
    const handled = await handleApi(req, res, url);
    if (handled) {
      return;
    }
    sendJson(res, 404, { ok: false, error: "not_found" });
    return;
  }

  let filePath;
  if (url.pathname === "/demo") {
    filePath = join(PUBLIC_DIR, "demo", "index.html");
  } else if (url.pathname === "/" || url.pathname === "/hub") {
    filePath = join(PUBLIC_DIR, "index.html");
  } else if (url.pathname === "/dashboard") {
    filePath = join(PUBLIC_DIR, "dashboard", "index.html");
  } else if (url.pathname.startsWith("/saved/")) {
    const name = decodeURIComponent(url.pathname.slice("/saved/".length));
    if (!name.includes("..") && name.endsWith(".html")) {
      filePath = join(PROJECT_ROOT, name);
    }
  } else {
    filePath = join(PUBLIC_DIR, url.pathname);
  }

  if (!filePath || !existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  sendFile(res, filePath, req);
});

server.listen(PORT, () => {
  console.log(`WordWise running at http://localhost:${PORT}`);
  console.log(`  Demo Hub:   http://localhost:${PORT}/`);
  console.log(`  Demo:       http://localhost:${PORT}/demo`);
  console.log(`  Hindu HTML: http://localhost:${PORT}/saved/demo_article_3.html`);
  console.log(`  Dashboard:  http://localhost:${PORT}/dashboard`);
  console.log(`  Widget:     http://localhost:${PORT}/widget/wordwise.js`);
  console.log(`  Health:     http://localhost:${PORT}/api/health`);

  if (process.env.PRELOAD_WORDNET === "true") {
    preloadWordNet()
      .then(() => console.log("  WordNet:    preloaded"))
      .catch((err) => console.warn("  WordNet preload failed:", err.message));
  }
});
