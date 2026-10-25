/*
 * Explain This — background service worker (classic, cross-browser).
 *
 * Responsibilities:
 *   - Own the lookup pipeline: offline glossary -> dictionary -> Wikipedia.
 *   - Register the right-click context menu and the keyboard command.
 *   - Network requests live here (host_permissions grant cross-origin fetch),
 *     so the content script never has to worry about CORS.
 *
 * Privacy: the only time any text leaves the device is when the user explicitly
 * asks for an explanation and the glossary did not already answer it. Then the
 * single selected term is sent to the dictionary / Wikipedia APIs. Nothing else.
 */

const api = globalThis.browser || globalThis.chrome;

/* ------------------------------------------------------------------ *
 * Built-in offline glossary.
 * Keys are normalized (see normalize()). Answers are instant and need
 * no network. Users can add their own entries from the options page.
 * ------------------------------------------------------------------ */
const GLOSSARY = {
  // Latin / writing abbreviations
  "eg": "e.g. — “for example” (Latin: exempli gratia). Introduces one or more examples.",
  "ie": "i.e. — “that is” / “in other words” (Latin: id est). Restates or clarifies the point before it.",
  "etc": "etc. — “and so on” (Latin: et cetera). Indicates the list continues in the same vein.",
  "et al": "et al. — “and others” (Latin: et alii). Used to shorten a list of authors or people.",
  "nb": "N.B. — “note well” (Latin: nota bene). Flags something important.",
  "ps": "P.S. — “postscript”. An afterthought added after the main text or signature.",
  "vs": "vs. — “versus” / “against”. Marks two things being compared or opposed.",
  "aka": "a.k.a. — “also known as”. Introduces an alternative name.",
  "cf": "cf. — “compare” (Latin: confer). Points you to something to compare against.",

  // Common internet / chat shorthand
  "asap": "ASAP — As Soon As Possible.",
  "fyi": "FYI — For Your Information.",
  "tbd": "TBD — To Be Determined (not yet decided).",
  "tba": "TBA — To Be Announced.",
  "eta": "ETA — Estimated Time of Arrival (when something is expected).",
  "diy": "DIY — Do It Yourself.",
  "faq": "FAQ — Frequently Asked Questions.",
  "ama": "AMA — Ask Me Anything (an open Q&A session).",
  "tldr": "TL;DR — “Too Long; Didn't Read”. A short summary of a long piece of text.",
  "imo": "IMO — In My Opinion.",
  "imho": "IMHO — In My Humble/Honest Opinion.",
  "ymmv": "YMMV — “Your Mileage May Vary”. Results or experiences may differ for you.",
  "rsvp": "RSVP — please reply (French: répondez s'il vous plaît), used on invitations.",
  "wip": "WIP — Work In Progress.",
  "eod": "EOD — End Of Day.",
  "ooo": "OOO — Out Of Office.",

  // Tech
  "api": "API — Application Programming Interface: a set of rules that lets one piece of software talk to another.",
  "url": "URL — Uniform Resource Locator: the web address of a page or file.",
  "http": "HTTP — HyperText Transfer Protocol: the system browsers use to request web pages.",
  "https": "HTTPS — the secure, encrypted version of HTTP (the padlock in your address bar).",
  "dns": "DNS — Domain Name System: the “phone book” that turns names like example.com into numeric IP addresses.",
  "vpn": "VPN — Virtual Private Network: routes your traffic through an encrypted tunnel to protect privacy.",
  "cpu": "CPU — Central Processing Unit: the main “brain” chip that runs a computer's instructions.",
  "gpu": "GPU — Graphics Processing Unit: a chip specialized for graphics and parallel math (also used for AI).",
  "ram": "RAM — Random Access Memory: fast, temporary memory a computer uses for work in progress.",
  "ssd": "SSD — Solid State Drive: fast storage with no moving parts.",
  "os": "OS — Operating System: the core software (Windows, macOS, Linux, Android...) that runs a device.",
  "ide": "IDE — Integrated Development Environment: an app for writing and running code.",
  "cli": "CLI — Command-Line Interface: controlling software by typing text commands.",
  "gui": "GUI — Graphical User Interface: controlling software with windows, icons and buttons.",
  "sdk": "SDK — Software Development Kit: tools and libraries for building on a platform.",
  "sql": "SQL — Structured Query Language: the standard language for querying databases.",
  "json": "JSON — JavaScript Object Notation: a simple text format for storing and exchanging data.",
  "html": "HTML — HyperText Markup Language: the code that defines the structure of a web page.",
  "css": "CSS — Cascading Style Sheets: the code that controls how a web page looks.",
  "ai": "AI — Artificial Intelligence: software that performs tasks normally needing human intelligence.",
  "ml": "ML — Machine Learning: AI that improves by learning patterns from data instead of being explicitly programmed.",
  "llm": "LLM — Large Language Model: an AI trained on huge amounts of text to understand and generate language.",
  "nlp": "NLP — Natural Language Processing: getting computers to understand human language.",
  "2fa": "2FA — Two-Factor Authentication: a second proof of identity (like a code) on top of your password.",

  // Business / finance
  "ceo": "CEO — Chief Executive Officer: the top leader of a company.",
  "cfo": "CFO — Chief Financial Officer: the executive in charge of a company's finances.",
  "cto": "CTO — Chief Technology Officer: the executive in charge of technology.",
  "roi": "ROI — Return On Investment: how much you gain relative to what you spent.",
  "kpi": "KPI — Key Performance Indicator: a key metric used to measure success.",
  "b2b": "B2B — Business to Business: companies selling to other companies.",
  "b2c": "B2C — Business to Consumer: companies selling directly to individuals.",
  "saas": "SaaS — Software as a Service: software you use online by subscription instead of installing.",
  "ipo": "IPO — Initial Public Offering: the first time a company sells shares to the public.",
  "vc": "VC — Venture Capital: investment funding for high-growth startups.",
  "apr": "APR — Annual Percentage Rate: the yearly cost of borrowing, including fees.",
  "apy": "APY — Annual Percentage Yield: the yearly return on savings, including compounding.",
  "gdp": "GDP — Gross Domestic Product: the total value of goods and services a country produces.",
  "ebitda": "EBITDA — Earnings Before Interest, Taxes, Depreciation and Amortization: a measure of a company's core profitability.",

  // Health (basic, non-advice)
  "bmi": "BMI — Body Mass Index: a rough weight-to-height ratio used as a general health indicator.",
  "er": "ER — Emergency Room: the hospital department for urgent, serious conditions.",
  "icu": "ICU — Intensive Care Unit: a hospital ward for critically ill patients.",
  "otc": "OTC — Over The Counter: medicine you can buy without a prescription.",

  // Orgs
  "who": "WHO — World Health Organization: the United Nations agency for international public health.",
  "un": "UN — United Nations: an international organization of countries promoting peace and cooperation.",
  "eu": "EU — European Union: a political and economic union of European countries.",
  "nasa": "NASA — the U.S. National Aeronautics and Space Administration (space agency).",
  "nato": "NATO — North Atlantic Treaty Organization: a military alliance of North American and European countries."
};

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

// Normalize a term for glossary lookup: lowercase, strip surrounding
// punctuation, collapse inner whitespace. Keeps "e.g." -> "eg", "t;dr" handled.
function normalize(text) {
  return String(text)
    .toLowerCase()
    .replace(/[.;:]/g, "")
    .replace(/[^\p{L}\p{N}\s&/-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function getSettings() {
  const defaults = {
    autoBubble: true,
    useDictionary: true,
    useWikipedia: true,
    lang: "en"
  };
  try {
    const stored = await api.storage.local.get(["settings"]);
    return Object.assign(defaults, stored.settings || {});
  } catch (_) {
    return defaults;
  }
}

async function getCustomGlossary() {
  try {
    const stored = await api.storage.local.get(["customGlossary"]);
    return stored.customGlossary || {};
  } catch (_) {
    return {};
  }
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms)
    )
  ]);
}

// --- Dictionary (single words) ---
async function lookupDictionary(word) {
  const url =
    "https://api.dictionaryapi.dev/api/v2/entries/en/" +
    encodeURIComponent(word.toLowerCase());
  const res = await withTimeout(fetch(url), 8000);
  if (!res.ok) return null;
  const data = await res.json();
  const entry = Array.isArray(data) ? data[0] : null;
  if (!entry) return null;

  const phonetic =
    entry.phonetic ||
    (entry.phonetics || []).map((p) => p.text).find(Boolean) ||
    "";

  const meanings = (entry.meanings || []).slice(0, 3).map((m) => ({
    partOfSpeech: m.partOfSpeech || "",
    definitions: (m.definitions || [])
      .slice(0, 2)
      .map((d) => d.definition)
      .filter(Boolean)
  }));

  if (!meanings.length) return null;

  return {
    source: "dictionary",
    title: entry.word || word,
    phonetic,
    meanings,
    url: "https://en.wiktionary.org/wiki/" + encodeURIComponent(word.toLowerCase())
  };
}

// --- Wikipedia (anything) ---
async function lookupWikipedia(term, lang) {
  const base = `https://${encodeURIComponent(lang || "en")}.wikipedia.org`;

  async function summaryFor(title) {
    const url =
      base +
      "/api/rest_v1/page/summary/" +
      encodeURIComponent(title) +
      "?redirect=true";
    const res = await withTimeout(fetch(url), 8000);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || data.type === "https://mediawiki.org/wiki/HyperSwitch/errors/not_found")
      return null;
    if (!data.extract) return null;
    return data;
  }

  // 1) Try the term directly.
  let data = await summaryFor(term);

  // 2) If missing or a disambiguation page, find the best-matching title.
  //    OpenSearch is CORS-enabled and resilient; returns [q, titles, descs, urls].
  if (!data || data.type === "disambiguation") {
    try {
      const sUrl =
        base +
        "/w/api.php?action=opensearch&limit=1&namespace=0&format=json&origin=*&search=" +
        encodeURIComponent(term);
      const sRes = await withTimeout(fetch(sUrl), 8000);
      if (sRes.ok) {
        const sData = await sRes.json();
        const hitTitle = Array.isArray(sData) && sData[1] && sData[1][0];
        if (hitTitle) {
          const better = await summaryFor(hitTitle);
          if (better) data = better;
        }
      }
    } catch (_) {
      /* ignore search failure, fall through */
    }
  }

  if (!data || !data.extract) return null;

  return {
    source: "wikipedia",
    title: data.title || term,
    extract: data.extract,
    description: data.description || "",
    thumbnail: (data.thumbnail && data.thumbnail.source) || "",
    url:
      (data.content_urls &&
        data.content_urls.desktop &&
        data.content_urls.desktop.page) ||
      `${base}/wiki/${encodeURIComponent(term)}`
  };
}

/* ------------------------------------------------------------------ *
 * Main pipeline
 * ------------------------------------------------------------------ */
async function explain(rawText) {
  const text = String(rawText || "").trim();
  if (!text) return { error: "Nothing was selected." };
  if (text.length > 300)
    return { error: "That selection is a bit long — try picking a word or short phrase." };

  const settings = await getSettings();
  const norm = normalize(text);

  // 1) Custom glossary (user) then built-in glossary — fully offline.
  const custom = await getCustomGlossary();
  const customNorm = {};
  for (const k of Object.keys(custom)) customNorm[normalize(k)] = custom[k];

  if (customNorm[norm])
    return { source: "glossary", scope: "custom", title: text, text: customNorm[norm] };
  if (GLOSSARY[norm])
    return { source: "glossary", scope: "builtin", title: text, text: GLOSSARY[norm] };

  const words = text.split(/\s+/).filter(Boolean);
  const isSingleWord = words.length === 1 && /^[\p{L}'-]+$/u.test(words[0]);

  // 2) Dictionary for a single plain word.
  if (isSingleWord && settings.useDictionary) {
    try {
      const d = await lookupDictionary(words[0]);
      if (d) return d;
    } catch (_) {
      /* fall through to Wikipedia */
    }
  }

  // 3) Wikipedia for phrases / proper nouns / concepts.
  if (settings.useWikipedia) {
    try {
      const w = await lookupWikipedia(text, settings.lang);
      if (w) return w;
    } catch (_) {
      /* fall through to not-found */
    }
  }

  // 4) Last chance: if we skipped the dictionary earlier, try it now.
  if (!isSingleWord && settings.useDictionary && words.length === 1) {
    try {
      const d = await lookupDictionary(words[0]);
      if (d) return d;
    } catch (_) {
      /* ignore */
    }
  }

  return {
    error: `No explanation found for “${text}”.`,
    offline: !settings.useDictionary && !settings.useWikipedia
  };
}

/* ------------------------------------------------------------------ *
 * Messaging
 * ------------------------------------------------------------------ */
api.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "EXPLAIN") {
    explain(msg.text)
      .then((result) => sendResponse(result))
      .catch((err) =>
        sendResponse({ error: "Something went wrong: " + (err && err.message) })
      );
    return true; // keep the message channel open for the async response
  }
});

/* ------------------------------------------------------------------ *
 * Context menu + keyboard command
 * ------------------------------------------------------------------ */
function createMenu() {
  try {
    api.contextMenus.removeAll(() => {
      api.contextMenus.create({
        id: "explain-this",
        title: 'Explain “%s”',
        contexts: ["selection"]
      });
    });
  } catch (_) {
    /* contextMenus may be unavailable in some contexts */
  }
}

api.runtime.onInstalled.addListener(createMenu);
api.runtime.onStartup && api.runtime.onStartup.addListener(createMenu);

api.contextMenus &&
  api.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "explain-this" && info.selectionText && tab && tab.id != null) {
      api.tabs.sendMessage(tab.id, {
        type: "EXPLAIN_TEXT",
        text: info.selectionText
      });
    }
  });

api.commands &&
  api.commands.onCommand.addListener((command, tab) => {
    if (command === "explain-selection" && tab && tab.id != null) {
      api.tabs.sendMessage(tab.id, { type: "EXPLAIN_CURRENT" });
    }
  });
