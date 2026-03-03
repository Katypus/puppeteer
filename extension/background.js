// background.js
/*
listen for tab changes
send page summaries to python backend
receive LLM decisions
open new tabs or simulate activity
*/
// Generate or retrieve a unique user ID for this extension instance
async function getOrCreateUserId() {
  const result = await browser.storage.local.get("user_id");

  if (!result.user_id) {
    const newId = crypto.randomUUID();
    await browser.storage.local.set({ user_id: newId });
    return newId;
  }

  return result.user_id;
}
console.log("[background] loaded", new Date().toISOString());
// Optional: ensure it exists on install
browser.runtime.onInstalled.addListener(() => {
  getOrCreateUserId();
});

async function apiFetch(url, options = {}) {
  try {
    const { user_id } = await browser.storage.local.get("user_id");
    const uid = user_id || "dev-user"; // temporary fallback for debugging

    console.log(`[background apiFetch] url: ${url} (user_id: ${uid})`);

    const resp = await fetch(`http://localhost:8000${url}`, {
      ...options,
      headers: {
        ...(options.headers || {}),
        "Content-Type": "application/json",
        "X-User-Id": uid,
      },
    });

    const contentType = resp.headers.get("content-type") || "";
    const body = contentType.includes("application/json")
      ? await resp.json()
      : await resp.text();

    return { ok: resp.ok, status: resp.status, body };
  } catch (e) {
    console.error("[apiFetch] exception:", e);
    return { ok: false, status: 0, body: String(e) };
  }
}

// background.js
// API fetch handler and other background tasks
// background.js

browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg?.type) return;

  if (msg.type === "API_FETCH") {
    (async () => {
      try {
        const { path, options } = msg;

        const result = await apiFetch(path, options || {});
        console.log("[background] API_FETCH sending response:", result);

        sendResponse(result); // { ok, status, body }
      } catch (e) {
        console.error("[background] API_FETCH failed:", e);
        sendResponse({ ok: false, status: 0, body: String(e) });
      }
    })();

    return true; // ✅ keep the message channel open for async response
  }

  if (msg.type === "PAGE_SUMMARY") {
    (async () => {
      try {
        const decideRequest = { persona: DEFAULT_PERSONA, page: msg.payload };

        const res = await fetch(DECIDE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(decideRequest),
        });

        if (!res.ok) {
          const text = await res.text();
          sendResponse({ ok: false, error: `HTTP ${res.status}: ${text}` });
          return;
        }

        const decision = await res.json();
        sendResponse({ ok: true, decision });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();

    return true; // ✅ keep channel open
  }

  // ignore unknown messages
});

async function handleApiFetch(msg) {
  try {
    const { path, options } = msg;

    const result = await apiFetch(path, options || {}); // ✅ await!
    console.log("[background] API_FETCH returning:", result);

    return result; // ✅ returns { ok, status, body }
  } catch (e) {
    console.error("[background] API_FETCH failed:", e);
    return { ok: false, status: 0, body: String(e) };
  }
}
async function handlePageSummary(msg) {
  const decideRequest = {
    persona: DEFAULT_PERSONA,
    page: msg.payload,
  };

  try {
    const res = await fetch(DECIDE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(decideRequest),
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${text}` };
    }

    const decision = await res.json();
    return { ok: true, decision };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

browser.browserAction.onClicked.addListener(() => {
  browser.tabs.create({
    url: browser.runtime.getURL("persona.html"),
  });
});

const DECIDE_URL = "http://127.0.0.1:8000/decide";
const DEFAULT_PERSONA = {
  name: "Brad",
  interests: ["MAGA", "electric vehicles", "crypto", "guns"],
  description: "",
  is_public: false,
  age: 30,
  gender: "male",
  race: "white",
  politics: 9,
  risk: 8,
  attention: 1,
  patience: 1,
};

browser.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;

  try {
    const resp = await browser.tabs.sendMessage(tab.id, {
      type: "RUN_DECISION_LOOP",
    });
    console.log("[bg] content responded:", resp);
  } catch (e) {
    console.warn(
      "[bg] sendMessage failed (is content script injected on this page?):",
      e,
    );
  }
});
