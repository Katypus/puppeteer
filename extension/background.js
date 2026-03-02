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

// Optional: ensure it exists on install
browser.runtime.onInstalled.addListener(() => {
  getOrCreateUserId();
});

async function apiFetch(url, options = {}) {
  const { user_id } = await browser.storage.local.get("user_id");

  const resp = await fetch(`http://localhost:8000${url}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      "Content-Type": "application/json",
      "X-User-Id": user_id,
    },
  });

  const contentType = resp.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await resp.json()
    : await resp.text();

  return { ok: resp.ok, status: resp.status, body };
}

browser.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "API_FETCH") {
    return apiFetch(msg.url, msg.options);
  }
});
browser.browserAction.onClicked.addListener(() => {
  browser.tabs.create({
    url: browser.runtime.getURL("persona.html"),
  });
});

const BACKEND_URL = "http://127.0.0.1:8000/decide";

browser.runtime.onMessage.addListener(async (msg) => {
  if (msg?.type !== "PAGE_SUMMARY") return;

  try {
    const res = await fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ summary: msg.payload }),
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
});
