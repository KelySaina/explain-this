/*
 * Explain This — content script.
 *
 * Shows a small "Explain" bubble when you select text, and renders the
 * explanation in a card. Everything lives inside a Shadow DOM so the host
 * page's styles can never interfere (and ours never leak onto the page).
 *
 * The actual lookups happen in the background worker; this file only deals
 * with selection, positioning, and rendering.
 */
(function () {
  if (window.__explainThisLoaded) return;
  window.__explainThisLoaded = true;

  const api = globalThis.browser || globalThis.chrome;

  let settings = { autoBubble: true };
  try {
    api.storage.local.get(["settings"]).then((s) => {
      if (s && s.settings) settings = Object.assign(settings, s.settings);
    });
    api.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.settings && changes.settings.newValue) {
        settings = Object.assign(settings, changes.settings.newValue);
      }
    });
  } catch (_) {
    /* storage may be unavailable; defaults are fine */
  }

  /* ---------- Shadow DOM host ---------- */
  const host = document.createElement("div");
  host.id = "explain-this-root";
  host.style.cssText =
    "all: initial; position: fixed; top: 0; left: 0; width: 0; height: 0; z-index: 2147483647;";
  const root = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = CSS_TEXT();
  root.appendChild(style);

  const bubble = document.createElement("button");
  bubble.className = "et-bubble";
  bubble.type = "button";
  bubble.setAttribute("aria-label", "Explain selection");
  bubble.innerHTML = `${ICON_SVG()}<span>Explain</span>`;
  bubble.style.display = "none";
  root.appendChild(bubble);

  const card = document.createElement("div");
  card.className = "et-card";
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-label", "Explanation");
  card.style.display = "none";
  root.appendChild(card);

  function mount() {
    if (!host.isConnected) (document.body || document.documentElement).appendChild(host);
  }
  mount();

  /* ---------- Positioning ---------- */
  let lastSelectionText = "";

  function selectionRect() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) return null;
    return rect;
  }

  function placeBubble(rect) {
    const pad = 8;
    let top = rect.bottom + pad;
    let left = rect.left + rect.width / 2;
    // keep on screen; bubble is ~center-anchored
    bubble.style.display = "inline-flex";
    const bw = bubble.offsetWidth || 96;
    const bh = bubble.offsetHeight || 32;
    if (top + bh > window.innerHeight - 4) top = rect.top - pad - bh;
    left = Math.max(bw / 2 + 4, Math.min(left, window.innerWidth - bw / 2 - 4));
    bubble.style.top = Math.max(4, top) + "px";
    bubble.style.left = left + "px";
    bubble.style.transform = "translateX(-50%)";
  }

  function placeCard(rect) {
    card.style.display = "block";
    const cw = card.offsetWidth || 340;
    const ch = card.offsetHeight || 160;
    const pad = 10;
    let top = rect.bottom + pad;
    let left = rect.left;
    if (top + ch > window.innerHeight - 8) {
      const above = rect.top - pad - ch;
      top = above > 8 ? above : Math.max(8, window.innerHeight - ch - 8);
    }
    left = Math.max(8, Math.min(left, window.innerWidth - cw - 8));
    card.style.top = top + "px";
    card.style.left = left + "px";
  }

  function hideBubble() {
    bubble.style.display = "none";
  }
  function hideCard() {
    card.style.display = "none";
    card.innerHTML = "";
  }
  function hideAll() {
    hideBubble();
    hideCard();
  }

  /* ---------- Rendering ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function renderShell(bodyHtml) {
    card.innerHTML = `
      <div class="et-head">
        <span class="et-brand">${ICON_SVG()} Explain This</span>
        <button class="et-close" type="button" aria-label="Close">&times;</button>
      </div>
      <div class="et-body">${bodyHtml}</div>`;
    card.querySelector(".et-close").addEventListener("click", hideCard);
  }

  function renderLoading(term) {
    renderShell(
      `<div class="et-term">${esc(term)}</div>
       <div class="et-loading"><span class="et-spinner"></span> Looking it up…</div>`
    );
  }

  function sourceBadge(result) {
    if (result.source === "glossary")
      return `<span class="et-badge et-badge-glossary">${result.scope === "custom" ? "Your glossary" : "Glossary"}</span>`;
    if (result.source === "dictionary")
      return `<span class="et-badge et-badge-dict">Dictionary</span>`;
    if (result.source === "wikipedia")
      return `<span class="et-badge et-badge-wiki">Wikipedia</span>`;
    return "";
  }

  function renderResult(term, result) {
    if (!result || result.error) {
      renderShell(
        `<div class="et-term">${esc(term)}</div>
         <div class="et-error">${esc((result && result.error) || "No explanation found.")}</div>
         ${
           result && result.offline
             ? `<div class="et-hint">Dictionary &amp; Wikipedia are turned off in settings, so only the offline glossary was checked.</div>`
             : ""
         }`
      );
      return;
    }

    let body = "";

    if (result.source === "glossary") {
      body = `<div class="et-term">${esc(result.title)} ${sourceBadge(result)}</div>
              <p class="et-text">${esc(result.text)}</p>`;
    } else if (result.source === "dictionary") {
      const defs = (result.meanings || [])
        .map(
          (m) =>
            `<div class="et-pos">${esc(m.partOfSpeech)}</div>
             <ul class="et-defs">${m.definitions
               .map((d) => `<li>${esc(d)}</li>`)
               .join("")}</ul>`
        )
        .join("");
      body = `<div class="et-term">${esc(result.title)}
                ${result.phonetic ? `<span class="et-phon">${esc(result.phonetic)}</span>` : ""}
                ${sourceBadge(result)}
              </div>
              ${defs}
              <a class="et-more" href="${esc(result.url)}" target="_blank" rel="noopener noreferrer">More on Wiktionary →</a>`;
    } else if (result.source === "wikipedia") {
      body = `<div class="et-term">${esc(result.title)} ${sourceBadge(result)}</div>
              ${result.description ? `<div class="et-desc">${esc(result.description)}</div>` : ""}
              <div class="et-wiki">
                ${
                  result.thumbnail
                    ? `<img class="et-thumb" src="${esc(result.thumbnail)}" alt="" referrerpolicy="no-referrer">`
                    : ""
                }
                <p class="et-text">${esc(result.extract)}</p>
              </div>
              <a class="et-more" href="${esc(result.url)}" target="_blank" rel="noopener noreferrer">Read more on Wikipedia →</a>`;
    }

    renderShell(body);
  }

  /* ---------- Flow ---------- */
  let currentRect = null;

  function explainText(text, rect) {
    const term = String(text || "").trim();
    if (!term) return;
    hideBubble();
    currentRect = rect || selectionRect() || fallbackRect();
    renderLoading(term);
    placeCard(currentRect);

    api.runtime.sendMessage({ type: "EXPLAIN", text: term }).then(
      (result) => {
        renderResult(term, result);
        placeCard(currentRect);
      },
      () => {
        renderResult(term, { error: "Could not reach the explainer." });
        placeCard(currentRect);
      }
    );
  }

  function fallbackRect() {
    // Center-top of viewport when we have no selection geometry.
    return {
      top: 80, bottom: 80, left: window.innerWidth / 2 - 170,
      right: window.innerWidth / 2 + 170, width: 340, height: 0
    };
  }

  /* ---------- Events ---------- */
  document.addEventListener("mouseup", (e) => {
    // Ignore clicks on our own UI.
    if (e.target === host) return;
    setTimeout(() => {
      const sel = window.getSelection();
      const text = sel ? sel.toString().trim() : "";
      if (!settings.autoBubble) return;
      if (text && text.length >= 2 && text.length <= 300) {
        lastSelectionText = text;
        const rect = selectionRect();
        if (rect) placeBubble(rect);
      } else {
        hideBubble();
      }
    }, 10);
  });

  bubble.addEventListener("mousedown", (e) => {
    // Prevent the selection from being cleared before we read it.
    e.preventDefault();
    e.stopPropagation();
  });
  bubble.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = selectionRect();
    explainText(lastSelectionText, rect);
  });

  // Dismiss on outside interaction.
  document.addEventListener("mousedown", (e) => {
    if (e.target === host) return;
    hideBubble();
    if (card.style.display !== "none") {
      // Clicks genuinely outside the card close it.
      hideCard();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideAll();
  });
  window.addEventListener(
    "scroll",
    () => {
      hideBubble();
    },
    true
  );

  // Messages from the background worker (context menu + keyboard command)
  // and from the popup (asking for the current selection).
  api.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg) return;
    if (msg.type === "EXPLAIN_TEXT" && msg.text) {
      explainText(msg.text, selectionRect());
    } else if (msg.type === "EXPLAIN_CURRENT") {
      const sel = window.getSelection();
      const text = sel ? sel.toString().trim() : "";
      if (text) explainText(text, selectionRect());
    } else if (msg.type === "GET_SELECTION") {
      const sel = window.getSelection();
      const text = sel ? sel.toString().trim() : "";
      sendResponse({ text: text && text.length <= 300 ? text : "" });
      return true;
    }
  });

  /* ---------- Assets ---------- */
  function ICON_SVG() {
    return `<svg class="et-ico" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path fill="currentColor" d="M9 21h6v-1H9v1zm3-19a7 7 0 0 0-4 12.74c.6.43 1 .97 1 1.76h6c0-.79.4-1.33 1-1.76A7 7 0 0 0 12 2zm0 2a5 5 0 0 1 2.9 9.06c-.6.43-1.08 1-1.36 1.69h-3.08c-.28-.69-.76-1.26-1.36-1.69A5 5 0 0 1 12 4z"/>
    </svg>`;
  }

  function CSS_TEXT() {
    return `
      :host { all: initial; }
      * { box-sizing: border-box; }
      .et-bubble {
        all: unset;
        position: fixed;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font: 600 13px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        color: #fff;
        background: linear-gradient(135deg, #6366F1, #8B5CF6);
        padding: 7px 11px;
        border-radius: 999px;
        cursor: pointer;
        box-shadow: 0 4px 14px rgba(79, 70, 229, .45);
        user-select: none;
        transition: transform .08s ease, box-shadow .12s ease;
      }
      .et-bubble:hover { box-shadow: 0 6px 20px rgba(79, 70, 229, .55); }
      .et-bubble:active { transform: translateX(-50%) scale(.96) !important; }
      .et-ico { flex: none; }

      .et-card {
        position: fixed;
        width: 340px;
        max-width: calc(100vw - 16px);
        max-height: 60vh;
        overflow: auto;
        background: #ffffff;
        color: #1f2330;
        border: 1px solid rgba(0,0,0,.08);
        border-radius: 14px;
        box-shadow: 0 12px 40px rgba(0,0,0,.22);
        font: 400 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        animation: et-pop .12s ease-out;
      }
      @keyframes et-pop { from { opacity: 0; transform: translateY(4px) scale(.98); } to { opacity: 1; } }
      .et-head {
        display: flex; align-items: center; justify-content: space-between;
        padding: 10px 12px;
        border-bottom: 1px solid rgba(0,0,0,.07);
        position: sticky; top: 0; background: inherit; border-radius: 14px 14px 0 0;
      }
      .et-brand { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; font-size: 12px; color: #6366F1; letter-spacing: .02em; }
      .et-close { all: unset; cursor: pointer; font-size: 20px; line-height: 1; color: #9aa0ad; padding: 0 4px; }
      .et-close:hover { color: #1f2330; }
      .et-body { padding: 12px 14px 14px; }
      .et-term { font-size: 16px; font-weight: 700; margin-bottom: 6px; display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
      .et-phon { font-weight: 400; font-size: 13px; color: #6b7280; }
      .et-desc { font-size: 12px; color: #6b7280; text-transform: capitalize; margin-bottom: 8px; }
      .et-text { margin: 0 0 6px; }
      .et-pos { font-style: italic; color: #6366F1; font-size: 12px; margin-top: 8px; }
      .et-defs { margin: 4px 0 0; padding-left: 18px; }
      .et-defs li { margin: 2px 0; }
      .et-wiki { display: block; }
      .et-thumb { float: right; width: 84px; height: auto; border-radius: 8px; margin: 0 0 8px 10px; object-fit: cover; }
      .et-more { display: inline-block; margin-top: 10px; color: #6366F1; text-decoration: none; font-weight: 600; font-size: 13px; }
      .et-more:hover { text-decoration: underline; }
      .et-badge { font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 999px; text-transform: uppercase; letter-spacing: .04em; }
      .et-badge-glossary { background: #ecfdf5; color: #059669; }
      .et-badge-dict { background: #eff6ff; color: #2563eb; }
      .et-badge-wiki { background: #f5f3ff; color: #7c3aed; }
      .et-loading { display: flex; align-items: center; gap: 8px; color: #6b7280; padding: 6px 0; }
      .et-spinner { width: 14px; height: 14px; border: 2px solid rgba(99,102,241,.3); border-top-color: #6366F1; border-radius: 50%; animation: et-spin .7s linear infinite; }
      @keyframes et-spin { to { transform: rotate(360deg); } }
      .et-error { color: #b91c1c; }
      .et-hint { margin-top: 8px; font-size: 12px; color: #6b7280; }

      @media (prefers-color-scheme: dark) {
        .et-card { background: #1b1e27; color: #e6e8ee; border-color: rgba(255,255,255,.08); box-shadow: 0 12px 40px rgba(0,0,0,.6); }
        .et-head { border-bottom-color: rgba(255,255,255,.08); }
        .et-brand { color: #a5b4fc; }
        .et-close { color: #6b7280; }
        .et-close:hover { color: #e6e8ee; }
        .et-phon, .et-desc, .et-loading, .et-hint { color: #9aa0ad; }
        .et-pos { color: #a5b4fc; }
        .et-more { color: #a5b4fc; }
        .et-badge-glossary { background: rgba(5,150,105,.18); color: #34d399; }
        .et-badge-dict { background: rgba(37,99,235,.18); color: #60a5fa; }
        .et-badge-wiki { background: rgba(124,58,237,.2); color: #c4b5fd; }
        .et-error { color: #f87171; }
      }
    `;
  }
})();
