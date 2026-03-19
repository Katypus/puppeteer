console.log("[helpers] loaded");

const absUrl = (href) => {
  try {
    return new URL(href, location.href).href;
  } catch {
    return null;
  }
};

const normForDedup = (url) => {
  try {
    const u = new URL(url);
    u.hash = "";
    [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
    ].forEach((p) => u.searchParams.delete(p));
    return u.href;
  } catch {
    return url;
  }
};

const getDomain = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

const isVisibleEnough = (el) => {
  const rect = el.getBoundingClientRect();
  if (rect.width < 30 || rect.height < 14) return false;
  if (rect.bottom < 0 || rect.top > window.innerHeight * 2) return false;
  const style = window.getComputedStyle(el);
  if (
    style.display === "none" ||
    style.visibility === "hidden" ||
    style.opacity === "0"
  )
    return false;
  return true;
};

const hasJunkyScheme = (url) => {
  if (!url) return true;
  const lower = url.toLowerCase();
  return (
    lower.startsWith("javascript:") ||
    lower.startsWith("mailto:") ||
    lower.startsWith("tel:") ||
    lower.startsWith("data:") ||
    lower.startsWith("blob:") ||
    lower.startsWith("about:") ||
    lower === "#" ||
    lower.endsWith("#")
  );
};

const isInChromeLikeNav = (a) => {
  return Boolean(
    a.closest(
      "header, nav, footer, [role='navigation'], [role='banner'], [role='contentinfo']",
    ),
  );
};

const looksLikeButtonOrUI = (a) => {
  const role = a.getAttribute("role") || "";
  const aria = (a.getAttribute("aria-label") || "").toLowerCase();
  const text = (a.textContent || "").trim().toLowerCase();
  if (role.toLowerCase() === "button") return true;
  const uiWords = [
    "sign in",
    "log in",
    "settings",
    "tools",
    "filters",
    "privacy",
    "terms",
    "help",
    "more",
    "next",
    "previous",
  ];
  if (uiWords.includes(text)) return true;
  if (uiWords.some((w) => aria.includes(w))) return true;
  return false;
};

function waitForRealLinks(timeout = 3000) {
  return new Promise((resolve) => {
    const start = Date.now();

    const check = () => {
      const links = document.querySelectorAll("a[href]");
      if (links.length > 20) {
        resolve();
        return;
      }

      if (Date.now() - start > timeout) {
        resolve(); // give up after timeout
        return;
      }

      requestAnimationFrame(check);
    };

    check();
  });
}

const unwrapGoogleUrl = (url) => {
  try {
    const u = new URL(url);
    if (u.hostname.endsWith("google.com") && u.pathname === "/url") {
      const q = u.searchParams.get("q");
      if (q) return q;
    }
    return url;
  } catch {
    return url;
  }
};

const isGoogleVerticalOrInternal = (url) => {
  try {
    const u = new URL(url);
    const host = u.hostname;
    if (!host.includes("google.")) return false;

    const p = u.pathname;
    if (p.startsWith("/search")) return true;
    if (p.startsWith("/imgres")) return true;
    if (p.startsWith("/shopping")) return true;
    if (p.startsWith("/maps")) return true;
    if (p.startsWith("/travel")) return true;
    if (p.startsWith("/flights")) return true;
    if (p.startsWith("/finance")) return true;
    if (p.startsWith("/preferences")) return true;
    if (p.startsWith("/setprefs")) return true;
    if (p.startsWith("/advanced_search")) return true;

    const tbm = u.searchParams.get("tbm");
    if (tbm && tbm !== "vid") return true;
    return false;
  } catch {
    return false;
  }
};

const scoreAnchor = (a, finalUrl) => {
  let score = 0;

  const text = (a.textContent || "").trim();
  const aria = (a.getAttribute("aria-label") || "").trim();
  const label = text || aria;

  if (label.length >= 20) score += 3;
  else if (label.length >= 8) score += 1;

  if (a.querySelector("h1,h2,h3")) score += 8;

  if (isInChromeLikeNav(a)) score -= 6;
  if (looksLikeButtonOrUI(a)) score -= 6;

  try {
    const u = new URL(finalUrl);
    if (
      u.origin === location.origin &&
      u.pathname === location.pathname &&
      u.search === location.search
    )
      score -= 8;
  } catch {}

  if (a.closest("main, article, [role='main'], #search")) score += 4;

  const r = a.getBoundingClientRect();
  if (r.top >= 0 && r.top <= window.innerHeight) score += 2;

  return score;
};

window.PuppeteerHelpers = {
  absUrl,
  normForDedup,
  getDomain,
  isVisibleEnough,
  hasJunkyScheme,
  isInChromeLikeNav,
  looksLikeButtonOrUI,
  waitForRealLinks,
  unwrapGoogleUrl,
  isGoogleVerticalOrInternal,
  scoreAnchor,
};
