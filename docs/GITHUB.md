# Push to GitHub

## 1. Create repo on GitHub

Create a **new empty repository** (no README) at github.com, e.g. `wordwise-publishers`.

## 2. Initialize and push (first time)

```bash
cd word_meaning_newspaper

git init
git add .
git status   # verify: glossary JSON included, node_modules excluded

git commit -m "$(cat <<'EOF'
WordWise v1: publisher word-meaning widget

Layered glossary (policy, Hindi, VocabPro, WordNet), embeddable widget,
analytics dashboard, and Hindu demo article. Includes deploy docs and pilot proposal.
EOF
)"

git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/wordwise-publishers.git
git push -u origin main
```

## 3. What gets committed

| Included | Excluded (.gitignore) |
|----------|------------------------|
| Source code, scripts, docs | `node_modules/` |
| `data/glossary/*.json` (~6 MB) | `data/analytics.json` |
| `demo_article_3.html` | `data/vocabulary.json` |
| `package-lock.json` | `.env`, logs |

## 4. After push

1. Connect Railway → Deploy from GitHub ([DEPLOY.md](./DEPLOY.md))  
2. Add repo description: *In-article dictionary widget for Indian news publishers*  
3. Optional topics: `dictionary`, `widget`, `upsc`, `publishers`, `hindi`

## 5. Clone on another machine

```bash
git clone https://github.com/YOUR_USERNAME/wordwise-publishers.git
cd wordwise-publishers
npm install
# glossaries already in repo; or: npm run build:all
npm start
```
