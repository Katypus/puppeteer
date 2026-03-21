const DECIDE_URL = "http://127.0.0.1:8000/decide";
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

// Track enabled/running state per tab so we only send RUN_DECISION_LOOP
// to the tab where the user initiated the run.
const tabDecisionState = new Map();

function getTabState(tabId) {
  return tabDecisionState.get(tabId) || { enabled: false, running: false };
}

function setTabState(tabId, state) {
  const prev = getTabState(tabId);
  tabDecisionState.set(tabId, { ...prev, ...state });
}

function disableAllTabs() {
  for (const [tabId] of tabDecisionState.entries()) {
    tabDecisionState.set(tabId, { enabled: false, running: false });
  }
}

async function runDecisionLoopForTab(tabId) {
  const state = getTabState(tabId);
  if (!state.enabled) {
    return { ok: false, error: "Tab not enabled for decision loop" };
  }
  if (state.running) {
    return { ok: false, error: "Decision loop already running" };
  }

  setTabState(tabId, { running: true });
  try {
    const resp = await browser.tabs.sendMessage(tabId, {
      type: "RUN_DECISION_LOOP",
    });
    return resp;
  } catch (e) {
    return { ok: false, error: String(e) };
  } finally {
    setTabState(tabId, { running: false });
  }
}

// Optional: ensure it exists on install
browser.runtime.onInstalled.addListener(() => {
  getOrCreateUserId();
});

// Clean up tracking state when a tab closes.
browser.tabs.onRemoved.addListener((tabId) => {
  tabDecisionState.delete(tabId);
});

// Send RUN_DECISION_LOOP to content.js on every navigation if the tab is enabled
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    const state = getTabState(tabId);
    if (state.enabled) {
      try {
        await browser.tabs.sendMessage(tabId, { type: "RUN_DECISION_LOOP" });
        console.log("[background] sent RUN_DECISION_LOOP on navigation for tab", tabId);
      } catch (e) {
        console.error("[background] failed to send RUN_DECISION_LOOP on navigation:", e);
      }
    }
  }
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

browser.runtime.onMessage.addListener(async (msg, sender) => {
  if (!msg?.type) return;
  // memory requests
  if (msg.type === "GET_ACTION_HISTORY") {
    return getActionHistory()
      .then((history) => ({ ok: true, history }))
      .catch((e) => ({ ok: false, error: String(e) }));
  }

  if (msg.type === "REMEMBER_ACTION") {
    return rememberAction(msg.decision, msg.url)
      .then((history) => ({ ok: true, history }))
      .catch((e) => ({ ok: false, error: String(e) }));
  }

  if (msg.type === "CLEAR_ACTION_HISTORY") {
    return clearActionHistory()
      .then(() => ({ ok: true }))
      .catch((e) => ({ ok: false, error: String(e) }));
  }
  if (msg.type === "API_FETCH") {
    try {
      const { path, options } = msg;
      const result = await apiFetch(path, options || {});
      console.log("[background] API_FETCH response:", result);
      return result;
    } catch (e) {
      console.error("[background] API_FETCH failed:", e);
      return { ok: false, status: 0, body: String(e) };
    }
  }

  if (msg.type === "RUN_DECISION_LOOP") {
    // Enable only the tab where the user clicked "Run".
    const tabId = msg.tabId;
    if (!tabId) {
      return { ok: false, error: "Missing tabId" };
    }

    // Only one tab should be enabled at a time.
    disableAllTabs();
    setTabState(tabId, { enabled: true });

    const result = await runDecisionLoopForTab(tabId);
    console.log("[background] runDecisionLoop result:", result);
    return result;
  }

  if (msg.type === "STOP_DECISION_LOOP") {
    const tabId = msg.tabId;
    if (!tabId) {
      return { ok: false, error: "Missing tabId" };
    }

    // Disable the tab and clear any running flag so the tab can be enabled again later.
    setTabState(tabId, { enabled: false, running: false });
    console.log("[background] stopped decision loop for tab", tabId);
    return { ok: true };
  }

  if (msg.type === "IS_DECISION_LOOP_ENABLED") {
    const tabId = sender.tab?.id;
    if (!tabId) {
      return { ok: false, error: "No tab id from sender" };
    }
    const state = getTabState(tabId);
    return { ok: true, enabled: state.enabled };
  }

  if (msg.type === "PAGE_SUMMARY") {
    try {
      const page = {
        url: msg.payload.url,
        title: msg.payload.title,
        links: msg.payload.links,
      };

      // Load selected persona or default to Brad
      const { selectedPersona } =
        await browser.storage.local.get("selectedPersona");
      const persona = selectedPersona || {
        name: "Brad",
        interests: ["Truth Social", "Donald Trump", "Conspiracy Theories"],
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

      const decideRequest = {
        persona,
        page,
        history: msg.payload.history.map(
          (h) => `${h.action}: ${h.value ?? h.target ?? ""}`,
        ),
      };
      console.log(
        "[background] sending page summary to backend:",
        decideRequest,
      );

      const res = await fetch(DECIDE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(decideRequest),
      });

      console.log("[background] sent page summary to backend");

      if (!res.ok) {
        const text = await res.text();
        console.error("[background] backend error:", text);
        return { ok: false, error: `HTTP ${res.status}: ${text}` };
      }

      const raw = await res.json();
      console.log("[background] raw backend response:", raw);

      // Unwrap common Llama/Ollama envelope:
      // raw.response is usually a JSON string containing the decision.
      let decision = raw;

      if (raw && typeof raw === "object" && typeof raw.response === "string") {
        try {
          decision = JSON.parse(raw.response);
        } catch (e) {
          // If response has trailing junk, you can add extraction here.
          console.warn(
            "[background] could not parse raw.response; forwarding envelope",
            e,
          );
          decision = raw; // fallback
        }
      }

      console.log("[background] forwarding decision to content:", decision);

      decision = JSON.parse(JSON.stringify(decision));

      return { ok: true, decision };
    } catch (e) {
      console.error("[background] PAGE_SUMMARY failed:", e);
      return { ok: false, error: String(e) };
    }
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

// Pop up when clicked
browser.browserAction.onClicked.addListener(() => {
  browser.tabs.create({
    url: browser.runtime.getURL("persona.html"),
  });
});

// Run button in the popup should send a message to the background with the
// active tab id. Background will then track enabled/running state per tab and
// forward RUN_DECISION_LOOP only to the tab that initiated the request.

//TODO: add listener for button that chooses persona

// Helper functions for memory
async function getActionHistory() {
  const data = await browser.storage.local.get("actionHistory");
  return Array.isArray(data.actionHistory) ? data.actionHistory : [];
}

async function rememberAction(decision, pageUrl) {
  const history = await getActionHistory();

  history.push({
    action: decision?.action ?? null,
    target: decision?.target ?? null,
    value: decision?.value ?? null,
    rank: decision?.rank ?? null,
    url: pageUrl || null,
    at: Date.now(),
  });

  const trimmed = history.slice(-2);

  await browser.storage.local.set({
    actionHistory: trimmed,
  });

  console.log("[background] saved action history:", trimmed);
  return trimmed;
}

async function clearActionHistory() {
  await browser.storage.local.set({ actionHistory: [] });
}
