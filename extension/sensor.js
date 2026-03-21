console.log("[sensor] loaded");

// gives summary, gets back llama response
async function sendSummaryToBackground(payload) {
  // If you ever run in a non-extension environment, avoid crashing:
  if (typeof browser === "undefined" || !browser.runtime?.sendMessage) {
    console.warn("[sensor] browser.runtime.sendMessage not available");
    return null;
  }

  try {
    console.log("[sensor] sending page summary to background:", payload);
    const response = await browser.runtime.sendMessage({
      type: "PAGE_SUMMARY",
      payload,
    });
    console.log("[sensor] received response from background:", response);
    return response;
  } catch (e) {
    console.warn("[sensor] sendMessage failed:", e);
    return null;
  }
}

// ---------- extraction (your code, wrapped) ----------
function extractSummary() {
  const title = document.title || "";
  const href = location.href;

  const anchors = Array.from(document.querySelectorAll("a[href]"));
  const candidates = [];

  for (const a of anchors) {
    const raw = a.getAttribute("href");
    let url = window.PuppeteerHelpers.absUrl(raw);
    if (!url || window.PuppeteerHelpers.hasJunkyScheme(url)) continue;

    url = window.PuppeteerHelpers.unwrapGoogleUrl(url);
    if (!url || window.PuppeteerHelpers.hasJunkyScheme(url)) continue;

    if (
      window.PuppeteerHelpers.isGoogleVerticalOrInternal(
        window.PuppeteerHelpers.absUrl(raw),
      )
    )
      continue;

    const label =
      (a.textContent || "").trim() ||
      (a.getAttribute("aria-label") || "").trim();
    if (!label || label.length < 6) continue;
    if (!window.PuppeteerHelpers.isVisibleEnough(a)) continue;

    const finalUrl = window.PuppeteerHelpers.absUrl(url) || url;
    const score = window.PuppeteerHelpers.scoreAnchor(a, finalUrl);
    if (score < 3) continue;

    candidates.push({
      href: finalUrl,
      text: label.slice(0, 200),
      score,
    });
  }

  candidates.sort((a, b) => b.score - a.score);

  const seenUrl = new Set();
  const seenDomain = new Map();
  const topLinks = [];

  for (const c of candidates) {
    const key = window.PuppeteerHelpers.normForDedup(c.href);
    if (seenUrl.has(key)) continue;

    const domain = window.PuppeteerHelpers.getDomain(c.href);
    const count = seenDomain.get(domain) || 0;
    if (domain && count >= 2) continue;

    seenUrl.add(key);
    if (domain) seenDomain.set(domain, count + 1);

    topLinks.push({ text: c.text, href: c.href });
    // number of links here
    if (topLinks.length >= 5) break;
  }

  // ✅ Convert [{text, href}, ...] → ["text — href", ...]
  // (still List[str] as your schema wants)
  const links = topLinks.map((l) => {
    const shortText = l.text.replace(/\s+/g, " ").trim().slice(0, 40);
    return `${shortText} — ${l.href}`;
  });

  // ✅ Return EXACTLY what your FastAPI PageSummary expects
  return {
    url: href,
    title,
    links,
  };
}

async function getHistoryFromBackground() {
  try {
    const resp = await browser.runtime.sendMessage({
      type: "GET_ACTION_HISTORY",
    });

    if (!resp?.ok) {
      console.warn("[content] failed to get history:", resp?.error);
      return [];
    }

    return Array.isArray(resp.history) ? resp.history : [];
  } catch (e) {
    console.warn("[content] getHistoryFromBackground failed:", e);
    return [];
  }
}

async function rememberInBackground(decision) {
  try {
    const resp = await browser.runtime.sendMessage({
      type: "REMEMBER_ACTION",
      decision,
      url: location.href,
    });

    if (!resp?.ok) {
      console.warn("[content] failed to remember action:", resp?.error);
      return;
    }

    console.log("[content] remembered action, new history:", resp.history);
  } catch (e) {
    console.warn("[content] rememberInBackground failed:", e);
  }
}

window.PuppeteerSensor = {
  sendSummaryToBackground,
  extractSummary,
  getHistoryFromBackground,
  rememberInBackground,
};
