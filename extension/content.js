(() => {
  // ---------- helpers ----------
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
      // Optional: strip common tracking params
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
    // quick visibility heuristics
    const rect = el.getBoundingClientRect();
    if (rect.width < 30 || rect.height < 14) return false; // too small to be a “real click”
    if (rect.bottom < 0 || rect.top > window.innerHeight * 2) {
      // still allow below-the-fold, but avoid far-off junk during initial load
      // (tweak/remove if you want full-page scanning)
      return false;
    }
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
    // exclude links inside typical nav furniture
    return Boolean(
      a.closest(
        "header, nav, footer, [role='navigation'], [role='banner'], [role='contentinfo']",
      ),
    );
  };

  const looksLikeButtonOrUI = (a) => {
    // exclude UI widgets masquerading as links
    const role = a.getAttribute("role") || "";
    const aria = (a.getAttribute("aria-label") || "").toLowerCase();
    const text = (a.textContent || "").trim().toLowerCase();
    if (role.toLowerCase() === "button") return true;
    // common “utility” clicks on SERPs and apps
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

  // Google-specific: pull outbound link from /url?q=
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
    // filters "Images", "News", "Shopping", "AI mode", etc.
    try {
      const u = new URL(url);
      const host = u.hostname;
      if (!host.includes("google.")) return false;

      // Keep outbound unwrapped URLs; filter internal verticals
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

      // Google’s own “tabs” often have tbm=... etc.
      const tbm = u.searchParams.get("tbm");
      if (tbm && tbm !== "vid") return true; // images/news/shopping/books...
      return false;
    } catch {
      return false;
    }
  };

  const scoreAnchor = (a, finalUrl) => {
    // Higher score = more “human-likely”
    let score = 0;

    const text = (a.textContent || "").trim();
    const aria = (a.getAttribute("aria-label") || "").trim();
    const label = text || aria;

    // prefer descriptive link text
    if (label.length >= 20) score += 3;
    else if (label.length >= 8) score += 1;

    // big boost if it looks like a “result title”
    // Google/Bing/etc often use an <h3> inside the clickable <a>.
    if (a.querySelector("h1,h2,h3")) score += 8;

    // de-prioritize nav furniture
    if (isInChromeLikeNav(a)) score -= 6;

    // de-prioritize UI / control-like links
    if (looksLikeButtonOrUI(a)) score -= 6;

    // de-prioritize same-page and internal page chrome
    try {
      const u = new URL(finalUrl);
      if (
        u.origin === location.origin &&
        u.pathname === location.pathname &&
        u.search === location.search
      )
        score -= 8;
    } catch {}

    // prefer links in main/article containers when present
    if (a.closest("main, article, [role='main'], #search")) score += 4;

    // slight preference to above-the-fold items
    const r = a.getBoundingClientRect();
    if (r.top >= 0 && r.top <= window.innerHeight) score += 2;

    return score;
  };

  // ---------- extraction ----------
  const title = document.title || "";
  const href = location.href;

  const anchors = Array.from(document.querySelectorAll("a[href]"));

  const candidates = [];

  for (const a of anchors) {
    const raw = a.getAttribute("href");
    let url = absUrl(raw);
    if (!url || hasJunkyScheme(url)) continue;

    // If on Google, unwrap /url?q= into outbound
    url = unwrapGoogleUrl(url);
    if (!url || hasJunkyScheme(url)) continue;

    // Filter Google verticals/internal chrome
    if (isGoogleVerticalOrInternal(absUrl(raw))) continue;

    // Basic “human click” filters
    const label =
      (a.textContent || "").trim() ||
      (a.getAttribute("aria-label") || "").trim();
    if (!label || label.length < 6) continue; // kills “empty rows” and icon-only anchors
    if (!isVisibleEnough(a)) continue;

    const finalUrl = absUrl(url) || url;
    const score = scoreAnchor(a, finalUrl);

    if (score < 3) continue; // threshold: tune this up/down

    candidates.push({
      href: finalUrl,
      text: label.slice(0, 200),
      score,
    });
  }

  // ---------- rank + dedupe ----------
  candidates.sort((a, b) => b.score - a.score);

  const seenUrl = new Set();
  const seenDomain = new Map(); // domain -> count
  const topLinks = [];

  for (const c of candidates) {
    const key = normForDedup(c.href);
    if (seenUrl.has(key)) continue;

    const domain = getDomain(c.href);
    const count = seenDomain.get(domain) || 0;
    if (domain && count >= 2) continue; // don’t let one domain dominate

    seenUrl.add(key);
    if (domain) seenDomain.set(domain, count + 1);

    topLinks.push({ text: c.text, href: c.href });

    if (topLinks.length >= 10) break;
  }

  const payload = {
    title,
    href,
    topLinks,
    extractedAt: new Date().toISOString(),
  };

  console.log("[sensor] page summary extracted:", payload);
  console.table(
    topLinks.map((l, i) => ({ rank: i + 1, text: l.text, href: l.href })),
  );

  return payload;
})();
