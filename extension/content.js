(() => {
  console.log("[content] loaded on", location.href);
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

  // ---------- decision execution helpers ----------
  function findElement(target = {}) {
    const { selector, text, hrefIncludes } = target;

    if (selector) {
      const el = document.querySelector(selector);
      if (el) return el;
    }

    if (text) {
      const normalized = text.trim().toLowerCase();
      const candidates = Array.from(
        document.querySelectorAll(
          "a, button, [role='button'], input[type='submit'], input[type='button']",
        ),
      );

      const exact =
        candidates.find(
          (e) =>
            (e.innerText || e.value || "").trim().toLowerCase() === normalized,
        ) ||
        candidates.find((e) =>
          (e.innerText || e.value || "")
            .trim()
            .toLowerCase()
            .includes(normalized),
        );

      if (exact) return exact;
    }

    if (hrefIncludes) {
      const needle = hrefIncludes.toLowerCase();
      const candidates = Array.from(document.querySelectorAll("a[href]"));
      const el = candidates.find((a) =>
        (a.href || "").toLowerCase().includes(needle),
      );
      if (el) return el;
    }

    return null;
  }

  function executeDecision(decision) {
    if (!decision || !decision.action) return;

    switch (decision.action) {
      case "click": {
        const el = findElement(decision.target);
        if (!el)
          return console.warn(
            "[executor] click target not found:",
            decision.target,
          );
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        el.click();
        return;
      }
      case "scroll": {
        const v = decision.value;
        if (v === "down")
          window.scrollBy({
            top: window.innerHeight * 0.9,
            behavior: "smooth",
          });
        else if (v === "up")
          window.scrollBy({
            top: -window.innerHeight * 0.9,
            behavior: "smooth",
          });
        else {
          const px = Number(v);
          if (!Number.isNaN(px))
            window.scrollBy({ top: px, behavior: "smooth" });
        }
        return;
      }
      case "navigate": {
        const url = decision.value;
        if (typeof url === "string" && url) window.location.href = url;
        return;
      }
      case "type": {
        const el = findElement(decision.target);
        if (!el)
          return console.warn(
            "[executor] type target not found:",
            decision.target,
          );
        const value = decision.value;
        if (typeof value !== "string") return;

        el.focus();
        if ("value" in el) {
          el.value = value;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        } else if (el.isContentEditable) {
          el.textContent = value;
          el.dispatchEvent(new Event("input", { bubbles: true }));
        }
        return;
      }
      case "noop":
      default:
        return;
    }
  }

  async function sendSummaryToBackground(payload) {
    // If you ever run in a non-extension environment, avoid crashing:
    if (typeof browser === "undefined" || !browser.runtime?.sendMessage) {
      console.warn("[sensor] browser.runtime.sendMessage not available");
      return null;
    }

    try {
      return await browser.runtime.sendMessage({
        type: "PAGE_SUMMARY",
        payload,
      });
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
      let url = absUrl(raw);
      if (!url || hasJunkyScheme(url)) continue;

      url = unwrapGoogleUrl(url);
      if (!url || hasJunkyScheme(url)) continue;

      if (isGoogleVerticalOrInternal(absUrl(raw))) continue;

      const label =
        (a.textContent || "").trim() ||
        (a.getAttribute("aria-label") || "").trim();
      if (!label || label.length < 6) continue;
      if (!isVisibleEnough(a)) continue;

      const finalUrl = absUrl(url) || url;
      const score = scoreAnchor(a, finalUrl);
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
      const key = normForDedup(c.href);
      if (seenUrl.has(key)) continue;

      const domain = getDomain(c.href);
      const count = seenDomain.get(domain) || 0;
      if (domain && count >= 2) continue;

      seenUrl.add(key);
      if (domain) seenDomain.set(domain, count + 1);

      topLinks.push({ text: c.text, href: c.href });
      if (topLinks.length >= 10) break;
    }

    // ✅ Convert [{text, href}, ...] → ["text — href", ...]
    // (still List[str] as your schema wants)
    const links = topLinks.map((l) => `${l.text} — ${l.href}`);

    // ✅ Return EXACTLY what your FastAPI PageSummary expects
    return {
      url: href,
      title,
      links,
    };
  }

  // ---------- main flow ----------
  async function main() {
    await waitForRealLinks();
    const payload = extractSummary();

    console.log("[sensor] page summary extracted:", payload);
    console.table(
      payload.links.map((s, i) => ({
        rank: i + 1,
        link: s,
      })),
    );
    // 1) send to backend via background
    const resp = await sendSummaryToBackground(payload);

    // Background will return: { ok: true, decision: {...} } or { ok: false, error: "..." }
    if (!resp) return;
    if (!resp.ok) {
      console.warn("[sensor] backend error:", resp.error);
      return;
    }

    // 2) execute decision
    console.log("[executor] decision:", resp.decision);
    executeDecision(resp.decision);
  }

  // IMPORTANT: do NOT auto-run on page load anymore.
  // main();

  browser.runtime.onMessage.addListener((msg) => {
    if (msg?.type !== "RUN_DECISION_LOOP") return;

    // optional: prevent double-runs if you click twice quickly
    if (window.__decisionLoopRunning) {
      return Promise.resolve({ ok: false, error: "Already running" });
    }

    window.__decisionLoopRunning = true;

    return (async () => {
      try {
        await main(); // <-- your existing async main() that extracts -> sends -> executes
        return { ok: true };
      } catch (e) {
        console.error("[content] main() failed:", e);
        return { ok: false, error: String(e) };
      } finally {
        window.__decisionLoopRunning = false;
      }
    })();
  });
})();
