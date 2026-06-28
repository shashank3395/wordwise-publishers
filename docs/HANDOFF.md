# Session handoff — WordWise

Living document: **update this file** when you finish a major session so the next chat/agent knows where you stopped.

**Last updated:** 2026-06-28  
**Repo:** https://github.com/shashank3395/wordwise-publishers  
**Branch:** `main`

---

## Current phase

**v1 complete → deploy & pitch**

The codebase is demo-ready on localhost. The bottleneck is **public hosting + publisher outreach**, not feature work.

---

## Conversation arc (what we built)

### Phase 1 — Core product
- Embeddable widget (`public/widget/wordwise.js`), Node server, dashboard
- Analytics batching, rate limits, health endpoint
- Saved Hindu HTML demo (`demo_article_3.html`)

### Phase 2 — Performance & scale
- Client lookup cache, batched analytics, ring buffer
- Load test script, pre-aggregated dashboard stats

### Phase 3 — Glossary moat
- Layered engine: policy → static (VocabPro) → WordNet → remote
- Moved policy from hardcoded JS → JSON files
- ~72 policy terms (PRS fiscal, RBI monetary, VB-G RAM G editorial)
- 15 context disambiguation rules
- ~30 scheme acronyms (PMJAY, FCI, CAG, …)
- Phrase lookup (multi-word selection in widget)

### Phase 4 — Hindi layer
- `hindi-terms.json` (~50 curated newspaper terms)
- `npm run build:hindi` → Wiktionary index (~32,568 lemmas, ~5 MB)
- Devanagari selection + Hindi block in tooltip
- Roman fallback (`dharma` → `dharm`)

### Phase 5 — Bugfixes & polish
- **Context bleed fix:** words like `governments` / `karnataka` in a sentence containing `blackout period` no longer get wrong policy definitions (`wordRelatesToPhrase` in `policy.js`)
- Reset sync: dashboard clear → `localStorage` `wordwise_reset`
- Widget: `data-debug`, attribution footnote

### Phase 6 — Docs & GitHub
- Pilot proposal, deploy guide, attribution, enhancements backlog
- Pushed to GitHub; `.gitignore` fixed (glossary JSON now tracked)

---

## Decisions made (don't re-litigate)

| Decision | Rationale |
|----------|-----------|
| JSON policy layer, not hardcoded | Easier curation without code deploys |
| Hindi after acronyms/policy in engine | `niti` → NITI Aayog acronym beats Hindi "policy" |
| Commit built glossaries to git | Railway deploy works without network fetch |
| JSON file analytics (v1) | Fine for pilot; Postgres later |
| CORS `*` | Publisher embed on any domain |
| Target The Hindu editorials only for pilot | ~25% traffic, ~60 peak RPS |

---

## Known issues / limitations

- `governments` (plural) may 404 if not in WordNet — plural fallback not implemented
- Analytics/notebooks lost on cloud redeploy (no volume/DB)
- Demo reset endpoints open (`/api/demo/reset-all`) — gate before production
- Duplicate Hindu HTML file gitignored (keep `demo_article_3.html` only)
- AI4Bharat bulk Hindi (100k+) blocked — S3 dead

---

## Immediate next steps (priority order)

- [ ] Deploy to Railway ([DEPLOY.md](./DEPLOY.md))
- [ ] Smoke test: `blackout period`, `yojana`, `MGNREGA`, `fiscal deficit` on public URL
- [ ] `npm run load-test -- --url https://YOUR-URL`
- [ ] Update pilot doc with live URL
- [ ] Email / intro to The Hindu product team
- [ ] Weekly: `npm run mine:terms` → add 5–10 terms to `policy-terms.json`

---

## Backlog (not started)

See [lookup-remaining-enhancements.md](./lookup-remaining-enhancements.md). Top items:

- Policy glossary 72 → 200+ terms
- Dashboard suggested-glossary UI
- Postgres analytics
- Unit tests for lookup layer order + context rules
- AI4Bharat import when S3 works

---

## How to update this file

At end of each session, edit **Last updated**, **Current phase**, check off **Immediate next steps**, and add a bullet under **Conversation arc** if you shipped something new.

Then commit:

```bash
git add docs/HANDOFF.md AGENTS.md
git commit -m "docs: update session handoff"
git push
```

---

## For Cursor specifically

1. **AGENTS.md** at repo root — read automatically in many agent flows  
2. **`.cursor/rules/`** — always-on project rule points here  
3. **@ mention** in new chat: `@AGENTS.md` or `@docs/HANDOFF.md`  
4. Cursor does **not** persist full chat history across projects — **repo docs are the source of truth**
