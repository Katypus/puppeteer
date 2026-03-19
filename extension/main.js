console.log("[main] loaded");

// ---------- main flow ----------
let agentRunning = false;

async function main() {
  if (agentRunning) {
    console.log("[agent] main already running; skipping");
    return;
  }

  agentRunning = true;

  try {
    await window.PuppeteerHelpers.waitForRealLinks();

    console.log("[sensor] extracting page summary...");
    const payload = window.PuppeteerSensor.extractSummary();
    payload.history = await window.PuppeteerSensor.getHistoryFromBackground();

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
    const resp = await window.PuppeteerSensor.sendSummaryToBackground(payload);
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
    await window.PuppeteerSensor.rememberInBackground(resp.decision);
    await window.PuppeteerExecutor.executeDecision(resp.decision);
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

window.PuppeteerMain = {
  main,
};
