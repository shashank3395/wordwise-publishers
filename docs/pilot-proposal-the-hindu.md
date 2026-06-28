# WordWise × The Hindu — Pilot Proposal (1 page)

**Prepared:** June 2026  
**Product:** In-article word meaning widget + publisher analytics  
**Pilot scope:** Editorials and long-form policy pieces (~25% of pageviews)

---

## Problem

Readers leave The Hindu for Google when they hit policy jargon (*blackout period*, *fiscal deficit*, *VB-G RAM G*). That breaks reading flow, loses ad impressions, and sends UPSC traffic to third-party dictionary sites.

## Solution

One script tag embeds **WordWise** — select or double-click any word/phrase for instant definitions, **“In this article”** context for Indian policy terms, and an optional **UPSC vocabulary notebook**.

```html
<script src="https://cdn.wordwise.example/widget/wordwise.js"
  data-publisher="thehindu"
  data-api="https://api.wordwise.example"
  data-context="true"
  data-theme-color="#c0392b"
  defer></script>
```

## Why now (moat)

| Layer | Coverage |
|-------|----------|
| Policy JSON | 50+ fiscal/monetary terms (PRS/RBI), 30 scheme acronyms, 15 context rules |
| VocabPro static | ~4,000 editorial words, 1,100+ idioms/phrases |
| WordNet + Wiktionary | Fallback for general English |

**Example:** *blackout* in a rural employment piece → WordWise explains scheme suspension, not a power cut.

## Pilot metrics (90 days)

| Metric | Target |
|--------|--------|
| Lookup success rate | >85% on editorial corpus |
| Context hit rate | >30% on policy articles |
| Tab-switch reduction | Measurable vs. control (A/B on 10% traffic) |
| Notebook saves | Track UPSC engagement funnel |

## Traffic & capacity (editorial-only)

| Assumption | Value |
|------------|-------|
| Hindu monthly visits | ~33–70M |
| Editorial share | ~25% |
| Peak concurrent readers | ~2,000–4,000 |
| Lookups per reader session | ~0.3–0.5 |
| **Estimated peak lookup RPS** | **~40–60** |

**Stack today:** batched analytics, 60 lookups/min/session rate limit, in-memory cache, layered local glossary (no LLM on hot path). Load-tested with `npm run load-test` at 30–60 RPS on a single Node instance.

## What The Hindu gets

1. **Retention** — definitions without leaving the page  
2. **UPSC wedge** — notebook + practice sentences for subscriber upsell  
3. **Editorial intelligence** — “847 readers looked up *blackout period* on this piece”  
4. **Zero CMS work** — works on archive articles retroactively  

## Ask

- **8-week pilot** on editorials + select national/policy sections  
- Staging embed on `thehindu.com` subpath or feature flag  
- Weekly glossary refresh (5–10 terms from your corpus)  
- Joint readout: retention, lookup heatmap, top confused terms  

## Contact

WordWise team — demo: `http://localhost:3847/demo` (replace with production URL on deploy)
