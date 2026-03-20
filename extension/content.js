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

  // content.js — drop-in “robust decision executor”
  //
  // Assumes you already have a findElement(target) that can resolve a string target.
  // This adds:
  // - strict-ish validation + normalization (including repairing common LLM mistakes)
  // - skills: search, open_result, read
  // - primitives: click, type, scroll, navigate, back, wait, noop
  //
  // IMPORTANT: This executor is async. Ideally call it as: await executeDecision(decision)
  //
  // You can keep your existing findElement() as-is; this code wraps around it.

  /* ----------------------------- small utilities ---------------------------- */

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function jitter(min, max) {
    return Math.floor(min + Math.random() * (max - min));
  }

  function isNonEmptyString(x) {
    return typeof x === "string" && x.trim().length > 0;
  }

  function looksLikeUrl(x) {
    return isNonEmptyString(x) && /^https?:\/\//i.test(x.trim());
  }

  function safeUrl(url) {
    try {
      const u = new URL(url, window.location.href);
      // block dangerous schemes
      if (!["http:", "https:"].includes(u.protocol)) return null;
      return u.toString();
    } catch {
      return null;
    }
  }

  function isGoogleSearchUrl(url) {
    try {
      const u = new URL(url);
      const isGoogle =
        u.hostname === "www.google.com" ||
        u.hostname.endsWith(".google.com") ||
        u.hostname === "google.com";
      return isGoogle && u.pathname === "/search" && u.searchParams.has("q");
    } catch {
      return false;
    }
  }

  function decodeGoogleQuery(url) {
    try {
      const u = new URL(url);
      return (u.searchParams.get("q") || "").trim();
    } catch {
      return "";
    }
  }

  // Extract JSON object/array out of a model string that might include extra text.
  // Returns parsed object or null.
  function extractAndParseJson(raw) {
    if (raw == null) return null;
    if (typeof raw === "object") return raw; // already parsed
    if (typeof raw !== "string") return null;

    const s = raw.trim();
    if (!s) return null;

    // Fast path: strict parse
    try {
      return JSON.parse(s);
    } catch {
      // continue
    }

    // Try to extract first {...} or [...] block.
    const firstObj = s.indexOf("{");
    const lastObj = s.lastIndexOf("}");
    const firstArr = s.indexOf("[");
    const lastArr = s.lastIndexOf("]");

    let candidate = null;

    if (firstObj !== -1 && lastObj !== -1 && lastObj > firstObj) {
      candidate = s.slice(firstObj, lastObj + 1);
    } else if (firstArr !== -1 && lastArr !== -1 && lastArr > firstArr) {
      candidate = s.slice(firstArr, lastArr + 1);
    }

    if (!candidate) return null;

    // One more parse attempt on extracted substring
    try {
      return JSON.parse(candidate);
    } catch {
      return null;
    }
  }

  /* ----------------------------- target handling ---------------------------- */

  // Allow target to be either:
  // - string (legacy): passed to your findElement(string)
  // - object locator: { css, text, href, role, name } (we’ll resolve a few common forms)
  function resolveTarget(target) {
    if (isNonEmptyString(target)) {
      // legacy path: your existing resolver
      return findElement(target);
    }

    if (!target || typeof target !== "object") return null;

    // CSS locator
    if (isNonEmptyString(target.css)) {
      try {
        const el = document.querySelector(target.css.trim());
        if (el) return el;
      } catch {
        // invalid selector
      }
    }

    // href locator (exact or contains)
    if (isNonEmptyString(target.href)) {
      const href = target.href.trim();
      // exact match first
      let el = document.querySelector(`a[href="${CSS.escape(href)}"]`);
      if (el) return el;

      // contains match fallback
      const anchors = Array.from(document.querySelectorAll("a[href]"));
      el = anchors.find((a) => a.getAttribute("href")?.includes(href));
      if (el) return el;
    }

    // text locator (visible elements only; conservative)
    if (isNonEmptyString(target.text)) {
      const needle = target.text.trim().toLowerCase();
      const candidates = Array.from(
        document.querySelectorAll("a,button,[role='button'],[role='link']"),
      )
        .filter(isElementClickable)
        .filter((el) => {
          const t = (el.innerText || el.textContent || "").trim().toLowerCase();
          return t && (t === needle || t.includes(needle));
        });

      return pickBestVisible(candidates);
    }

    // role+name locator (basic)
    if (isNonEmptyString(target.role) && isNonEmptyString(target.name)) {
      const role = target.role.trim().toLowerCase();
      const name = target.name.trim().toLowerCase();
      const sel =
        role === "button"
          ? "button,[role='button']"
          : role === "link"
            ? "a,[role='link']"
            : null;

      if (sel) {
        const candidates = Array.from(document.querySelectorAll(sel))
          .filter(isElementClickable)
          .filter((el) => {
            const t = (el.innerText || el.textContent || "")
              .trim()
              .toLowerCase();
            const aria = (el.getAttribute("aria-label") || "")
              .trim()
              .toLowerCase();
            return (
              (t && (t === name || t.includes(name))) ||
              (aria && (aria === name || aria.includes(name)))
            );
          });

        return pickBestVisible(candidates);
      }
    }

    return null;
  }

  function isElementVisible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    // must intersect viewport a bit
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const intersects =
      rect.bottom >= 0 && rect.right >= 0 && rect.top <= vh && rect.left <= vw;
    if (!intersects) return false;

    const style = window.getComputedStyle(el);
    if (
      style.visibility === "hidden" ||
      style.display === "none" ||
      Number(style.opacity) === 0
    )
      return false;
    return true;
  }

  function isElementClickable(el) {
    if (!el) return false;
    if (!isElementVisible(el)) return false;
    // avoid disabled buttons
    if ("disabled" in el && el.disabled) return false;
    return true;
  }

  function pickBestVisible(elements) {
    const els = (elements || []).filter(isElementClickable);
    if (!els.length) return null;

    // pick the most “central” visible element (simple heuristic)
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;

    let best = els[0];
    let bestScore = Infinity;

    for (const el of els) {
      const r = el.getBoundingClientRect();
      const ex = r.left + r.width / 2;
      const ey = r.top + r.height / 2;
      const dist = Math.hypot(ex - cx, ey - cy);
      if (dist < bestScore) {
        bestScore = dist;
        best = el;
      }
    }
    return best;
  }

  /* ------------------------- skills: search / read -------------------------- */

  async function executeSearch(query, opts = {}) {
    const q = String(query || "").trim();
    if (!q) return;

    const engine = (opts.engine || "google").toLowerCase();

    // If we’re on Google home, use the search box; else just navigate to results.
    const onGoogleHome =
      location.hostname.endsWith("google.com") &&
      (location.pathname === "/" || location.pathname === "/webhp");

    if (engine === "google" && onGoogleHome) {
      const input =
        document.querySelector('textarea[name="q"]') ||
        document.querySelector('input[name="q"]') ||
        document.querySelector('input[type="text"][name="q"]');

      if (input) {
        input.focus();
        input.value = q;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));

        // After input.value = q; and input/change events...
        const ok = submitSearch(input);
        if (!ok) {
          // last resort: navigate directly to results
          location.href = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
        }
        return;
      }
    }

    // Submit reliably: try Enter (keydown/keypress/keyup), then form.submit(), then click search button
    function submitSearch(input) {
      const fireKey = (type) =>
        input.dispatchEvent(
          new KeyboardEvent(type, {
            key: "Enter",
            code: "Enter",
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true,
          }),
        );

      // 1) Try the full key sequence (some listeners are on keypress)
      fireKey("keydown");
      fireKey("keypress");
      fireKey("keyup");

      // 2) Try submitting the surrounding form
      const form = input.closest("form");
      if (form) {
        // requestSubmit is best if available (triggers submit handlers)
        if (typeof form.requestSubmit === "function") {
          form.requestSubmit();
          return true;
        }
        // fallback: dispatch submit event then submit()
        const ev = new Event("submit", { bubbles: true, cancelable: true });
        if (form.dispatchEvent(ev)) {
          try {
            form.submit();
            return true;
          } catch {}
        }
      }

      // 3) Try clicking Google’s search button
      const btn =
        document.querySelector('button[type="submit"]') ||
        document.querySelector('input[type="submit"]') ||
        document.querySelector('button[aria-label="Google Search"]') ||
        document.querySelector('input[aria-label="Google Search"]');

      if (btn) {
        btn.click();
        return true;
      }

      return false;
    }

    // Fallback: navigate
    const url =
      engine === "duckduckgo"
        ? `https://duckduckgo.com/?q=${encodeURIComponent(q)}`
        : `https://www.google.com/search?q=${encodeURIComponent(q)}`;

    window.location.href = url;
  }

  async function executeRead(params = {}) {
    // params: { seconds?: number, mode?: "scan"|"deep" }
    const seconds = Number(params.seconds);
    const mode = (params.mode || "scan").toLowerCase();

    const totalMs = Number.isFinite(seconds)
      ? Math.max(1, Math.min(60, seconds)) * 1000
      : mode === "deep"
        ? 12000
        : 6000;

    const start = Date.now();

    // simple human-ish pattern: pause, small scrolls, pause, occasional tiny scroll up
    await sleep(jitter(400, 900));

    while (Date.now() - start < totalMs) {
      const down = mode === "deep" ? jitter(200, 520) : jitter(300, 750);
      window.scrollBy({ top: down, behavior: "smooth" });
      await sleep(jitter(800, 1500));

      if (mode === "deep" && Math.random() < 0.25) {
        const up = jitter(80, 220);
        window.scrollBy({ top: -up, behavior: "smooth" });
        await sleep(jitter(500, 900));
      }
    }
  }

  /* ---------------------- skill: open_result (SERP) ------------------------- */

  function isLikelySerpPage() {
    const host = location.hostname;
    if (host.includes("google.") && location.pathname === "/search")
      return true;
    if (host.includes("duckduckgo.") && location.pathname === "/") {
      // DDG results often still at /
      return new URLSearchParams(location.search).has("q");
    }
    return false;
  }

  function getSerpResultLinks() {
    const host = location.hostname;

    // Google: anchors inside main results region (#search) are usually organic.
    if (host.includes("google.") && location.pathname === "/search") {
      const region = document.querySelector("#search") || document.body;
      const anchors = Array.from(region.querySelectorAll("a[href]"));

      return anchors
        .filter((a) => isElementClickable(a))
        .map((a) => ({ a, href: a.getAttribute("href") || "" }))
        .filter(({ href }) => href && !href.startsWith("#"))
        .filter(({ href }) => {
          // avoid google internal nav / caches / accounts / settings / etc.
          if (href.startsWith("/")) return false;
          if (href.includes("google.com/")) return false;
          return true;
        })
        .filter(({ a }) => {
          const t = (a.innerText || "").trim();
          return t.length >= 8; // avoid tiny junk
        })
        .map(({ a }) => a);
    }

    // DuckDuckGo: results links tend to be a.result__a
    if (host.includes("duckduckgo.")) {
      const anchors = Array.from(
        document.querySelectorAll("a.result__a[href]"),
      );
      return anchors.filter(isElementClickable);
    }

    // Generic fallback: pick visible links in main-ish content
    const main = document.querySelector("main") || document.body;
    return Array.from(main.querySelectorAll("a[href]")).filter(
      isElementClickable,
    );
  }

  async function executeOpenResult(params = {}) {
    // params: { rank?: number, openInNewTab?: boolean, mustInclude?: string[] }
    console.log("[executor] open_result with params:", params);

    const rank = Number(params.rank);
    const openInNewTab = !!params.openInNewTab;
    const mustInclude = Array.isArray(params.mustInclude)
      ? params.mustInclude.map((s) => String(s).toLowerCase()).filter(Boolean)
      : [];

    if (!isLikelySerpPage()) {
      console.warn(
        "[executor] open_result: not on a recognized results/list page",
      );
      return;
    }

    let links = getSerpResultLinks();

    if (mustInclude.length) {
      links = links.filter((a) => {
        const txt = (
          (a.innerText || a.textContent || "") +
          " " +
          (a.href || "")
        ).toLowerCase();
        return mustInclude.every((w) => txt.includes(w));
      });
    }

    links = links.filter((a) => !!safeUrl(a.href));

    // Deduplicate by normalized href
    const seen = new Set();
    const deduped = [];
    for (const a of links) {
      const href = safeUrl(a.href);
      if (!href) continue;
      if (seen.has(href)) continue;
      seen.add(href);
      deduped.push(a);
    }
    links = deduped;

    if (!links.length) {
      console.warn("[executor] open_result: no suitable links found");
      return;
    }

    const idx = Number.isFinite(rank)
      ? Math.max(1, Math.min(links.length, rank)) - 1
      : 0;

    const chosen = links[idx];
    const href = safeUrl(chosen.href);

    console.log("[executor] open_result: chosen", {
      idx,
      href,
      text: (chosen.innerText || chosen.textContent || "").trim(),
    });

    chosen.scrollIntoView({ block: "center", behavior: "smooth" });
    await sleep(jitter(250, 600));

    // ----- helpers -----
    const fireMouseSequence = (el) => {
      const opts = { bubbles: true, cancelable: true, view: window };
      // Some SERPs listen on pointer/mouse down rather than click.
      el.dispatchEvent(new PointerEvent("pointerdown", opts));
      el.dispatchEvent(new MouseEvent("mousedown", opts));
      el.dispatchEvent(new MouseEvent("mouseup", opts));
      el.dispatchEvent(new MouseEvent("click", opts));
    };

    const tryClick = async (el) => {
      try {
        // Try normal click first (simple)
        el.click();
        await sleep(jitter(60, 140));
        return true;
      } catch (e) {
        console.warn("[executor] open_result: el.click() threw", e);
        return false;
      }
    };

    const tryMouseSequence = async (el) => {
      try {
        fireMouseSequence(el);
        await sleep(jitter(60, 140));
        return true;
      } catch (e) {
        console.warn("[executor] open_result: mouse sequence threw", e);
        return false;
      }
    };

    const openViaBackgroundIfPossible = async (url) => {
      // If you're in a Firefox extension content script, this is the most reliable way
      // to open a new tab without popup blocking.
      try {
        if (typeof browser !== "undefined" && browser?.runtime?.sendMessage) {
          await browser.runtime.sendMessage({
            type: "OPEN_TAB",
            url,
            active: true,
          });
          return true;
        }
      } catch (e) {
        // ignore; fallback below
        console.warn("[executor] open_result: background OPEN_TAB failed", e);
      }
      return false;
    };

    // ----- action -----
    if (openInNewTab) {
      if (!href) {
        console.warn(
          "[executor] open_result: no href to open in new tab, clicking instead",
        );
        await tryMouseSequence(chosen);
        await tryClick(chosen);
        return;
      }

      // Best: ask background to open tab (avoids popup blocking)
      const opened = await openViaBackgroundIfPossible(href);
      if (opened) {
        console.log("[executor] open_result: opened via background OPEN_TAB");
        return;
      }

      // Next: window.open (may be blocked)
      const w = window.open(href, "_blank", "noopener,noreferrer");
      if (w) {
        console.log("[executor] open_result: opened via window.open");
        return;
      }

      // Last resort: navigate same tab
      console.warn(
        "[executor] open_result: window.open blocked; navigating same tab",
      );
      window.location.assign(href);
      return;
    }

    // Same tab: clicking is unreliable on SERPs; navigate directly when possible.
    if (href) {
      console.log("[executor] open_result: navigating via location.assign");
      window.location.assign(href);
      return;
    }

    // If no href (edge case), attempt click strategies
    await tryMouseSequence(chosen);
    await tryClick(chosen);
  }

  /* --------------------- decision validation + normalization ---------------- */

  const ALLOWED_ACTIONS = new Set([
    "click",
    "type",
    "scroll",
    "navigate",
    "search",
    "open_result",
    "read",
    "back",
    "wait",
    "noop",
  ]);

  function normalizeDecision(rawDecision) {
    const parsed = extractAndParseJson(rawDecision);
    if (!parsed || typeof parsed !== "object") return null;

    // Support array-of-decisions: take first valid
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        const n = normalizeDecision(item);
        if (n) return n;
      }
      return null;
    }

    const d = { ...parsed };

    // Normalize action casing / aliases
    if (typeof d.action === "string") d.action = d.action.trim().toLowerCase();
    if (d.action === "none") d.action = "noop";
    if (d.action === "no-op") d.action = "noop";

    // Some models use target/value inconsistently; try mild repair
    // navigate: accept url in target or url
    if (d.action === "navigate") {
      if (!isNonEmptyString(d.value)) {
        if (isNonEmptyString(d.url)) d.value = d.url;
        else if (isNonEmptyString(d.target)) d.value = d.target;
      }
    }

    // click: if target is a URL, interpret as navigate/search intent
    if (d.action === "click" && looksLikeUrl(d.target)) {
      const url = d.target.trim();
      if (isGoogleSearchUrl(url)) {
        const q = decodeGoogleQuery(url);
        if (q) return { action: "search", value: q, engine: "google" };
      }
      return { action: "navigate", value: url };
    }

    // search: allow query in value/target/query
    if (d.action === "search") {
      if (!isNonEmptyString(d.value)) {
        if (isNonEmptyString(d.query)) d.value = d.query;
        else if (isNonEmptyString(d.target)) d.value = d.target;
      }
      if (!isNonEmptyString(d.engine)) d.engine = "google";
    }

    // read: allow seconds in value
    if (d.action === "read") {
      if (d.seconds == null && d.value != null) d.seconds = d.value;
      if (!isNonEmptyString(d.mode)) d.mode = "scan";
    }

    // open_result: allow rank in value
    if (d.action === "open_result") {
      if (d.rank == null && d.value != null) d.rank = d.value;
    }

    // scroll: normalize numbers to strings
    if (d.action === "scroll") {
      if (typeof d.value === "number") d.value = String(d.value);
      if (isNonEmptyString(d.value)) d.value = d.value.trim().toLowerCase();
    }

    // wait: normalize ms
    if (d.action === "wait") {
      if (typeof d.value === "string") d.value = d.value.trim();
      if (typeof d.value === "number") d.value = Math.floor(d.value);
    }

    return d;
  }

  function validateDecision(d) {
    const errors = [];

    if (!d || typeof d !== "object") {
      errors.push("decision_not_object");
      return { ok: false, errors };
    }

    if (!isNonEmptyString(d.action)) {
      errors.push("missing_action");
      return { ok: false, errors };
    }

    if (!ALLOWED_ACTIONS.has(d.action)) {
      errors.push(`unknown_action:${d.action}`);
      return { ok: false, errors };
    }

    switch (d.action) {
      case "click":
        if (d.target == null) errors.push("click_missing_target");
        break;

      case "type":
        if (d.target == null) errors.push("type_missing_target");
        if (!isNonEmptyString(d.value)) errors.push("type_missing_value");
        break;

      case "scroll": {
        const v = d.value;
        if (!isNonEmptyString(v)) errors.push("scroll_missing_value");
        else if (v !== "up" && v !== "down" && Number.isNaN(Number(v)))
          errors.push("scroll_bad_value");
        break;
      }

      case "navigate": {
        const url = safeUrl(d.value);
        if (!url) errors.push("navigate_bad_url");
        else d.value = url; // canonicalize
        break;
      }

      case "search":
        if (!isNonEmptyString(d.value)) errors.push("search_missing_query");
        break;

      case "open_result":
        // rank optional; defaults to 1
        if (d.rank != null && Number.isNaN(Number(d.rank)))
          errors.push("open_result_bad_rank");
        break;

      case "read":
        if (d.seconds != null && Number.isNaN(Number(d.seconds)))
          errors.push("read_bad_seconds");
        break;

      case "wait":
        // optional; if missing we’ll jitter
        if (d.value != null) {
          const ms = typeof d.value === "number" ? d.value : Number(d.value);
          if (!Number.isFinite(ms)) errors.push("wait_bad_ms");
        }
        break;

      case "back":
      case "noop":
        break;

      default:
        break;
    }

    return { ok: errors.length === 0, errors };
  }

  /* ----------------------------- core executor ------------------------------ */

  async function executeDecision(rawDecision) {
    console.log("[executor] raw decision:", rawDecision);
    const d = normalizeDecision(rawDecision);
    if (!d) return;

    const { ok, errors } = validateDecision(d);
    if (!ok) {
      console.warn("[executor] invalid decision:", d, "errors:", errors);
      return;
    }

    switch (d.action) {
      /* -------- skills -------- */

      case "search": {
        // Basic “sanity” guard: avoid empty / absurdly long queries
        const q = String(d.value).trim();
        if (q.length > 180) {
          console.warn("[executor] search query too long; refusing:", q);
          return;
        }
        await executeSearch(q, { engine: d.engine });
        return;
      }

      case "open_result": {
        console.log("[executor] executing open_result with params:", d);
        await executeOpenResult({
          rank: d.rank != null ? Number(d.rank) : 1,
          openInNewTab: !!d.openInNewTab,
          mustInclude: d.mustInclude,
        });
        return;
      }

      case "read": {
        await executeRead({ seconds: d.seconds, mode: d.mode });
        return;
      }

      /* -------- primitives -------- */

      case "click": {
        // Preflight: resolve element (supports string or locator object)
        const el = resolveTarget(d.target);
        if (!el) {
          // One more repair attempt: if target is url-like string and anchor exists, click it
          if (looksLikeUrl(d.target)) {
            const href = safeUrl(d.target);
            if (href) {
              const a = document.querySelector(`a[href="${CSS.escape(href)}"]`);
              if (a) {
                a.scrollIntoView({ block: "center", behavior: "smooth" });
                await sleep(jitter(150, 450));
                a.click();
                return;
              }
            }
          }

          return console.warn("[executor] click target not found:", d.target);
        }

        el.scrollIntoView({ block: "center", behavior: "smooth" });
        await sleep(jitter(150, 450));
        el.click();
        return;
      }

      case "type": {
        const el = resolveTarget(d.target);
        if (!el)
          return console.warn("[executor] type target not found:", d.target);

        const value = String(d.value);

        el.scrollIntoView?.({ block: "center", behavior: "smooth" });
        await sleep(jitter(120, 350));

        el.focus?.();

        if ("value" in el) {
          el.value = value;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        } else if (el.isContentEditable) {
          el.textContent = value;
          el.dispatchEvent(new Event("input", { bubbles: true }));
        }

        // Optional: press Enter if requested (common for search boxes)
        if (d.pressEnter) {
          el.dispatchEvent(
            new KeyboardEvent("keydown", {
              key: "Enter",
              code: "Enter",
              bubbles: true,
            }),
          );
          el.dispatchEvent(
            new KeyboardEvent("keyup", {
              key: "Enter",
              code: "Enter",
              bubbles: true,
            }),
          );
        }

        return;
      }

      case "scroll": {
        const v = String(d.value).trim().toLowerCase();
        if (v === "down") {
          window.scrollBy({
            top: window.innerHeight * 0.9,
            behavior: "smooth",
          });
        } else if (v === "up") {
          window.scrollBy({
            top: -window.innerHeight * 0.9,
            behavior: "smooth",
          });
        } else {
          const px = Number(v);
          if (!Number.isNaN(px)) {
            const clamped = Math.max(-5000, Math.min(5000, px));
            window.scrollBy({ top: clamped, behavior: "smooth" });
          }
        }
        return;
      }

      case "navigate": {
        const url = safeUrl(d.value);
        if (!url) return console.warn("[executor] navigate bad url:", d.value);
        window.location.href = url;
        return;
      }

      case "back": {
        console.log("[executor] navigating back");
        window.history.back();
        return;
      }

      case "wait": {
        let ms = null;
        if (typeof d.value === "number") ms = d.value;
        else if (typeof d.value === "string") ms = Number(d.value);

        const delay = Number.isFinite(ms)
          ? Math.max(50, Math.min(15000, ms))
          : jitter(350, 1200);

        await sleep(delay);
        return;
      }

      case "noop":
      default:
        return;
    }
  }

  /* ----------------------------- usage notes ----------------------------- */
  // 1) If your caller is not async, you can still call executeDecision(decision);
  //    it will run async internally, but you won't be able to await it.
  // 2) To get maximum reliability, make the call site await it.
  // 3) Your LLM can now safely output URL-shaped “clicks” and they’ll be repaired.

  // gives summary, gets back llama response
  async function sendSummaryToBackground(payload) {
    // If you ever run in a non-extension environment, avoid crashing:
    if (typeof browser === "undefined" || !browser.runtime?.sendMessage) {
      console.warn("[sensor] browser.runtime.sendMessage not available");
      return null;
    }

    try {
      console.log("[sensor] sending page summary to background:", payload);
      response = await browser.runtime.sendMessage({
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
      // number of links here
      if (topLinks.length >= 5) break;
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

  // ---------- main flow ----------
  let agentRunning = false;

  async function main() {
    if (agentRunning) {
      console.log("[agent] main already running; skipping");
      return;
    }

    agentRunning = true;

    try {
      await waitForRealLinks();

      console.log("[sensor] extracting page summary...");
      const payload = extractSummary();
      payload.history = await getHistoryFromBackground();

      console.log("[sensor] page summary extracted:", payload);
      console.table(
        (payload.links || []).map((s, i) => ({
          rank: i + 1,
          link: s,
        })),
      );

      console.log("[sensor] history:", payload.history);
      console.log("[sensor] sending summary to background for decision...");

      // 1) send to backend via background
      const resp = await sendSummaryToBackground(payload);
      console.log("[sensor] backend response:", resp);

      // Background returns: { ok: true, decision: {...} } or { ok: false, error: "..." }
      if (!resp) {
        console.warn("[sensor] no response from background");
        return;
      }

      if (!resp.ok) {
        console.warn("[sensor] backend error:", resp.error);
        return;
      }

      // 2) execute decision
      console.log("[executor] decision:", resp.decision);
      await rememberInBackground(resp.decision);
      await executeDecision(resp.decision);
    } catch (e) {
      console.error("[agent] main failed:", e);
    } finally {
      agentRunning = false;
    }
  }

  // listening for run_decision_loop from background
  browser.runtime.onMessage.addListener((msg) => {
    if (msg?.type !== "RUN_DECISION_LOOP") return;

    // prevent duplicate runs on the same page
    if (window.__decisionLoopRunning) {
      console.log("[content] decision loop already running");
      return Promise.resolve({ ok: false, error: "Already running" });
    }

    window.__decisionLoopRunning = true;

    (async () => {
      try {
        while (true) {
          const enabledResp = await browser.runtime.sendMessage({
            type: "IS_DECISION_LOOP_ENABLED",
          });
          if (!enabledResp.ok || !enabledResp.enabled) {
            console.log("[content] decision loop disabled, stopping");
            break;
          }

          console.log("[content] running decision step");
          await main();
        }
      } catch (e) {
        console.error("[content] decision loop failed:", e);
      } finally {
        window.__decisionLoopRunning = false;
      }
    })();

    return { ok: true };
  });
})();
