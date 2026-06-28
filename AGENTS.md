# Agent context — WordWise

**Read this first** when opening this repo in a new Cursor chat or with a fresh agent.

## Project in one sentence

B2B **in-article dictionary widget** for Indian news publishers (pitch: **The Hindu**) — layered glossary moat, analytics dashboard, UPSC notebook.

## Status (as of 2026-06-28)

| Area | State |
|------|--------|
| **v1 product** | ✅ Complete — demo-ready |
| **GitHub** | https://github.com/shashank3395/wordwise-publishers |
| **Cloud deploy** | ❌ Not done — next step is Railway ([docs/DEPLOY.md](docs/DEPLOY.md)) |
| **Publisher outreach** | ❌ Pilot doc ready, not sent |

## Where we left off

1. **Shipped:** policy JSON layer, Hindi (~32k Wiktionary + 50 curated), phrase lookup, context-rule bugfix (unrelated words no longer get `blackout period` defs), miner, load test, pilot doc, full docs, pushed to GitHub.
2. **Next human actions:** Deploy to Railway → smoke-test public URL → email Hindu with [pilot-proposal-the-hindu.md](docs/pilot-proposal-the-hindu.md).
3. **Do not rebuild** unless glossary sources change: `data/glossary/*.json` is committed (~6 MB).

## Key commands

```bash
npm install && npm start          # http://localhost:3847
npm run build:all                 # only if glossaries missing
npm run mine:terms                # find missing terms in Hindu HTML
npm run load-test -- --url URL    # RPS test
```

## Lookup engine order

`engine.js`: cache → acronyms → policy direct → policy context → **hindi** → static → wordnet → remote.

**Important:** `findGlossaryMatch` / context rules must only apply phrases when the **selected word relates to the phrase** (`wordRelatesToPhrase` in `policy.js`). Regression test: `governments`, `karnataka` in a sentence with `blackout period` must NOT get blackout definitions.

## Critical files

| File | Why |
|------|-----|
| `public/widget/wordwise.js` | Widget UI, selection, tooltip, analytics |
| `api/glossary/engine.js` | Lookup orchestration |
| `api/glossary/policy.js` | JSON loaders + context rules |
| `api/glossary/hindi.js` | Curated + `hindi-index.json` |
| `data/glossary/policy-terms.json` | PRS/RBI/editorial moat |
| `data/glossary/context-rules.json` | Disambiguation |
| `demo_article_3.html` | Hindu demo at `/saved/demo_article_3.html` |

## Conventions

- Minimize diff scope; match existing patterns in `api/glossary/`.
- Policy/Hindi content lives in **JSON**, not hardcoded in JS.
- Curated layers beat bulk indexes (curated > policy > hindi bulk > static).
- Do not commit `data/analytics.json` or `data/vocabulary.json` (gitignored).
- Do not commit secrets. No force-push to `main`.
- Verify with `node -e "import { lookupWord } from './api/glossary/engine.js'..."` or curl `/api/lookup` before claiming fixes work.

## Doc map

| Doc | Use when |
|-----|----------|
| [docs/HANDOFF.md](docs/HANDOFF.md) | Detailed session history & decisions |
| [docs/PROJECT-OVERVIEW.md](docs/PROJECT-OVERVIEW.md) | Full v1 feature list |
| [docs/lookup-remaining-enhancements.md](docs/lookup-remaining-enhancements.md) | Backlog checkboxes |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Railway / cloud |
| [docs/pilot-proposal-the-hindu.md](docs/pilot-proposal-the-hindu.md) | Sales pitch |
| [docs/ATTRIBUTION.md](docs/ATTRIBUTION.md) | Data licenses |

## Blocked / external

- AI4Bharat IndoWordNet S3 zips return 403 (2026-06) — cannot bulk-import 852k en-hi yet.
- VocabPro commercial license unverified for Hindu sale.

## User intent arc

User is building a **sellable publisher product**, not a browser extension. Optimized for Hindu traffic (~40–60 peak RPS editorial pilot). Moat = Indian policy/legal/Hindi glossary + context rules, not generic dictionary API.
