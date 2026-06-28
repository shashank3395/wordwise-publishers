/** Lightweight rate limiting and request guards — no external deps */

const LOOKUP_LIMIT_PER_MIN = 60;
const LOOKUP_WINDOW_MS = 60_000;
const MAX_BODY_BYTES = 64 * 1024;

const lookupBuckets = new Map();

export function getClientKey(req, body = {}) {
  return body.sessionId || req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
}

export function checkLookupRateLimit(key) {
  const now = Date.now();
  let bucket = lookupBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + LOOKUP_WINDOW_MS };
    lookupBuckets.set(key, bucket);
  }
  bucket.count += 1;
  if (lookupBuckets.size > 50_000) {
    const cutoff = now - LOOKUP_WINDOW_MS;
    for (const [k, b] of lookupBuckets) {
      if (b.resetAt < cutoff) {
        lookupBuckets.delete(k);
      }
    }
  }
  if (bucket.count > LOOKUP_LIMIT_PER_MIN) {
    return { allowed: false, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { allowed: true };
}

export async function readBody(req, maxBytes = MAX_BODY_BYTES) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) {
      throw new Error("body_too_large");
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
