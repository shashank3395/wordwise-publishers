# WordWise — Remaining Enhancements

Tracking file for work discussed in this project but **not yet done** (or only partially done).  
Update this file as items ship.

**Last reviewed:** 2026-06-28

---

## Glossary engine (current)

Lookup order in `api/glossary/engine.js`:

| # | Layer | Source | ~Size |
|---|--------|--------|-------|
| 0 | Cache | In-memory | 10k TTL |
| 1 | Curated acronyms | `policy-terms.json` + `scheme-acronyms.json` | ~37 |
| 2 | Policy (direct) | `policy-terms.json` phrases/terms | ~72 |
| 3 | Policy (context) | `context-rules.json` + context-aware terms | 15 rules |
| 4 | Hindi | `hindi-terms.json` → `hindi-index.json` | 50 curated + **32k** Wiktionary |
| 5 | Static editorial | `static-index.json` (VocabPro) | ~4k words + idioms |
| 6 | WordNet | Local lazy | ~140k |
| 7 | Remote | Wiktionary / dictionaryapi.dev | API fallback |

Policy/static hits can be **enriched** with Hindi script from the Hindi layer (`crore` → करोड़).

---

## Already shipped

### Core product
- Embeddable widget, demo, dashboard, Hindu saved HTML (`/saved/demo_article_3.html`)
- Analytics batching, rate limits, `/api/health`, pre-aggregated stats
- Widget: client lookup cache, batched analytics, unload-only `time_on_page`, debounced selection

### Glossary moat
- Policy JSON: `policy-terms.json`, `context-rules.json`, `scheme-acronyms.json`
- PRS fiscal (~35) + RBI monetary (~20) + editorial policy terms; domain tags
- Phrase lookup in widget (2–8 words) + static `p`/`o` index first in static layer
- **Context-rule fix:** policy phrases no longer attach to unrelated words in the same sentence (e.g. `governments`, `karnataka` vs `blackout period`)
- VocabPro static index: `npm run build:glossary` → `static-index.json`

### Hindi dictionary
- Curated newspaper terms: `data/glossary/hindi-terms.json` (~50)
- Bulk Wiktionary Hindi index: `npm run build:hindi` → `hindi-index.json` (**32,568** lemmas, **54,651** roman keys, ~5 MB)
- Devanagari selection in widget; Hindi block in tooltip (`data-hindi="true"`, default on)
- Roman spelling fallback (`dharma` → `dharm`)
- Build: `npm run build:all` = glossary + hindi

### Tooling & ops
- Hindu term miner: `npm run mine:terms`
- Load test: `npm run load-test`
- `PRELOAD_WORDNET=true` on server start
- Widget: attribution, `data-debug` source line, reset sync (`wordwise_reset` / `localStorage`)
- Pilot doc: [`docs/pilot-proposal-the-hindu.md`](./pilot-proposal-the-hindu.md)
- README: API table, architecture, env vars

---

## Blocked / external dependency

| Item | Blocker | Notes |
|------|---------|-------|
| AI4Bharat IndoWordNet / Bharatavani bulk import | S3 URLs return 403/error (2026-06) | [`Indic-Glossaries`](https://github.com/AI4Bharat/Indic-Glossaries) lists 852k en-hi; wire into `build-hindi-glossary.mjs` when links work |
| 100k+ Hindi pairs | Same as above | Wiktionary Hindi (~32k) is current best static source |

---

## 1. Glossary & content moat

### Curated policy / legal / economic layer

- [ ] Expand **policy glossary** from ~72 terms → **200+** (ongoing curation + miner queue)
- [x] Domain tags per entry (`economics`, `polity`, `legal`, `governance`, `editorial`)
- [x] Policy terms in JSON + `policy.js` matchers only
- [ ] **50+ context-disambiguation rules** — 15 shipped
- [x] Phrase lookup in widget + static `p`/`o` priority
- [x] PRS fiscal + RBI monetary + DoRD/CAG scheme acronyms
- [ ] **Weekly freshness loop**: PRS Bills + Hindu editorials → 5–10 terms/week
- [ ] **Seasonal packs**: Budget (Feb), Monsoon session, election year
- [ ] Verify **VocabPro license** for commercial Hindu sale; document in README

### Hindi layer

- [x] Curated Hindi newspaper terms (`hindi-terms.json`)
- [x] Bulk static Hindi index from Wiktionary (`build:hindi`, ~32k)
- [x] Devanagari + romanized lookup in widget
- [x] Hindi script block in tooltip
- [ ] **Subscriber-only gate** for Hindi block (`data-subscriber="true"`) — currently shown to all when `data-hindi="true"`
- [ ] Merge **AI4Bharat news/parliamentary** domains when S3 restored (~7k news + general subset)
- [ ] Hindi in **notebook export** and end-of-article glossary chips
- [ ] Document Wiktionary Hindi **CC BY-SA** in README attribution line

### Static dictionary expansions

- [ ] Compact **Kaikki** English subset (~8k editorial words)
- [ ] PRS / official term **import script** (separate from VocabPro build)
- [ ] Document acronym merge rules (curated > scheme > static `a`)
- [ ] Synonyms / Hindi gloss on static tuples (optional field)

### Content mining

- [x] Hindu HTML term miner (`npm run mine:terms`)
- [ ] Dashboard **suggested glossary** tab (miner + analytics `not_found`)
- [ ] PendulumEdu / EditorialWords frequency cross-reference

### Human curation

- [ ] Blackbook top-100 vs Hindu editorials overlap
- [ ] Samundramanthan root-cluster tags in tooltip
- [ ] Policy editor workflow: draft → approve → deploy JSON

---

## 2. Product & widget

- [x] Hindi gloss in tooltip (all users; not subscriber-gated yet)
- [x] Lookup source in tooltip (`data-debug="true"`)
- [ ] **Compare line** polish for more non-policy hits
- [x] Session glossary reset sync with dashboard
- [ ] Notebook: practice sentence UX, spaced repetition
- [ ] End-of-article glossary with **domain chips**
- [ ] Coach mark / onboarding A/B for Hindu brand
- [ ] Plural fallback (`governments` → `government`) when WordNet misses

---

## 3. Dashboard & analytics

- [ ] Top confused words **by domain**
- [ ] Engagement funnel: pageview → lookup → save
- [ ] Export analytics CSV for pitch
- [ ] Suggested glossary queue from lookup failures
- [ ] Pause dashboard refresh when tab hidden (verify parity with widget)

---

## 4. Performance & scale

### Done
- [x] Analytics batch, ring buffer, aggregates
- [x] Lookup rate limit (60/min/session)
- [x] Dictionary circuit breaker + WordNet lazy load
- [x] Load test script (`npm run load-test`)
- [x] `PRELOAD_WORDNET=true`

### Remaining
- [ ] Document load-test results in pitch deck (production URL)
- [ ] Self-host Wiktionary (Wiktapi SQLite) for English fallback
- [ ] **Redis** shared lookup cache (multi-instance)
- [ ] **Postgres / ClickHouse** for analytics (replace `analytics.json`)
- [ ] Widget on publisher CDN; API-only origin
- [ ] Lazy-load or mmap `hindi-index.json` if memory becomes an issue (~5 MB parse at startup)

---

## 5. Deployment & ops

- [ ] Deploy **Railway / Fly.io / Render** — public URL for Hindu pitch
- [x] Env: `PORT`, `PRELOAD_WORDNET`
- [ ] **CI**: `npm run build:all` + smoke test `/api/lookup` on release
- [ ] Health alerts: `remote.circuitOpen`, `pendingAnalytics` spike
- [x] Widget attribution footnote (add Hindi Wiktionary CC BY-SA explicitly)

---

## 6. Publisher / business (The Hindu)

- [x] 1-page pilot proposal markdown
- [ ] Pilot deck slide (editorials ~25% traffic, ~60 peak RPS)
- [ ] Production embed snippet + CDN URL
- [ ] SSO / subscriber gate for notebook upsell
- [ ] Legal: Hindu HTML copyright for miner (partnership)

---

## 7. API & code cleanup

- [x] README API table + layered lookup docs
- [ ] Update `GLOSSARY-MOAT-PLAN.md` baseline (policy JSON + Hindi index shipped)
- [ ] Unit tests: `lookupWord` layer order, context rules, Hindi roman fallback, phrase≠word bug regression
- [ ] Gate demo reset endpoints in production
- [ ] Optional LLM context (`OPENAI_API_KEY`) for ambiguous hits only

---

## 8. Nice-to-have / later

- [ ] Full Kaikki English pipeline (2.5 GB)
- [ ] AI4Bharat Indic-Glossaries bulk (when S3 live)
- [ ] Browser extension (out of B2B scope)
- [ ] Mobile SDK / WebView for UPSC partners
- [ ] Offline PWA + cached glossaries

---

## Suggested order (next 2–3 weeks)

| Priority | Focus | Why |
|----------|--------|-----|
| **1** | Smoke-test `demo_article_3.html` + fix miner top-10 gaps | Product truth before pitch |
| **2** | Deploy public demo URL | Can't send localhost to The Hindu |
| **3** | Run `npm run load-test` on deploy; note p95 in pilot doc | Capacity story |
| **4** | Send pilot proposal + staging embed | Revenue path |
| **5** | Expand policy to 200 terms + dashboard glossary queue | Moat depth |
| **6** | CI + unit tests for lookup layers | Don't regress context/Hindi bugs |

---

## Quick commands

```bash
npm run build:all             # VocabPro static + Wiktionary Hindi
npm run mine:terms            # Hindu HTML → missing-term queue
npm run load-test             # /api/lookup RPS test
PRELOAD_WORDNET=true npm start
curl http://localhost:3847/api/health
```

## Key data files

| File | Built by | Purpose |
|------|----------|---------|
| `data/glossary/static-index.json` | `build:glossary` | VocabPro editorial (~860 KB) |
| `data/glossary/hindi-index.json` | `build:hindi` | Wiktionary Hindi (~5 MB) |
| `data/glossary/hindi-terms.json` | manual | Curated newspaper Hindi (overrides bulk) |
| `data/glossary/policy-terms.json` | manual | PRS/RBI/editorial policy |
| `data/glossary/context-rules.json` | manual | Disambiguation (blackout, repo, …) |
| `data/glossary/scheme-acronyms.json` | manual | DoRD/CAG schemes |

## Related docs

- [`docs/GLOSSARY-MOAT-PLAN.md`](./GLOSSARY-MOAT-PLAN.md) — 90-day content plan
- [`docs/pilot-proposal-the-hindu.md`](./pilot-proposal-the-hindu.md) — Hindu pilot 1-pager
- [`README.md`](../README.md) — setup, embed, API
