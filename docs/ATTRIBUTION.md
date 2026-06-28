# Data & third-party attribution

WordWise combines several open datasets. Verify licenses before commercial deployment with a publisher.

| Source | Used in | License | Notes |
|--------|---------|---------|-------|
| [VocabPro](https://github.com/vishwanathbite/vocabpro) | `static-index.json` | Check upstream repo | Editorial vocab, idioms, acronyms — built via `npm run build:glossary` |
| [Wiktionary Hindi compact](https://gitlab.com/tdulcet/compact-dictionaries) | `hindi-index.json` | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | ~32k Hindi lemmas — built via `npm run build:hindi` |
| [WordNet](https://wordnet.princeton.edu/) | `api/glossary/wordnet.js` | WordNet License | Local npm package `wordnet` |
| Free Dictionary / Wiktionary API | `api/glossary/remote.js` | Various | Fallback only; rate-limited + circuit breaker |
| PRS / RBI / editorial terms | `policy-terms.json` | Public definitions (curated) | Hand-written from budget/RBI primers |
| AI4Bharat Indic-Glossaries | Not bundled | CC BY 4.0 | S3 download URLs broken as of 2026-06; planned future import |

Widget footer (when `data-show-attribution="true"`):

> Definitions: WordNet · VocabPro · Wiktionary

Add Hindi Wiktionary CC BY-SA when shipping to production publishers.

## Hindu demo HTML

`demo_article_3.html` is a saved mirror of a [The Hindu article](https://www.thehindu.com/news/national/two-bjp-led-states-question-wage-burden-under-vb-g-ram-g/article71154430.ece) for **local demo only**. Do not redistribute commercially without publisher permission.
