# WordWise Glossary Moat — Investment Plan

**Goal:** Build a curated Indian policy / legal / economic / editorial glossary with **context rules that beat Google** — content + domain expertise, not just code.

**Current baseline:** ~15 policy terms + ~5 acronyms in `api/store.js` (demo-grade).

**Target (90 days):** 200+ policy terms, 80+ acronyms, 50+ context-disambiguation rules, domain-tagged and sourced.

---

## What creates the moat

| Layer | Google | WordWise |
|-------|--------|----------|
| Definition | Generic dictionary | Short, exam-grade definition |
| Context | None | “In this article, it means…” |
| Disambiguation | Wrong domain often | Regex / phrase rules (e.g. *blackout period* ≠ power cut) |
| Acronyms | Often missing | Full form + scheme role |
| Freshness | Static | Weekly updates from editorials + Bills |

---

## Domain taxonomy (prioritize by Hindu reader need)

Track and tag every glossary entry under one or more domains. Use analytics (“top confused words”) to weight investment.

| Domain | Examples from Hindu editorials | Primary sources |
|--------|-------------------------------|-----------------|
| **Economics** | fiscal deficit, devolution, cess, repo rate, core inflation, twin deficit | RBI, PRS Budget primer, Economic Survey |
| **Polity / Legal** | contempt, judicial review, ordinance, money bill, federalism, reservation (objection sense) | PRS, Nyaaya, India Code, legal glossaries |
| **International Relations** | sanctions regime, détente, QUAD, multilateralism, extradition | Hindu IR editorials, MEA terminology |
| **General Editorial English** | proscribe, nascent, interminable, onerous, axiomatic | Daily vocab platforms (for *frequency*, not copy) |
| **Governance / Schemes** | MGNREGA, VB-G RAM G, funding pattern, wage bill, blackout period | DoRD, PIB, data.gov.in, scheme PDFs |

**Product tie-in:** Dashboard can eventually show “top confused words by domain” — pitch material for The Hindu (“40% of lookups on your editorials are Economics jargon”).

---

## Resource map

### Tier 1 — Authoritative (definitions & acronyms)

| Resource | Use for | Link |
|----------|---------|------|
| PRS Primers & Bill summaries | Budget, legislature, policy plain English | [prsindia.org/policy/primers](https://prsindia.org/policy/primers) |
| PRS Union Budget Primer | Fiscal / revenue / appropriation terms | [PDF](https://prsindia.org/files/budget/Union_Budget_Primer.pdf) |
| RBI Data Definitions & Glossaries | Monetary, banking, NDTL, MPC | [DataDefinition](https://rbi.org.in/scripts/DataDefinition.aspx), [Glossary](https://www.rbi.org.in/scripts/Glossary.aspx) |
| MoSPI Compendium | Admin / statistical terminology | [2025 PDF](https://www.mospi.gov.in/uploads/announcements/announcements_1769778908344_7ee8297b-535c-4256-b8c6-06c5b95f7685_Compendium_of_Datasets_and_Registries_in_India,_2025.pdf) |
| DoRD / ministry scheme reports | Scheme acronyms (MGNREGA, PMAY-G, etc.) | [DoRD PDF](https://www.dord.gov.in/static/uploads/2025/10/229c3ea2f68afe9f9f566e07bcbd199e.pdf) |
| CAG Abbreviations | Cross-ministry acronyms | [CAG PDF](https://cag.gov.in/uploads/download_audit_report/2023/14-Abbreviations-064d229f84b94c2.31817287.pdf) |
| data.gov.in | Official scheme descriptions | [MGNREGA catalog](https://www.data.gov.in/catalog/mahatma-gandhi-national-rural-employment-guarantee-act-mgnrega) |
| CSTT / e-mahashabdkosh | Govt-standard admin terminology | [cstt.education.gov.in](https://www.cstt.education.gov.in/en) |

### Tier 2 — Legal & plain language

| Resource | Use for | Link |
|----------|---------|------|
| Nyaaya (Vidhi) | Plain-language law explainers — tone & structure model | [nyaaya.org](https://nyaaya.org/) |
| Vidhi SARAL Manual | Rewriting legalese for readers | [SARAL Manual](https://vidhilegalpolicy.in/research/the-saral-manual/) |
| Income Tax Legal Glossary | Court-defined legal terms (~1,500) | [PDF](https://www.incometaxindia.gov.in/documents/943497/3984542/englishlegal-glossary.pdf) |
| Legal & governance books (see below) | Polity terms, committees, judgments | Purchase + human curation |

### Tier 3 — Dedicated websites & apps (Hindu-aligned frequency)

Use for **word discovery and prioritization**, not as primary definition sources (licensing + quality vary).

| Resource | What it provides | How WordWise uses it |
|----------|------------------|----------------------|
| **The Hindu Vocab** ([thehinduvocab.com](https://www.thehinduvocab.com/)) | Daily editorial word batches, Hindi meanings, quizzes | Mine *which words* appear; write original context rules |
| **UPSC CSE Vocabulary & Practice App** (Play Store) | Mobile drills on newspaper-derived words | Benchmark feature set (notebook, practice); term list ideas |
| **Hindu Vocab App** (zerosound) | Daily editorial words, idioms, phrasal verbs | Frequency signal for General Editorial English tier |
| PracticeMock / Testbook / AmbitiousBaba | Daily Hindu editorial vocab PDFs | Cross-check recurring words across days |

**Rule:** Coaching platforms and apps → **priority queue**. Official sources (PRS, RBI) → **definition text**.

### Tier 4 — Web portals & daily analysis

| Resource | Strength | Link |
|----------|----------|------|
| **PendulumEdu — The Hindu Editorial Vocab** | Contextual use of words *in the sentence* + Hindi equivalents | [pendulumedu.com/english-vocabulary/the-hindu-editorial-vocab](https://pendulumedu.com/english-vocabulary/the-hindu-editorial-vocab) |
| **EditorialWords** | 100+ words/day, lead articles, phrasal verbs, PDF lists | [editorialwords.com](https://www.editorialwords.com/) |
| PracticeMock, Testbook | Daily PDFs, exam-oriented | See Tier 3 |

**Best practice from PendulumEdu to copy in product:** explain the word **as used in that editorial sentence** — same UX as WordWise “In this article” block.

**EditorialWords:** Strong for volume lists (General Editorial English); many PDFs are paid — use public word-of-the-day / editorial posts for mining only.

### Tier 5 — Specialized books & glossaries

| Book / resource | Focus | WordWise role |
|-----------------|-------|---------------|
| **Blackbook of English Vocabulary** (Nikhil Gupta) | Bilingual EN–HI; repeated editorial words for UPSC, SSC, Banking | High-frequency editorial word list; Hindi hint optional in notebook |
| **Samundramanthan of Vocabulary** (Rani Singh) | Roots, phrases, thousands of CA/editorial words | Root-based clusters (e.g. *pro-*, *anti-*, *inter-*); phrase glossary |
| **Legal Glossary** / committees & judgments publications | Polity, legal, governance | Polity/Legal domain entries + disambiguation |

**Licensing:** Do not reproduce book definitions verbatim. Use books to (1) rank terms, (2) inspire original one-line explanations, (3) optional Hindi gloss in subscriber mode.

---

## Context rules (hardest to copy)

Invest equally in **rules** and **entries**.

| Rule type | Example |
|-----------|---------|
| Phrase-first | `blackout period`, `funding pattern`, `vote on account` |
| Regex disambiguation | `blackout` + `/scheme\|agricultural\|season/` → employment pause |
| Anti-pattern | `blackout` + `/power\|electricity/` → do not apply policy gloss |
| Acronym + context | `RTI` + `/ministry\|filed\|application/` |
| Seasonal packs | Budget (Feb), Monsoon session, election year |
| Comparison line | “Dictionary: X. In Indian policy reporting: Y.” |

**Training corpus:** Saved Hindu HTML (`demo_article_3.html`), PRS Bill summaries, PIB releases, Budget speech.

---

## Data architecture (when scaling beyond `store.js`)

```
data/glossary/
  acronyms.json         # fullForm, definition, ministries[], source
  policy-terms.json     # term, definition, domain[], source, updated
  editorial-terms.json  # general English, frequency, optional hindi
  context-rules.json    # triggers[], avoidIf[], explanation template
```

Entry shape:

```json
{
  "term": "blackout period",
  "domains": ["governance", "rural"],
  "definition": "Mandated non-working days under a rural employment scheme…",
  "triggers": ["blackout period", "non-working days", "agricultural season"],
  "avoidIf": ["power", "electricity", "internet"],
  "source": "PRS / DoRD / Hindu VB-G RAM G coverage",
  "priority": "high",
  "updated": "2026-03"
}
```

---

## 90-day execution plan

### Phase 1 — Foundation (weeks 1–4)

| Task | Source | Output |
|------|--------|--------|
| Extract PRS + RBI core terms | Tier 1 | ~80 Economics + governance terms |
| Extract DoRD / CAG acronyms | Tier 1 | ~50 acronyms |
| Tag all entries by domain | Taxonomy above | CSV / JSON |
| Cross-index Blackbook top 100 (manual) | Tier 5 | Editorial priority list |

### Phase 2 — Hindu calibration (weeks 5–8)

| Task | Source | Output |
|------|--------|--------|
| Mine 30 editorials (saved HTML + EditorialWords titles) | Tier 3–4 | Frequency-ranked word list |
| Write context rules for top 50 confused terms | PendulumEdu-style sentence rules | `context-rules.json` |
| Add 10 acronym packs (rural, RBI, legal, IR) | Tier 1 + books | Domain bundles |
| Enable analytics → “suggested glossary” from lookups | Product | Weekly editor queue |

### Phase 3 — Freshness & moat (weeks 9–12)

| Task | Output |
|------|--------|
| Weekly: 5 Hindu editorials + PRS new Bills | 5–10 new terms/week |
| Monthly: EditorialWords / Pendulum “word of the week” cross-check | Stay aligned with aspirant demand |
| Seasonal: Budget pack, election pack | Timely pitch to publisher |
| Optional: Hindi gloss for subscriber notebook | Blackbook-aligned UPSC wedge |

---

## Team & budget

| Role | Cost (indicative) | Focus |
|------|-------------------|--------|
| Part-time policy editor (ex-journalist / UPSC teacher) | ₹15–40k/mo | Context rules, quality |
| Law / economics intern | ₹5–15k/mo | Acronym + Bill mining |
| Books (Blackbook, Samundramanthan, legal glossary) | ₹1–3k one-time | Priority lists, not copy-paste |

**Do not outsource moat to generic LLM** — use AI to *draft*, human to *approve* policy/legal lines.

---

## What WordWise does better than these resources

| They | WordWise |
|------|----------|
| Separate site / app — reader leaves article | In-article, zero tab switch |
| Static daily list — not tied to *this* paragraph | Context from selected sentence |
| Generic definition | Policy-aware disambiguation |
| No publisher analytics | “847 readers looked up X on this article” |

**Pitch:** WordWise is the **in-article layer** that coaching sites can't offer without publisher partnership.

---

## Starter pack (first 10 hours)

1. PRS Union Budget Primer → ~40 fiscal terms  
2. DoRD abbreviations → ~30 rural acronyms  
3. RBI harmonized defs → ~25 monetary terms  
4. VB-G RAM G article → formalize existing terms + rules  
5. PendulumEdu: study 5 recent editorial vocab posts → copy the *pattern* (context-in-sentence), not text  
6. Blackbook: mark top 50 words that overlap with Hindu editorials → editorial-terms queue  

---

## Next engineering steps (repo)

- [ ] Split glossary from `api/store.js` into `data/glossary/*.json`
- [ ] Domain tags on each entry (`economics`, `polity`, `ir`, `editorial`)
- [ ] Admin / approval UI for terms surfaced by analytics
- [ ] Hindu HTML term miner on `demo_article_3.html` and saved articles
- [ ] Optional Hindi gloss field for `data-subscriber="true"` mode

---

## References quick list

**Official:** PRS, RBI, MoSPI, DoRD, CAG, data.gov.in, Nyaaya, Vidhi SARAL  
**Daily mining:** [The Hindu Vocab](https://www.thehinduvocab.com/), [PendulumEdu](https://pendulumedu.com/english-vocabulary/the-hindu-editorial-vocab), [EditorialWords](https://www.editorialwords.com/), PracticeMock, Testbook  
**Books:** Blackbook of English Vocabulary (Nikhil Gupta), Samundramanthan (Rani Singh), legal/governance glossaries  

*Last updated: March 2026*
