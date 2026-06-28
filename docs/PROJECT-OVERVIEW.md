# WordWise — Project overview (v1)

**Product:** B2B in-article word-meaning widget for news publishers (pitch target: The Hindu).  
**Status:** v1 complete for demo + pilot pitch. Not production-hardened (no DB, no CDN split).

---

## What it does

1. **Reader** selects or double-clicks a word/phrase in an article → instant definition tooltip  
2. **Context layer** explains Indian policy jargon *in this article* (e.g. *blackout period* ≠ power cut)  
3. **Hindi layer** shows Devanagari + English for newspaper Hindi terms (*yojana*, *gramin*, *सरकार*)  
4. **UPSC student** saves words to a session notebook with practice sentences  
5. **Publisher** sees analytics: lookups, top confused words, sessions  

One script tag embed — no CMS changes.

---

## Architecture

```
Browser (publisher site)
  └── wordwise.js (shadow DOM widget)
        └── POST /api/lookup, /api/analytics/batch, /api/vocabulary

server.js (Node 18+)
  └── api/store.js          analytics + vocabulary (JSON files)
  └── api/glossary/engine.js
        0. cache
        1. acronyms       scheme-acronyms.json + policy acronyms
        2. policy direct  policy-terms.json (phrases/terms)
        3. policy context context-rules.json (disambiguation)
        4. hindi          hindi-terms.json → hindi-index.json (~32k)
        5. static         static-index.json (VocabPro ~4k)
        6. wordnet        local npm package
        7. remote         Wiktionary / dictionary API fallback
```

---

## Repository layout

| Path | Role |
|------|------|
| `public/widget/wordwise.js` | Embeddable client |
| `public/dashboard/` | Publisher analytics UI |
| `public/demo/` | Demo article shell |
| `server.js` | HTTP server + routing |
| `api/glossary/` | Lookup engine modules |
| `data/glossary/*.json` | Glossary moat (committed for deploy) |
| `scripts/build-*.mjs` | Build static + Hindi indexes |
| `scripts/mine-hindu-terms.mjs` | Find missing terms in saved HTML |
| `scripts/load-test-lookup.mjs` | RPS smoke test |
| `demo_article_3.html` | Saved Hindu article (`/saved/demo_article_3.html`) |

---

## v1 features shipped

### Core
- Widget: select word/phrase, double-click, Define button, tooltip, FAB notebook  
- Multi-word phrase lookup (2–8 words)  
- Devanagari selection support  
- Batched analytics, client lookup cache, rate limit (60/min/session)  
- Dashboard with aggregates, reset (broadcasts to open article tabs)  

### Glossary moat
- **Policy JSON:** ~72 terms/phrases (PRS fiscal, RBI monetary, VB-G RAM G editorial)  
- **Context rules:** 15 disambiguation rules (`blackout`, `repo`, `sanction`, …)  
- **Scheme acronyms:** ~30 (PMJAY, PMAY, FCI, CAG, …)  
- **Static editorial:** VocabPro build (~4k words, 1k+ idioms)  
- **Hindi:** 50 curated + 32k Wiktionary index  
- **Bugfix:** policy phrases no longer attach to unrelated words in same sentence  

### Ops & docs
- `/api/health`, `PRELOAD_WORDNET` env  
- `data-debug`, attribution footnote  
- Pilot proposal, deploy guide, attribution doc, enhancements backlog  

---

## NPM scripts

```bash
npm start              # http://localhost:3847
npm run build:glossary # VocabPro → static-index.json
npm run build:hindi    # Wiktionary → hindi-index.json
npm run build:all      # both
npm run mine:terms     # Hindu HTML term miner
npm run load-test      # /api/lookup load test
```

---

## Local URLs

| URL | Purpose |
|-----|---------|
| http://localhost:3847/demo | Demo article |
| http://localhost:3847/saved/demo_article_3.html | Real Hindu HTML |
| http://localhost:3847/dashboard | Analytics |
| http://localhost:3847/api/health | Health + glossary stats |

---

## Known v1 limitations

| Limitation | Workaround / v2 |
|------------|-----------------|
| Analytics/notebooks in JSON | Lost on redeploy; use Postgres post-pilot |
| AI4Bharat 852k en-hi glossaries | S3 URLs dead; Wiktionary Hindi used instead |
| No CDN split | Widget + API same origin (fine for pilot) |
| Demo reset endpoints open | Gate in production |
| VocabPro commercial license | Verify before Hindu sale |
| Hindu HTML copyright | Demo only; partnership for production miner |

---

## Recommended next steps (after GitHub push)

1. **Deploy** → [`DEPLOY.md`](./DEPLOY.md) (Railway ~$5/mo)  
2. **Smoke test** production URL (policy + Hindi lookups)  
3. **Send pilot** → [`pilot-proposal-the-hindu.md`](./pilot-proposal-the-hindu.md)  
4. **Weekly:** `npm run mine:terms` → add 5–10 terms to `policy-terms.json`  
5. **Backlog** → [`lookup-remaining-enhancements.md`](./lookup-remaining-enhancements.md)  

---

## Doc index

| Document | Contents |
|----------|----------|
| [README.md](../README.md) | Quick start, API, embed |
| [DEPLOY.md](./DEPLOY.md) | Railway / cloud hosting |
| [pilot-proposal-the-hindu.md](./pilot-proposal-the-hindu.md) | 1-page Hindu pitch |
| [lookup-remaining-enhancements.md](./lookup-remaining-enhancements.md) | Backlog + priorities |
| [GLOSSARY-MOAT-PLAN.md](./GLOSSARY-MOAT-PLAN.md) | Content investment plan |
| [ATTRIBUTION.md](./ATTRIBUTION.md) | Third-party data licenses |

---

## Traffic estimate (editorial pilot)

- Hindu ~33–70M monthly visits  
- Editorials ~25% of traffic  
- Estimated peak lookup RPS after optimizations: **~40–60** (single Node instance sufficient for pilot)

---

*Last updated: 2026-06-28 — WordWise v1*
