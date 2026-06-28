(function () {
  "use strict";

  const script = document.currentScript;
  if (!script) {
    return;
  }

  const config = {
    publisher: script.getAttribute("data-publisher") || "demo",
    apiBase: script.getAttribute("data-api") || deriveApiBase(script.src),
    articleSelector: script.getAttribute("data-article-selector") || "article, .article-body, .articlebodycontent, main",
    contextMode: script.getAttribute("data-context") !== "false",
    themeColor: script.getAttribute("data-theme-color") || "#c0392b",
    brandName: script.getAttribute("data-brand") || "WordWise",
    subscriberMode: script.getAttribute("data-subscriber") === "true",
    debug: script.getAttribute("data-debug") === "true",
    showAttribution: script.getAttribute("data-show-attribution") !== "false",
    hindiMode: script.getAttribute("data-hindi") !== "false",
  };

  function deriveApiBase(src) {
    try {
      const url = new URL(src);
      return `${url.protocol}//${url.host}`;
    } catch {
      return "";
    }
  }

  const SESSION_KEY = "wordwise_session";
  const USER_KEY = "wordwise_user";
  const GLOSSARY_SESSION_KEY = "wordwise_article_glossary";

  let shadowRoot = null;
  let tooltipEl = null;
  let notebookPanel = null;
  let lookupBtn = null;
  let activeRequestId = 0;
  let lastLookupResult = null;
  let pageLoadTime = Date.now();
  let cachedSessionId = null;
  let cachedUserId = null;
  let cachedArticleEl = null;
  let cachedArticleMeta = null;
  const clientLookupCache = new Map();
  const CLIENT_CACHE_TTL = 30 * 60 * 1000;
  let popularGlossaryCache = null;
  let popularGlossaryCacheTime = 0;
  const POPULAR_CACHE_TTL = 15000;
  let glossaryRefreshTimer = null;
  let selectionRaf = null;
  let lastSelectionWord = "";
  let vocabCountCache = -1;
  const articleSelectors = config.articleSelector.split(",").map((s) => s.trim());
  let stylesText = null;

  function getSessionId() {
    if (cachedSessionId) {
      return cachedSessionId;
    }
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(SESSION_KEY, id);
    }
    cachedSessionId = id;
    return id;
  }

  function getUserId() {
    if (cachedUserId) {
      return cachedUserId;
    }
    let id = localStorage.getItem(USER_KEY);
    if (!id) {
      id = `user_${crypto.randomUUID().slice(0, 8)}`;
      localStorage.setItem(USER_KEY, id);
    }
    cachedUserId = id;
    return id;
  }

  function getArticleMeta() {
    if (!cachedArticleMeta) {
      cachedArticleMeta = { url: location.href, title: document.title };
    }
    return cachedArticleMeta;
  }

  function trackEvent(type, payload) {
    enqueueAnalytics(type, payload);
  }

  const analyticsQueue = [];
  let analyticsFlushTimer = null;
  let timeOnPageSent = false;
  const ANALYTICS_FLUSH_MS = 5000;
  const ANALYTICS_MAX_BATCH = 25;

  function enqueueAnalytics(type, payload) {
    analyticsQueue.push({ type, ...payload });
    if (type === "time_on_page") {
      flushAnalyticsQueue(true);
      return;
    }
    if (analyticsQueue.length >= ANALYTICS_MAX_BATCH) {
      flushAnalyticsQueue(false);
      return;
    }
    if (!analyticsFlushTimer) {
      analyticsFlushTimer = setTimeout(() => flushAnalyticsQueue(false), ANALYTICS_FLUSH_MS);
    }
  }

  function flushAnalyticsQueue(immediate) {
    if (analyticsFlushTimer) {
      clearTimeout(analyticsFlushTimer);
      analyticsFlushTimer = null;
    }
    if (analyticsQueue.length === 0) {
      return;
    }

    const events = analyticsQueue.splice(0, ANALYTICS_MAX_BATCH);
    const body = JSON.stringify({
      publisher: config.publisher,
      sessionId: getSessionId(),
      userId: getUserId(),
      ...getArticleMeta(),
      events,
    });
    const url = `${config.apiBase}/api/analytics/batch`;

    if (immediate && navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
      return;
    }

    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  }

  function initShadowDom() {
    const host = document.createElement("div");
    host.id = "wordwise-widget-host";
    host.style.cssText = "all: initial; position: fixed; z-index: 2147483647; pointer-events: none;";
    document.body.appendChild(host);
    shadowRoot = host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    if (!stylesText) {
      stylesText = getStyles();
    }
    style.textContent = stylesText;
    shadowRoot.appendChild(style);
  }

  function getStyles() {
    const accent = config.themeColor;
    return `
      *, *::before, *::after { box-sizing: border-box; }
      .ww-hidden { display: none !important; }
      .ww-tooltip {
        position: fixed;
        max-width: 340px;
        background: #1a1a1a;
        color: #f5f5f5;
        border-radius: 10px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.45);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 13px;
        line-height: 1.5;
        pointer-events: auto;
        overflow: hidden;
        border: 1px solid #333;
      }
      .ww-tooltip-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 12px 6px;
        border-bottom: 1px solid #2a2a2a;
      }
      .ww-word { font-weight: 700; font-size: 16px; color: #fff; }
      .ww-phonetic { color: #999; font-size: 12px; margin-top: 2px; }
      .ww-close {
        background: none; border: none; color: #888; cursor: pointer;
        font-size: 18px; line-height: 1; padding: 0 4px;
      }
      .ww-close:hover { color: #fff; }
      .ww-body { padding: 8px 12px 12px; }
      .ww-pos {
        color: ${accent};
        font-size: 11px;
        font-weight: 600;
        text-transform: lowercase;
        margin-top: 8px;
        margin-bottom: 2px;
      }
      .ww-pos:first-child { margin-top: 0; }
      .ww-def {
        margin: 0 0 6px 0;
        padding-left: 8px;
        border-left: 2px solid #444;
        color: #ddd;
      }
      .ww-context {
        margin-top: 10px;
        padding: 8px 10px;
        background: #252525;
        border-radius: 6px;
        border-left: 3px solid ${accent};
      }
      .ww-context-label {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: ${accent};
        font-weight: 600;
        margin-bottom: 4px;
      }
      .ww-context-text { color: #ccc; font-size: 12px; font-style: italic; margin-bottom: 6px; }
      .ww-context-explain { color: #e8e8e8; font-size: 12px; }
      .ww-compare {
        margin-top: 10px;
        padding: 8px 10px;
        background: #1f1414;
        border-radius: 6px;
        border: 1px solid #442222;
      }
      .ww-compare-row { margin-bottom: 8px; font-size: 11px; line-height: 1.45; }
      .ww-compare-row:last-child { margin-bottom: 0; }
      .ww-compare-label {
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        font-weight: 700;
        margin-bottom: 3px;
      }
      .ww-compare-label.bad { color: #888; }
      .ww-compare-label.good { color: ${accent}; }
      .ww-compare-text { color: #bbb; }
      .ww-compare-text.good { color: #f0f0f0; }
      .ww-fullform {
        font-size: 11px;
        color: #aaa;
        margin-top: 2px;
        font-style: italic;
      }
      .ww-coach {
        position: fixed;
        bottom: 88px;
        right: 24px;
        width: 260px;
        background: #fff;
        color: #222;
        border-radius: 10px;
        box-shadow: 0 8px 28px rgba(0,0,0,0.25);
        padding: 14px 16px;
        pointer-events: auto;
        font-family: inherit;
        border-left: 4px solid ${accent};
        animation: ww-slide-in 0.3s ease;
      }
      @keyframes ww-slide-in {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .ww-coach-title { font-weight: 700; font-size: 13px; margin-bottom: 6px; color: ${accent}; }
      .ww-coach-text { font-size: 12px; line-height: 1.5; color: #444; margin-bottom: 10px; }
      .ww-coach-btn {
        background: ${accent};
        color: #fff;
        border: none;
        border-radius: 6px;
        padding: 6px 12px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
      }
      .ww-dash-link {
        position: fixed;
        bottom: 24px;
        left: 24px;
        background: #1a1a1a;
        color: #fff;
        border: 1px solid #444;
        border-radius: 8px;
        padding: 8px 14px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        pointer-events: auto;
        font-family: inherit;
        text-decoration: none;
        display: flex;
        align-items: center;
        gap: 6px;
        opacity: 0.85;
      }
      .ww-dash-link:hover { opacity: 1; border-color: ${accent}; }
      .ww-status { color: #aaa; font-style: italic; padding: 12px; }
      .ww-error { color: #f0a0a0; }
      .ww-actions {
        display: flex;
        gap: 8px;
        padding: 0 12px 12px;
      }
      .ww-btn {
        flex: 1;
        padding: 7px 10px;
        border: none;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
      }
      .ww-btn-primary { background: ${accent}; color: #fff; }
      .ww-btn-primary:hover { filter: brightness(1.1); }
      .ww-btn-secondary { background: #333; color: #ddd; }
      .ww-btn-secondary:hover { background: #444; }
      .ww-btn-saved { background: #2d5a2d; color: #a8e6a8; }
      .ww-lookup-btn {
        position: fixed;
        background: ${accent};
        color: #fff;
        border: none;
        border-radius: 20px;
        padding: 6px 14px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        pointer-events: auto;
        font-family: inherit;
        display: flex;
        align-items: center;
        gap: 6px;
        z-index: 2147483646;
      }
      .ww-lookup-btn:hover { filter: brightness(1.1); }
      .ww-fab {
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 52px;
        height: 52px;
        border-radius: 50%;
        background: ${accent};
        color: #fff;
        border: none;
        font-size: 22px;
        cursor: pointer;
        box-shadow: 0 4px 16px rgba(0,0,0,0.35);
        pointer-events: auto;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .ww-fab:hover { filter: brightness(1.1); }
      .ww-fab-badge {
        position: absolute;
        top: -4px;
        right: -4px;
        background: #fff;
        color: ${accent};
        font-size: 10px;
        font-weight: 700;
        min-width: 18px;
        height: 18px;
        border-radius: 9px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 4px;
      }
      .ww-notebook {
        position: fixed;
        bottom: 88px;
        right: 24px;
        width: 360px;
        max-height: 480px;
        background: #1a1a1a;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        pointer-events: auto;
        display: flex;
        flex-direction: column;
        border: 1px solid #333;
        overflow: hidden;
      }
      .ww-nb-header {
        padding: 12px 14px;
        border-bottom: 1px solid #2a2a2a;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .ww-nb-title { font-weight: 700; font-size: 14px; color: #fff; }
      .ww-nb-sub { font-size: 11px; color: #888; margin-top: 2px; }
      .ww-nb-list { overflow-y: auto; flex: 1; padding: 8px; }
      .ww-nb-empty { color: #666; font-size: 12px; text-align: center; padding: 24px 16px; }
      .ww-nb-item {
        background: #252525;
        border-radius: 8px;
        padding: 10px;
        margin-bottom: 8px;
      }
      .ww-nb-word { font-weight: 700; color: #fff; font-size: 14px; }
      .ww-nb-def { color: #aaa; font-size: 11px; margin-top: 4px; }
      .ww-nb-practice {
        width: 100%;
        margin-top: 8px;
        padding: 6px 8px;
        background: #1a1a1a;
        border: 1px solid #444;
        border-radius: 4px;
        color: #ddd;
        font-size: 11px;
        font-family: inherit;
        resize: vertical;
        min-height: 48px;
      }
      .ww-nb-practice::placeholder { color: #666; }
      .ww-nb-footer {
        padding: 8px 12px;
        border-top: 1px solid #2a2a2a;
        display: flex;
        gap: 8px;
      }
      .ww-brand {
        font-size: 9px;
        color: #555;
        text-align: center;
        padding: 4px;
      }
      .ww-attribution {
        font-size: 8px;
        color: #666;
        text-align: center;
        padding: 2px 8px 0;
        line-height: 1.3;
      }
      .ww-source-debug {
        font-size: 8px;
        color: #888;
        text-align: center;
        padding: 2px 8px;
        font-family: monospace;
      }
      .ww-hindi-block {
        margin: 8px 0 4px;
        padding: 8px 10px;
        background: #1a2433;
        border-radius: 6px;
        border-left: 3px solid var(--ww-accent, #c0392b);
      }
      .ww-hindi-label {
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #888;
        margin-bottom: 4px;
      }
      .ww-hindi-script {
        font-size: 18px;
        line-height: 1.4;
        color: #f0e6d2;
        font-family: "Noto Sans Devanagari", "Devanagari MT", sans-serif;
      }
      .ww-hindi-roman {
        font-size: 11px;
        color: #aaa;
        margin-top: 2px;
      }
      .ww-hindi-usage {
        font-size: 10px;
        color: #888;
        margin-top: 4px;
        font-style: italic;
      }
    `;
  }

  function createTooltip() {
    if (tooltipEl) {
      return tooltipEl;
    }
    tooltipEl = document.createElement("div");
    tooltipEl.className = "ww-tooltip ww-hidden";
    shadowRoot.appendChild(tooltipEl);
    return tooltipEl;
  }

  function hideTooltip() {
    if (tooltipEl) {
      tooltipEl.classList.add("ww-hidden");
      tooltipEl.replaceChildren();
    }
    hideLookupButton();
  }

  function hideLookupButton() {
    if (lookupBtn) {
      lookupBtn.remove();
      lookupBtn = null;
    }
  }

  function positionElement(el, x, y) {
    el.classList.remove("ww-hidden");
    const rect = el.getBoundingClientRect();
    const margin = 12;
    let left = x + 12;
    let top = y + 12;

    if (left + rect.width > window.innerWidth - margin) {
      left = x - rect.width - 12;
    }
    if (left < margin) {
      left = margin;
    }
    if (top + rect.height > window.innerHeight - margin) {
      top = y - rect.height - 12;
    }
    if (top < margin) {
      top = margin;
    }

    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }

  function getSelectedWord() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      return null;
    }
    const raw = selection.toString().trim();
    if (!raw || raw.length < 1) {
      return null;
    }

    if (/[\u0900-\u097F]/.test(raw)) {
      return raw.replace(/\s+/g, " ").trim();
    }

    const text = raw.toLowerCase().replace(/\s+/g, " ");
    if (text.length < 2) {
      return null;
    }
    if (text.includes(" ")) {
      const words = text.split(" ");
      if (words.length > 8) {
        return null;
      }
      if (!words.every((w) => /^[a-z][a-z'-]*[a-z]$|^[a-z]{2}$/.test(w))) {
        return null;
      }
      return text.replace(/^['-]+|['-]+$/g, "");
    }
    if (!/^[a-zA-Z'-]+$/.test(raw)) {
      return null;
    }
    return text.replace(/^['-]+|['-]+$/g, "");
  }

  function getWordFromDoubleClick(event) {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      return null;
    }
    const text = selection.toString().trim();
    const word = text.match(/^[a-zA-Z'-]+$/);
    if (!word || text.length < 2) {
      return null;
    }
    return text.toLowerCase().replace(/^['-]+|['-]+$/g, "");
  }

  function getContextSentence(word) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return "";
    }

    let node = selection.anchorNode;
    if (node?.nodeType === Node.TEXT_NODE) {
      node = node.parentElement;
    }
    if (!node) {
      return "";
    }

    const block = node.closest("p, li, h1, h2, h3, h4, td, blockquote, div");
    if (!block) {
      return "";
    }

    const text = block.textContent || "";
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const lowerWord = word.toLowerCase();

    for (const sentence of sentences) {
      if (sentence.toLowerCase().includes(lowerWord)) {
        return sentence.trim();
      }
    }
    return text.trim().slice(0, 200);
  }

  function showLookupButton(x, y) {
    hideLookupButton();
    lookupBtn = document.createElement("button");
    lookupBtn.className = "ww-lookup-btn";
    lookupBtn.innerHTML = `<span>📖</span> Define`;
    lookupBtn.style.left = `${x}px`;
    lookupBtn.style.top = `${y - 36}px`;
    shadowRoot.appendChild(lookupBtn);

    lookupBtn.addEventListener("mousedown", (e) => e.preventDefault());
    lookupBtn.addEventListener("click", () => {
      const word = getSelectedWord();
      if (word) {
        lookupWord(word, x, y);
      }
    });
  }

  function renderLoading(word, x, y) {
    const el = createTooltip();
    el.replaceChildren();
    const status = document.createElement("div");
    status.className = "ww-status";
    status.textContent = `Looking up "${word}"…`;
    el.appendChild(status);
    positionElement(el, x, y);
  }

  function renderError(word, message, x, y) {
    const el = createTooltip();
    el.replaceChildren();

    const header = document.createElement("div");
    header.className = "ww-tooltip-header";
    const wordEl = document.createElement("div");
    wordEl.className = "ww-word";
    wordEl.textContent = word;
    header.appendChild(wordEl);
    const closeBtn = document.createElement("button");
    closeBtn.className = "ww-close";
    closeBtn.textContent = "×";
    closeBtn.onclick = hideTooltip;
    header.appendChild(closeBtn);
    el.appendChild(header);

    const body = document.createElement("div");
    body.className = "ww-body";
    const status = document.createElement("div");
    status.className = "ww-status ww-error";
    status.textContent = message;
    body.appendChild(status);
    el.appendChild(body);

    positionElement(el, x, y);
  }

  function renderResult(result, x, y) {
    const el = createTooltip();
    el.replaceChildren();
    lastLookupResult = result;

    const header = document.createElement("div");
    header.className = "ww-tooltip-header";
    const titleBlock = document.createElement("div");
    const wordEl = document.createElement("div");
    wordEl.className = "ww-word";
    wordEl.textContent = result.word;
    titleBlock.appendChild(wordEl);
    if (result.phonetic) {
      const ph = document.createElement("div");
      ph.className = "ww-phonetic";
      ph.textContent = result.phonetic;
      titleBlock.appendChild(ph);
    }
    if (result.fullForm) {
      const ff = document.createElement("div");
      ff.className = "ww-fullform";
      ff.textContent = result.fullForm;
      titleBlock.appendChild(ff);
    }
    header.appendChild(titleBlock);
    const closeBtn = document.createElement("button");
    closeBtn.className = "ww-close";
    closeBtn.textContent = "×";
    closeBtn.onclick = hideTooltip;
    header.appendChild(closeBtn);
    el.appendChild(header);

    const body = document.createElement("div");
    body.className = "ww-body";

    if (config.hindiMode && result.hindi) {
      const hiBlock = document.createElement("div");
      hiBlock.className = "ww-hindi-block";
      const hiLabel = document.createElement("div");
      hiLabel.className = "ww-hindi-label";
      hiLabel.textContent = "Hindi";
      hiBlock.appendChild(hiLabel);
      const hiScript = document.createElement("div");
      hiScript.className = "ww-hindi-script";
      hiScript.textContent = result.hindi;
      hiBlock.appendChild(hiScript);
      if (result.transliteration && result.transliteration !== result.word) {
        const hiRoman = document.createElement("div");
        hiRoman.className = "ww-hindi-roman";
        hiRoman.textContent = result.transliteration;
        hiBlock.appendChild(hiRoman);
      }
      if (result.hindiUsage) {
        const hiUsage = document.createElement("div");
        hiUsage.className = "ww-hindi-usage";
        hiUsage.textContent = result.hindiUsage;
        hiBlock.appendChild(hiUsage);
      }
      body.appendChild(hiBlock);
    }

    let lastPos = null;
    for (const def of result.definitions || []) {
      if (def.partOfSpeech && def.partOfSpeech !== lastPos) {
        const pos = document.createElement("div");
        pos.className = "ww-pos";
        pos.textContent = def.partOfSpeech;
        body.appendChild(pos);
        lastPos = def.partOfSpeech;
      }
      const defEl = document.createElement("p");
      defEl.className = "ww-def";
      defEl.textContent = def.definition;
      body.appendChild(defEl);
    }

    if (config.contextMode && result.contextExplanation && !result.showComparison) {
      const ctx = document.createElement("div");
      ctx.className = "ww-context";
      const label = document.createElement("div");
      label.className = "ww-context-label";
      label.textContent = "In this article";
      ctx.appendChild(label);
      const sent = document.createElement("div");
      sent.className = "ww-context-text";
      sent.textContent = `"${result.contextExplanation.sentence}"`;
      ctx.appendChild(sent);
      const explain = document.createElement("div");
      explain.className = "ww-context-explain";
      explain.textContent = result.contextExplanation.explanation;
      ctx.appendChild(explain);
      body.appendChild(ctx);
    }

    if (result.showComparison && result.dictionaryWouldSay && result.contextExplanation) {
      const cmp = document.createElement("div");
      cmp.className = "ww-compare";
      const googleRow = document.createElement("div");
      googleRow.className = "ww-compare-row";
      googleRow.innerHTML = `<div class="ww-compare-label bad">Google / Dictionary</div><div class="ww-compare-text">${escapeHtml(result.dictionaryWouldSay)}</div>`;
      cmp.appendChild(googleRow);
      const wwRow = document.createElement("div");
      wwRow.className = "ww-compare-row";
      wwRow.innerHTML = `<div class="ww-compare-label good">WordWise — in this article</div><div class="ww-compare-text good">${escapeHtml(result.contextExplanation.explanation)}</div>`;
      cmp.appendChild(wwRow);
      body.appendChild(cmp);
    }

    el.appendChild(body);

    const actions = document.createElement("div");
    actions.className = "ww-actions";

    const saveBtn = document.createElement("button");
    saveBtn.className = "ww-btn ww-btn-primary";
    saveBtn.textContent = config.subscriberMode ? "Save to Notebook" : "Save Word";
    saveBtn.onclick = () => saveToVocabulary(result, saveBtn);
    actions.appendChild(saveBtn);

    const moreBtn = document.createElement("button");
    moreBtn.className = "ww-btn ww-btn-secondary";
    moreBtn.textContent = "Open Notebook";
    moreBtn.onclick = () => {
      hideTooltip();
      toggleNotebook(true);
    };
    actions.appendChild(moreBtn);

    el.appendChild(actions);

    if (config.showAttribution) {
      const attr = document.createElement("div");
      attr.className = "ww-attribution";
      attr.textContent = "Definitions: WordNet · VocabPro · Wiktionary";
      el.appendChild(attr);
    }

    if (config.debug && result.source) {
      const src = document.createElement("div");
      src.className = "ww-source-debug";
      src.textContent = `source: ${result.source}`;
      el.appendChild(src);
    }

    const brand = document.createElement("div");
    brand.className = "ww-brand";
    brand.textContent = `Powered by ${config.brandName}`;
    el.appendChild(brand);

    positionElement(el, x, y);
  }

  async function lookupWord(word, x, y) {
    const requestId = ++activeRequestId;
    hideLookupButton();

    const normalized = word.toLowerCase();
    const cached = clientLookupCache.get(normalized);
    if (cached && Date.now() - cached.time < CLIENT_CACHE_TTL) {
      renderResult(cached.result, x, y);
      return;
    }

    renderLoading(word, x, y);
    const context = config.contextMode ? getContextSentence(word) : "";

    try {
      const response = await fetch(`${config.apiBase}/api/lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word, context }),
      });
      const result = await response.json();

      if (requestId !== activeRequestId) {
        return;
      }

      if (!result.ok) {
        const msg = result.error === "not_found" ? "No definition found" : "Could not fetch definition";
        renderError(word, msg, x, y);
        trackEvent("lookup", { word, success: false });
        return;
      }

      clientLookupCache.set(normalized, { result, time: Date.now() });
      renderResult(result, x, y);
      const glossaryEntry = glossaryEntryFromResult(result);
      addToSessionGlossary(glossaryEntry);
      scheduleArticleGlossaryRefresh();
      trackEvent("lookup", {
        word,
        success: true,
        hasContext: !!(result.contextExplanation && result.contextExplanation.source !== "dictionary"),
        definition: glossaryEntry.definition,
        contextExplanation: glossaryEntry.contextExplanation,
        fullForm: glossaryEntry.fullForm,
        partOfSpeech: glossaryEntry.partOfSpeech,
      });
    } catch {
      if (requestId === activeRequestId) {
        renderError(word, "Could not fetch definition", x, y);
      }
    }
  }

  async function saveToVocabulary(result, btn) {
    const entry = {
      userId: getUserId(),
      word: result.word,
      definition: result.definitions?.[0]?.definition || "",
      contextExplanation: result.contextExplanation?.explanation || "",
      articleUrl: location.href,
      articleTitle: document.title,
    };

    try {
      await fetch(`${config.apiBase}/api/vocabulary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
      btn.textContent = "Saved ✓";
      btn.className = "ww-btn ww-btn-saved";
      trackEvent("vocabulary_save", { word: result.word });
      vocabCountCache = -1;
      updateFabBadge(true);
      refreshNotebookList();
    } catch {
      btn.textContent = "Save failed";
    }
  }

  function createFab() {
    const fab = document.createElement("button");
    fab.className = "ww-fab";
    fab.title = "Vocabulary Notebook";
    fab.innerHTML = `<span>📚</span>`;
    fab.onclick = () => toggleNotebook();

    const badge = document.createElement("span");
    badge.className = "ww-fab-badge ww-hidden";
    badge.id = "ww-fab-badge";
    fab.appendChild(badge);

    shadowRoot.appendChild(fab);
  }

  function setFabBadgeCount(badge, count) {
    if (count > 0) {
      badge.textContent = count > 99 ? "99+" : String(count);
      badge.classList.remove("ww-hidden");
    } else {
      badge.classList.add("ww-hidden");
    }
  }

  async function updateFabBadge(forceFetch) {
    const badge = shadowRoot.getElementById("ww-fab-badge");
    if (!badge) {
      return;
    }
    if (vocabCountCache >= 0 && !forceFetch) {
      setFabBadgeCount(badge, vocabCountCache);
      return;
    }
    try {
      const res = await fetch(`${config.apiBase}/api/vocabulary?userId=${encodeURIComponent(getUserId())}`);
      const data = await res.json();
      vocabCountCache = data.entries?.length || 0;
      setFabBadgeCount(badge, vocabCountCache);
    } catch {
      badge.classList.add("ww-hidden");
    }
  }

  function toggleNotebook(forceOpen) {
    if (notebookPanel && !forceOpen) {
      notebookPanel.remove();
      notebookPanel = null;
      return;
    }
    if (notebookPanel) {
      refreshNotebookList();
      return;
    }

    notebookPanel = document.createElement("div");
    notebookPanel.className = "ww-notebook";

    const header = document.createElement("div");
    header.className = "ww-nb-header";
    const titleBlock = document.createElement("div");
    const title = document.createElement("div");
    title.className = "ww-nb-title";
    title.textContent = "Vocabulary Notebook";
    titleBlock.appendChild(title);
    const sub = document.createElement("div");
    sub.className = "ww-nb-sub";
    sub.textContent = config.subscriberMode ? "UPSC Edition — practice daily" : "Your saved words from this site";
    titleBlock.appendChild(sub);
    header.appendChild(titleBlock);
    const close = document.createElement("button");
    close.className = "ww-close";
    close.textContent = "×";
    close.onclick = () => toggleNotebook(false);
    header.appendChild(close);
    notebookPanel.appendChild(header);

    const list = document.createElement("div");
    list.className = "ww-nb-list";
    list.id = "ww-nb-list";
    notebookPanel.appendChild(list);

    const footer = document.createElement("div");
    footer.className = "ww-nb-footer";
    const exportBtn = document.createElement("button");
    exportBtn.className = "ww-btn ww-btn-secondary";
    exportBtn.textContent = "Export CSV";
    exportBtn.onclick = exportVocabulary;
    footer.appendChild(exportBtn);
    notebookPanel.appendChild(footer);

    shadowRoot.appendChild(notebookPanel);
    refreshNotebookList();
  }

  async function refreshNotebookList() {
    const list = shadowRoot.getElementById("ww-nb-list");
    if (!list) {
      return;
    }
    list.replaceChildren();

    try {
      const res = await fetch(`${config.apiBase}/api/vocabulary?userId=${encodeURIComponent(getUserId())}`);
      const data = await res.json();
      const entries = data.entries || [];
      vocabCountCache = entries.length;
      const badge = shadowRoot.getElementById("ww-fab-badge");
      if (badge) {
        setFabBadgeCount(badge, vocabCountCache);
      }

      if (entries.length === 0) {
        const empty = document.createElement("div");
        empty.className = "ww-nb-empty";
        empty.textContent = "No words saved yet. Select any word in the article and tap Define.";
        list.appendChild(empty);
        return;
      }

      for (const entry of entries) {
        const item = document.createElement("div");
        item.className = "ww-nb-item";

        const wordEl = document.createElement("div");
        wordEl.className = "ww-nb-word";
        wordEl.textContent = entry.word;
        item.appendChild(wordEl);

        const defEl = document.createElement("div");
        defEl.className = "ww-nb-def";
        defEl.textContent = entry.definition;
        item.appendChild(defEl);

        if (config.subscriberMode || true) {
          const textarea = document.createElement("textarea");
          textarea.className = "ww-nb-practice";
          textarea.placeholder = "Write a sentence using this word (UPSC practice)…";
          textarea.value = entry.practiceSentence || "";
          textarea.addEventListener("blur", () => {
            savePracticeSentence(entry.id, textarea.value);
          });
          item.appendChild(textarea);
        }

        list.appendChild(item);
      }
    } catch {
      const empty = document.createElement("div");
      empty.className = "ww-nb-empty";
      empty.textContent = "Could not load vocabulary.";
      list.appendChild(empty);
    }
  }

  async function savePracticeSentence(entryId, sentence) {
    try {
      await fetch(`${config.apiBase}/api/vocabulary/practice`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: getUserId(),
          entryId,
          practiceSentence: sentence,
        }),
      });
    } catch {
      /* silent */
    }
  }

  async function exportVocabulary() {
    try {
      const res = await fetch(`${config.apiBase}/api/vocabulary?userId=${encodeURIComponent(getUserId())}`);
      const data = await res.json();
      const entries = data.entries || [];
      const rows = [["Word", "Definition", "Context", "Article", "Practice Sentence", "Saved At"]];
      for (const e of entries) {
        rows.push([
          e.word,
          e.definition,
          e.contextExplanation || "",
          e.articleTitle || e.articleUrl,
          e.practiceSentence || "",
          e.savedAt,
        ]);
      }
      const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "wordwise-vocabulary.csv";
      a.click();
    } catch {
      /* silent */
    }
  }

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str || "";
    return d.innerHTML;
  }

  function showCoachMark() {
    const key = "wordwise_coach_seen";
    if (localStorage.getItem(key)) {
      return;
    }
    const coach = document.createElement("div");
    coach.className = "ww-coach";
    coach.innerHTML = `
      <div class="ww-coach-title">New: Instant definitions</div>
      <div class="ww-coach-text">Double-click any word, or select text and tap <strong>Define</strong>. Stay on the page — no Google needed.</div>
    `;
    const btn = document.createElement("button");
    btn.className = "ww-coach-btn";
    btn.textContent = "Got it";
    btn.onclick = () => {
      coach.remove();
      localStorage.setItem(key, "1");
    };
    coach.appendChild(btn);
    shadowRoot.appendChild(coach);
    setTimeout(() => {
      if (coach.parentNode) {
        coach.remove();
        localStorage.setItem(key, "1");
      }
    }, 12000);
  }

  function clearSessionGlossary() {
    sessionStorage.removeItem(GLOSSARY_SESSION_KEY);
    clientLookupCache.clear();
    popularGlossaryCache = null;
    vocabCountCache = -1;
    scheduleArticleGlossaryRefresh();
    updateFabBadge(true);
  }

  function onDashboardReset() {
    clearSessionGlossary();
  }

  function initResetSync() {
    window.addEventListener("storage", (e) => {
      if (e.key === "wordwise_reset") {
        onDashboardReset();
      }
    });
    window.addEventListener("wordwise-reset", onDashboardReset);
  }

  function createDashboardLink() {
    if (!config.apiBase) {
      return;
    }
    const link = document.createElement("a");
    link.className = "ww-dash-link";
    link.href = `${config.apiBase}/dashboard`;
    link.target = "_blank";
    link.rel = "noopener";
    link.innerHTML = `<span>📊</span> Publisher Dashboard`;
    shadowRoot.appendChild(link);
  }

  function onSelectionChange() {
    if (selectionRaf) {
      return;
    }
    selectionRaf = requestAnimationFrame(() => {
      selectionRaf = null;
      const word = getSelectedWord();
      if (!word) {
        lastSelectionWord = "";
        hideLookupButton();
        return;
      }
      if (word === lastSelectionWord) {
        return;
      }
      lastSelectionWord = word;

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        return;
      }
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        return;
      }

      showLookupButton(rect.left + rect.width / 2, rect.top);
    });
  }

  function onDoubleClick(event) {
    if (!event.target.closest(articleSelectors.join(", "))) {
      return;
    }

    requestAnimationFrame(() => {
      const word = getWordFromDoubleClick(event);
      if (word) {
        lookupWord(word, event.clientX, event.clientY);
      }
    });
  }

  function onDocumentClick(event) {
    if (event.target.closest && shadowRoot.host.contains(event.target)) {
      return;
    }
    if (!event.target.closest("#wordwise-widget-host")) {
      hideTooltip();
    }
  }

  function trackTimeOnPage() {
    if (timeOnPageSent) {
      return;
    }
    timeOnPageSent = true;
    const seconds = Math.round((Date.now() - pageLoadTime) / 1000);
    trackEvent("time_on_page", { seconds });
  }

  function glossaryEntryFromResult(result) {
    return {
      word: result.word,
      definition:
        result.contextExplanation?.matchedDefinition ||
        result.definitions?.[0]?.definition ||
        "",
      contextExplanation: result.contextExplanation?.explanation || "",
      fullForm: result.fullForm || "",
      partOfSpeech:
        result.definitions?.[0]?.partOfSpeech ||
        result.contextExplanation?.partOfSpeech ||
        "",
    };
  }

  function getSessionGlossaryEntries() {
    try {
      const all = JSON.parse(sessionStorage.getItem(GLOSSARY_SESSION_KEY) || "{}");
      return all[location.href] || [];
    } catch {
      return [];
    }
  }

  function addToSessionGlossary(entry) {
    try {
      const all = JSON.parse(sessionStorage.getItem(GLOSSARY_SESSION_KEY) || "{}");
      const list = all[location.href] || [];
      const existing = list.findIndex((e) => e.word === entry.word);
      if (existing >= 0) {
        list[existing] = { ...list[existing], ...entry };
      } else {
        list.unshift(entry);
      }
      all[location.href] = list.slice(0, 20);
      sessionStorage.setItem(GLOSSARY_SESSION_KEY, JSON.stringify(all));
    } catch {
      /* silent */
    }
  }

  function injectGlossaryStyles() {
    if (document.getElementById("wordwise-glossary-styles")) {
      return;
    }
    const accent = config.themeColor;
    const style = document.createElement("style");
    style.id = "wordwise-glossary-styles";
    style.textContent = `
      #wordwise-article-glossary {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        margin: 32px 0 16px;
        padding: 0;
        clear: both;
      }
      #wordwise-article-glossary .ww-gl-box {
        border: 1px solid #e0e0e0;
        border-left: 4px solid ${accent};
        border-radius: 8px;
        background: #fafafa;
        overflow: hidden;
      }
      #wordwise-article-glossary .ww-gl-header {
        padding: 14px 18px;
        background: #fff;
        border-bottom: 1px solid #eee;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
        user-select: none;
      }
      #wordwise-article-glossary .ww-gl-header:hover { background: #f5f5f5; }
      #wordwise-article-glossary .ww-gl-title {
        font-size: 15px;
        font-weight: 700;
        color: #1a1a1a;
      }
      #wordwise-article-glossary .ww-gl-sub {
        font-size: 12px;
        color: #888;
        margin-top: 2px;
        font-weight: 400;
      }
      #wordwise-article-glossary .ww-gl-toggle {
        color: ${accent};
        font-size: 18px;
        line-height: 1;
      }
      #wordwise-article-glossary .ww-gl-body { padding: 8px 18px 16px; }
      #wordwise-article-glossary .ww-gl-section {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: ${accent};
        font-weight: 700;
        margin: 14px 0 8px;
      }
      #wordwise-article-glossary .ww-gl-section:first-child { margin-top: 4px; }
      #wordwise-article-glossary .ww-gl-item {
        padding: 10px 0;
        border-bottom: 1px solid #eee;
      }
      #wordwise-article-glossary .ww-gl-item:last-child { border-bottom: none; }
      #wordwise-article-glossary .ww-gl-word {
        font-weight: 700;
        font-size: 14px;
        color: #1a1a1a;
      }
      #wordwise-article-glossary .ww-gl-fullform {
        font-size: 11px;
        color: #666;
        font-style: italic;
        margin-top: 2px;
      }
      #wordwise-article-glossary .ww-gl-def {
        font-size: 13px;
        color: #444;
        line-height: 1.5;
        margin-top: 4px;
      }
      #wordwise-article-glossary .ww-gl-context {
        font-size: 12px;
        color: #666;
        line-height: 1.45;
        margin-top: 6px;
        padding-left: 10px;
        border-left: 2px solid ${accent}44;
      }
      #wordwise-article-glossary .ww-gl-badge {
        display: inline-block;
        font-size: 10px;
        background: ${accent}18;
        color: ${accent};
        padding: 1px 7px;
        border-radius: 10px;
        margin-left: 8px;
        font-weight: 600;
      }
      #wordwise-article-glossary .ww-gl-empty {
        font-size: 13px;
        color: #999;
        padding: 8px 0;
        font-style: italic;
      }
      #wordwise-article-glossary.collapsed .ww-gl-body { display: none; }
      #wordwise-article-glossary.collapsed .ww-gl-toggle { transform: rotate(-90deg); }
    `;
    document.head.appendChild(style);
  }

  function findArticleElement() {
    if (cachedArticleEl && document.contains(cachedArticleEl)) {
      return cachedArticleEl;
    }
    for (const sel of articleSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        cachedArticleEl = el;
        return el;
      }
    }
    return null;
  }

  function renderGlossaryItem(entry, showCount) {
    const countBadge = showCount && entry.count > 1 ? `<span class="ww-gl-badge">${entry.count} readers</span>` : "";
    const fullForm = entry.fullForm ? `<div class="ww-gl-fullform">${escapeHtml(entry.fullForm)}</div>` : "";
    const context = entry.contextExplanation
      ? `<div class="ww-gl-context">${escapeHtml(entry.contextExplanation)}</div>`
      : "";
    return `
      <div class="ww-gl-item">
        <div class="ww-gl-word">${escapeHtml(entry.word)}${countBadge}</div>
        ${fullForm}
        <div class="ww-gl-def">${escapeHtml(entry.definition)}</div>
        ${context}
      </div>
    `;
  }

  async function fetchPopularGlossary() {
    const now = Date.now();
    if (popularGlossaryCache && now - popularGlossaryCacheTime < POPULAR_CACHE_TTL) {
      return popularGlossaryCache;
    }
    try {
      const params = new URLSearchParams({
        url: location.href,
        publisher: config.publisher,
      });
      const res = await fetch(`${config.apiBase}/api/analytics/article-glossary?${params}`);
      const data = await res.json();
      popularGlossaryCache = data.popular || [];
      popularGlossaryCacheTime = now;
      return popularGlossaryCache;
    } catch {
      return popularGlossaryCache || [];
    }
  }

  function scheduleArticleGlossaryRefresh() {
    clearTimeout(glossaryRefreshTimer);
    glossaryRefreshTimer = setTimeout(refreshArticleGlossary, 400);
  }

  async function refreshArticleGlossary() {
    injectGlossaryStyles();
    const article = findArticleElement();
    if (!article) {
      return;
    }

    let container = document.getElementById("wordwise-article-glossary");
    if (!container) {
      container = document.createElement("div");
      container.id = "wordwise-article-glossary";
      article.appendChild(container);
      container.addEventListener("click", (e) => {
        if (e.target.closest(".ww-gl-header")) {
          container.classList.toggle("collapsed");
        }
      });
    }

    const yours = getSessionGlossaryEntries();
    const popular = await fetchPopularGlossary();
    const yourWords = new Set(yours.map((e) => e.word));
    const popularFiltered = popular.filter((e) => !yourWords.has(e.word) && e.definition);

    const totalCount = yours.length + popularFiltered.length;
    const wasCollapsed = container.classList.contains("collapsed");

    let bodyHtml = "";
    if (yours.length > 0) {
      bodyHtml += `<div class="ww-gl-section">Your lookups</div>`;
      bodyHtml += yours.map((e) => renderGlossaryItem(e, false)).join("");
    }
    if (popularFiltered.length > 0) {
      bodyHtml += `<div class="ww-gl-section">Popular on this article</div>`;
      bodyHtml += popularFiltered.map((e) => renderGlossaryItem(e, true)).join("");
    }
    if (totalCount === 0) {
      bodyHtml = `<div class="ww-gl-empty">Words you look up will appear here — your one-stop reference at the end of the article.</div>`;
    }

    container.innerHTML = `
      <div class="ww-gl-box">
        <div class="ww-gl-header">
          <div>
            <div class="ww-gl-title">📖 Quick reference — words in this article</div>
            <div class="ww-gl-sub">${totalCount > 0 ? `${totalCount} word${totalCount === 1 ? "" : "s"}` : "Look up any word as you read"}</div>
          </div>
          <div class="ww-gl-toggle">▼</div>
        </div>
        <div class="ww-gl-body">${bodyHtml}</div>
      </div>
    `;
    if (wasCollapsed) {
      container.classList.add("collapsed");
    }
  }

  function initArticleGlossary() {
    injectGlossaryStyles();
    refreshArticleGlossary();
  }

  function init() {
    initShadowDom();
    createFab();
    createDashboardLink();
    initResetSync();

    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("dblclick", onDoubleClick, true);
    document.addEventListener("click", onDocumentClick, true);

    trackEvent("pageview", {});

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        trackTimeOnPage();
        flushAnalyticsQueue(true);
      }
    });
    window.addEventListener("pagehide", trackTimeOnPage);
    window.addEventListener("beforeunload", () => {
      trackTimeOnPage();
      flushAnalyticsQueue(true);
    });

    const defer = window.requestIdleCallback || ((fn) => setTimeout(fn, 1));
    defer(() => {
      showCoachMark();
      initArticleGlossary();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
