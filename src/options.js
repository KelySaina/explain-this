/* Explain This — options page logic. */
(function () {
  const api = globalThis.browser || globalThis.chrome;

  const els = {
    autoBubble: document.getElementById("autoBubble"),
    useDictionary: document.getElementById("useDictionary"),
    useWikipedia: document.getElementById("useWikipedia"),
    lang: document.getElementById("lang"),
    saved: document.getElementById("saved"),
    gTerm: document.getElementById("gTerm"),
    gDef: document.getElementById("gDef"),
    gAdd: document.getElementById("gAdd"),
    glist: document.getElementById("glist"),
    gEmpty: document.getElementById("gEmpty")
  };

  const DEFAULTS = { autoBubble: true, useDictionary: true, useWikipedia: true, lang: "en" };
  let customGlossary = {};

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  let savedTimer = null;
  function flashSaved() {
    els.saved.classList.add("show");
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => els.saved.classList.remove("show"), 1200);
  }

  function saveSettings() {
    const settings = {
      autoBubble: els.autoBubble.checked,
      useDictionary: els.useDictionary.checked,
      useWikipedia: els.useWikipedia.checked,
      lang: els.lang.value
    };
    api.storage.local.set({ settings }).then(flashSaved);
  }

  function renderGlossary() {
    const keys = Object.keys(customGlossary).sort((a, b) => a.localeCompare(b));
    els.glist.innerHTML = keys
      .map(
        (k) =>
          `<li><span class="gt">${esc(k)}</span><span class="gd">${esc(
            customGlossary[k]
          )}</span><button class="gx" data-k="${esc(k)}" title="Remove">&times;</button></li>`
      )
      .join("");
    els.gEmpty.style.display = keys.length ? "none" : "block";
    els.glist.querySelectorAll(".gx").forEach((btn) => {
      btn.addEventListener("click", () => {
        delete customGlossary[btn.getAttribute("data-k")];
        persistGlossary();
        renderGlossary();
      });
    });
  }

  function persistGlossary() {
    api.storage.local.set({ customGlossary }).then(flashSaved);
  }

  function addTerm() {
    const term = els.gTerm.value.trim();
    const def = els.gDef.value.trim();
    if (!term || !def) return;
    customGlossary[term] = def;
    persistGlossary();
    renderGlossary();
    els.gTerm.value = "";
    els.gDef.value = "";
    els.gTerm.focus();
  }

  // Wire up
  ["autoBubble", "useDictionary", "useWikipedia"].forEach((id) =>
    els[id].addEventListener("change", saveSettings)
  );
  els.lang.addEventListener("change", saveSettings);
  els.gAdd.addEventListener("click", addTerm);
  els.gDef.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addTerm();
  });

  // Load current state
  api.storage.local.get(["settings", "customGlossary"]).then((stored) => {
    const s = Object.assign({}, DEFAULTS, stored.settings || {});
    els.autoBubble.checked = s.autoBubble;
    els.useDictionary.checked = s.useDictionary;
    els.useWikipedia.checked = s.useWikipedia;
    els.lang.value = s.lang;
    customGlossary = stored.customGlossary || {};
    renderGlossary();
  });
})();
