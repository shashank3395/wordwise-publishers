# Deploying WordWise (v1)

Guide for hosting beyond localhost — tested path: **Railway**, also works on Render / Fly.io.

---

## What gets deployed

Single Node.js process (`server.js`) serving:

| Path | Purpose |
|------|---------|
| `/widget/wordwise.js` | Embeddable widget |
| `/api/*` | Lookup, analytics, vocabulary |
| `/demo` | Demo article |
| `/saved/demo_article_3.html` | Hindu saved HTML demo |
| `/dashboard` | Publisher analytics |

---

## Pre-push checklist

1. **Glossary files committed** (or build on deploy):
   - `data/glossary/static-index.json` (~860 KB)
   - `data/glossary/hindi-index.json` (~5 MB)
   - Curated JSON: `policy-terms.json`, `context-rules.json`, `scheme-acronyms.json`, `hindi-terms.json`

2. **Rebuild if missing:**
   ```bash
   npm install
   npm run build:all
   ```

3. **Do not commit** runtime files (gitignored): `data/analytics.json`, `data/vocabulary.json`

---

## Railway (recommended)

1. Push repo to GitHub
2. [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select this repository
4. **Settings → Deploy:**
   - Build command: `npm install && npm run build:all` *(skip `build:all` if glossaries are committed)*
   - Start command: `npm start`
5. **Variables:**
   | Name | Value |
   |------|--------|
   | `PRELOAD_WORDNET` | `false` on Hobby (512MB); `true` on 1GB+ |
6. **Settings → Networking → Generate domain**
7. Smoke test:
   ```bash
   curl https://YOUR-APP.up.railway.app/api/health
   ```

### Memory

| Config | RAM |
|--------|-----|
| Minimal (lazy WordNet) | ~256–512 MB |
| `PRELOAD_WORDNET=true` + hindi-index | ~512 MB–1 GB |

### Persistence (v1 limitation)

Analytics and notebooks write to `data/*.json`. **Redeploy wipes them.** Fine for demo/pilot. For production: Postgres + volume (post-pilot).

---

## Embed snippet (production)

Replace `YOUR-URL` with Railway domain:

```html
<script
  src="https://YOUR-URL/widget/wordwise.js"
  data-publisher="thehindu"
  data-api="https://YOUR-URL"
  data-context="true"
  data-hindi="true"
  data-theme-color="#c0392b"
  data-brand="WordWise"
  defer
></script>
```

CORS is open (`*`) — widget works on any publisher origin.

---

## Post-deploy steps

1. Update [`pilot-proposal-the-hindu.md`](./pilot-proposal-the-hindu.md) with live URL
2. Run load test: `npm run load-test -- --url https://YOUR-URL`
3. Test lookups: `yojana`, `blackout period`, `MGNREGA`, `fiscal deficit`
4. Send pilot doc + demo link to publisher

See [`lookup-remaining-enhancements.md`](./lookup-remaining-enhancements.md) for backlog after v1.

---

## Multiple projects on one Railway plan

One subscription = one **workspace**. Create a **new Railway project** per repo/app. All projects share the same monthly plan and usage credits.
