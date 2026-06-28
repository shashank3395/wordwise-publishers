#!/usr/bin/env node
/**
 * Simple load test for POST /api/lookup
 *
 * Usage:
 *   node scripts/load-test-lookup.mjs
 *   node scripts/load-test-lookup.mjs --rps 30 --duration 10 --url http://localhost:3847
 */

const args = process.argv.slice(2);
function getArg(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

const BASE_URL = getArg("--url", "http://localhost:3847");
const RPS = Number(getArg("--rps", "30"));
const DURATION_SEC = Number(getArg("--duration", "10"));

const SAMPLE_WORDS = [
  "blackout",
  "fiscal deficit",
  "repo rate",
  "mgnrega",
  "crore",
  "bargaining power",
  "interim allocation",
  "crr",
  "subsidy",
  "devolution",
];

const CONTEXT =
  "States flagged reservations about the wage bill and interim allocation under VB-G RAM G during the blackout period.";

let sent = 0;
let ok = 0;
let fail = 0;
let latencies = [];

async function oneLookup() {
  const word = SAMPLE_WORDS[Math.floor(Math.random() * SAMPLE_WORDS.length)];
  const start = performance.now();
  try {
    const res = await fetch(`${BASE_URL}/api/lookup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word, context: CONTEXT }),
    });
    const data = await res.json();
    latencies.push(performance.now() - start);
    if (data.ok) {
      ok += 1;
    } else {
      fail += 1;
    }
  } catch {
    fail += 1;
    latencies.push(performance.now() - start);
  }
  sent += 1;
}

function percentile(arr, p) {
  if (!arr.length) {
    return 0;
  }
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

console.log(`Load test: ${RPS} RPS for ${DURATION_SEC}s → ${BASE_URL}/api/lookup`);

const intervalMs = 1000 / RPS;
const endAt = Date.now() + DURATION_SEC * 1000;

const timer = setInterval(() => {
  if (Date.now() >= endAt) {
    clearInterval(timer);
    return;
  }
  oneLookup();
}, intervalMs);

await new Promise((r) => setTimeout(r, DURATION_SEC * 1000 + 500));
clearInterval(timer);

const elapsed = DURATION_SEC;
const actualRps = (sent / elapsed).toFixed(1);

console.log("\n--- Results ---");
console.log(`Requests:  ${sent}`);
console.log(`OK:        ${ok}`);
console.log(`Failed:    ${fail}`);
console.log(`Actual RPS: ${actualRps}`);
console.log(`Latency p50: ${percentile(latencies, 50).toFixed(0)} ms`);
console.log(`Latency p95: ${percentile(latencies, 95).toFixed(0)} ms`);
console.log(`Latency p99: ${percentile(latencies, 99).toFixed(0)} ms`);
