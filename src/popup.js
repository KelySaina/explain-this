/* Explain This — toolbar popup: type a term, get an explanation. */
(function () {
  const api = globalThis.browser || globalThis.chrome;

  const form = document.getElementById("form");
  const input = document.getElementById("q");
  const result = document.getElementById("result");

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function badge(r) {
    if (r.source === "glossary")
      return `<span class="badge b-glossary">${r.scope === "custom" ? "Your glossary" : "Glossary"}</span>`;
    if (r.source === "dictionary") return `<span class="badge b-dict">Dictionary</span>`;
    if (r.source === "wikipedia") return `<span class="badge b-wiki">Wikipedia</span>`;
    return "";
  }

  function render(term, r) {
    if (!r || r.error) {
      result.innerHTML = `<div class="error">${esc((r && r.error) || "No explanation found.")}</div>${
        r && r.offline
          ? `<div class="muted" style="margin-top:6px;font-size:12px">Dictionary &amp; Wikipedia are off in settings.</div>`
          : ""
      }`;
      return;
    }
    if (r.source === "glossary") {
      result.innerHTML = `<div class="term">${esc(r.title)} ${badge(r)}</div><p>${esc(r.text)}</p>`;
    } else if (r.source === "dictionary") {
      const defs = (r.meanings || [])
        .map(
          (m) =>
            `<div class="pos">${esc(m.partOfSpeech)}</div><ul class="defs">${m.definitions
              .map((d) => `<li>${esc(d)}</li>`)
              .join("")}</ul>`
        )
        .join("");
      result.innerHTML = `<div class="term">${esc(r.title)}${
        r.phonetic ? ` <span class="phon">${esc(r.phonetic)}</span>` : ""
      } ${badge(r)}</div>${defs}<a class="more" href="${esc(
        r.url
      )}" target="_blank" rel="noopener noreferrer">More on Wiktionary →</a>`;
    } else if (r.source === "wikipedia") {
      result.innerHTML = `<div class="term">${esc(r.title)} ${badge(r)}</div>${
        r.description ? `<div class="desc">${esc(r.description)}</div>` : ""
      }${
        r.thumbnail
          ? `<img class="thumb" src="${esc(r.thumbnail)}" alt="" referrerpolicy="no-referrer">`
          : ""
      }<p>${esc(r.extract)}</p><a class="more" href="${esc(
        r.url
      )}" target="_blank" rel="noopener noreferrer">Read more on Wikipedia →</a>`;
    }
  }

  function run(term) {
    term = String(term || "").trim();
    if (!term) return;
    result.innerHTML = `<div class="muted"><span class="spinner"></span>Looking it up…</div>`;
    api.runtime.sendMessage({ type: "EXPLAIN", text: term }).then(
      (r) => render(term, r),
      () => render(term, { error: "Could not reach the explainer." })
    );
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    run(input.value);
  });

  document.getElementById("openOptions").addEventListener("click", () => {
    if (api.runtime.openOptionsPage) api.runtime.openOptionsPage();
  });

  // If the user already has text selected in the active tab, prefill it.
  try {
    api.tabs
      .query({ active: true, currentWindow: true })
      .then((tabs) => {
        const tab = tabs && tabs[0];
        if (!tab || tab.id == null) return;
        api.tabs
          .sendMessage(tab.id, { type: "GET_SELECTION" })
          .then((sel) => {
            if (sel && sel.text) {
              input.value = sel.text;
              run(sel.text);
            }
          })
          .catch(() => {});
      })
      .catch(() => {});
  } catch (_) {
    /* no tabs permission in some contexts; ignore */
  }
})();
