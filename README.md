# WordWise for Publishers

In-article word meaning widget for news publishers. Keeps readers on-site instead of opening Google for definitions.

Built for sales pitches to **The Hindu** and similar publishers — covers all three buyer personas:

| Persona | Feature |
|---------|---------|
| **General reader** | Select any word → Define button, or double-click |
| **UPSC / student** | Vocabulary notebook, practice sentences, CSV export |
| **Publisher (The Hindu)** | Analytics dashboard — lookups, sessions, top confused words |

## Quick start

```bash
npm install
npm run build:glossary   # fetch VocabPro → static-index.json (once, or after updates)
npm run build:hindi      # fetch Wiktionary Hindi → hindi-index.json (~32k words)
npm start
```

Then open:

- **Demo article:** http://localhost:3847/demo
- **Publisher dashboard:** http://localhost:3847/dashboard
- **Widget script:** http://localhost:3847/widget/wordwise.js

## Try it on the demo

1. Open the demo article (mirrors a real [Hindu policy piece](https://www.thehindu.com/news/national/two-bjp-led-states-question-wage-burden-under-vb-g-ram-g/article71154430.ece))
2. **Select** a word like "blackout", "bargaining", or "interim" → click **Define**
3. Or **double-click** any word for instant lookup
4. See **"In this article"** context explanation for policy jargon
5. Click **Save Word** → open the **📚 notebook** (bottom-right) to practice UPSC sentences
6. Check the **dashboard** to see analytics update live

## Embed on any publisher site

Add one script tag before `</body>`:

```html
<script
  src="https://your-cdn.com/widget/wordwise.js"
  data-publisher="thehindu"
  data-api="https://your-api.com"
  data-context="true"
  data-subscriber="true"
  data-theme-color="#c0392b"
  data-brand="WordWise × The Hindu"
  data-article-selector="article, .article-body"
  defer
></script>
```

### Data attributes

| Attribute | Default | Description |
|-----------|---------|-------------|
| `data-publisher` | `demo` | Publisher ID for analytics |
| `data-api` | auto from script src | API base URL |
| `data-context` | `true` | Show "In this article" explanations |
| `data-subscriber` | `false` | Enable UPSC notebook branding |
| `data-theme-color` | `#c0392b` | Accent color (match publisher brand) |
| `data-brand` | `WordWise` | "Powered by" label |
| `data-article-selector` | `article, main, …` | CSS selector for article content |
| `data-debug` | `false` | Show lookup source layer in tooltip footer |
| `data-show-attribution` | `true` | Show WordNet / VocabPro / Wiktionary footnote |
| `data-hindi` | `true` | Show Hindi script block when a Hindi term is matched |

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/lookup` | Layered dictionary lookup + context explanation |
| POST | `/api/analytics/event` | Track pageview, lookup, save, time-on-page |
| POST | `/api/analytics/batch` | Batch analytics events (widget flush) |
| GET | `/api/analytics/summary?publisher=thehindu` | Publisher dashboard data |
| GET | `/api/health` | Server health, glossary stats, circuit breaker |
| GET | `/api/vocabulary?userId=…` | Get saved words |
| POST | `/api/vocabulary` | Save a word |
| PUT | `/api/vocabulary/practice` | Save UPSC practice sentence |
| DELETE | `/api/vocabulary/:id?userId=…` | Remove saved word |

## Architecture

```
word_meaning_newspaper/
├── server.js              # HTTP server (API + static files)
├── api/
│   ├── store.js           # Analytics, vocabulary persistence
│   └── glossary/          # Layered lookup engine
│       ├── engine.js      # Cache → policy → static → WordNet → remote
│       ├── policy.js      # Loads policy-terms.json + context-rules.json
│       ├── hindi.js       # Curated + Wiktionary Hindi index
│       ├── static.js      # VocabPro index (~5k words, O(1) object lookup)
│       ├── wordnet.js     # Lazy local dictionary (~140k words)
│       └── remote.js      # Wiktionary API fallback
├── data/
│   ├── glossary/
│   │   ├── static-index.json     # VocabPro build (~860 KB)
│   │   ├── policy-terms.json     # PRS/RBI + editorial policy terms
│   │   ├── context-rules.json    # Disambiguation rules
│   │   ├── scheme-acronyms.json  # DoRD/CAG scheme acronyms
│   │   ├── hindi-terms.json      # Curated Hindi newspaper terms (~50)
│   │   └── hindi-index.json      # Built Wiktionary Hindi index (~32k, npm run build:hindi)
│   ├── analytics.json
│   └── vocabulary.json
├── scripts/
│   ├── build-static-glossary.mjs
│   ├── mine-hindu-terms.mjs      # Flag uncovered terms in Hindu HTML
│   └── load-test-lookup.mjs      # RPS load test for /api/lookup
├── docs/
│   ├── PROJECT-OVERVIEW.md       # Full v1 summary (start here)
│   ├── DEPLOY.md                 # Railway / cloud hosting
│   ├── GITHUB.md                 # Push & clone instructions
│   ├── ATTRIBUTION.md            # Data licenses
│   ├── pilot-proposal-the-hindu.md
│   ├── lookup-remaining-enhancements.md
│   └── GLOSSARY-MOAT-PLAN.md
├── public/
│   ├── widget/wordwise.js
│   ├── demo/index.html
│   └── dashboard/
```

## Sales pitch points

1. **Retention** — readers never leave for Google Dictionary
2. **UPSC wedge** — The Hindu's largest high-value segment already looks up 5–10 words daily from editorials
3. **Zero CMS work** — one script tag, works on all past articles
4. **Analytics** — "847 readers looked up 'blackout period' on this article" is actionable editorial data
5. **Premium upsell** — vocabulary notebook can be gated behind subscriber login

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3847` | HTTP port |
| `PRELOAD_WORDNET=true` | off | Warm WordNet on server start (~140k lemmas) |

## Tools

```bash
npm run mine:terms      # scan Hindu HTML for uncovered glossary terms
npm run load-test       # simulate lookup RPS (default 30 RPS × 10s)
PRELOAD_WORDNET=true npm start
```

## Documentation

| Doc | Description |
|-----|-------------|
| [docs/PROJECT-OVERVIEW.md](docs/PROJECT-OVERVIEW.md) | v1 feature summary, architecture, limits |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Deploy to Railway / cloud |
| [docs/GITHUB.md](docs/GITHUB.md) | Push to GitHub |
| [docs/pilot-proposal-the-hindu.md](docs/pilot-proposal-the-hindu.md) | Hindu pilot 1-pager |
| [docs/lookup-remaining-enhancements.md](docs/lookup-remaining-enhancements.md) | Backlog |
| [docs/ATTRIBUTION.md](docs/ATTRIBUTION.md) | Third-party data licenses |

## Production next steps

- Deploy → [docs/DEPLOY.md](docs/DEPLOY.md) (Railway ~$5/mo, multiple projects on one plan)
- Host widget on CDN with domain allowlist (post-pilot)
- Postgres for analytics; Redis for shared cache (post-pilot)
- Verify VocabPro license before commercial Hindu sale

## License

MIT
