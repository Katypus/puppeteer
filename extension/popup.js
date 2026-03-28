console.log("popup.js loaded");

function showError(err) {
  const el = document.getElementById("error");
  el.style.display = "block";
  el.textContent = String(err?.stack || err?.message || err);
}

function clearError() {
  const el = document.getElementById("error");
  el.style.display = "none";
  el.textContent = "";
}

async function getSelectedPersona() {
  const result = await browser.storage.local.get("selectedPersona");
  return result.selectedPersona || null;
}

async function updateCurrentPersona() {
  const selected = await getSelectedPersona();
  const el = document.getElementById("current-persona");
  el.textContent = selected
    ? `Current: ${selected.name}`
    : "Current: Default (Brad)";
  updateSpriteForPersona(selected);
}

function politicsSpriteIndex(value) {
  const v = Number(value);
  if (v <= 2) return 1;
  if (v <= 4) return 2;
  if (v <= 6) return 3;
  if (v <= 8) return 4;
  return 5;
}

function riskSpriteIndex(value) {
  return politicsSpriteIndex(value); // same bucket logic
}

function ageSpriteIndex(value) {
  const v = Number(value);
  if (Number.isNaN(v) || v < 0) return 1;
  if (v <= 17) return 1;
  if (v <= 40) return 2;
  if (v <= 60) return 3;
  if (v <= 122) return 4;
  return 5;
}

function raceSpriteFile(value) {
  const v = String(value || "").toLowerCase();
  if (v === "white") return "white.png";
  if (v === "asian") return "asian.png";
  if (v === "black") {
    return Math.random() < 0.5 ? "black1.png" : "black2.png";
  }
  if (["hispanic", "middle-eastern", "native-american"].includes(v)) {
    return "hmena.png";
  }
  if (["mixed", "other"].includes(v)) {
    const options = [
      "white.png",
      "black1.png",
      "black2.png",
      "asian.png",
      "hmena.png",
    ];
    return options[Math.floor(Math.random() * options.length)];
  }
  // fallback
  return "white.png";
}

function genderSpriteFile(value) {
  const v = String(value || "").toLowerCase();
  if (v === "male") return "male.png";
  if (v === "female") return "female.png";
  if (v === "non-binary") return "non-binary.png";
  // other maps to non-binary
  return "non-binary.png";
}

function updateSpriteForPersona(persona) {
  if (!persona) {
    // hide sprites
    const layers = [
      "sprite-politics",
      "sprite-race",
      "sprite-risk",
      "sprite-age",
      "sprite-gender",
    ];
    layers.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.style.display = "none";
    });
    return;
  }

  const politicsValue = persona.politics;
  const riskValue = persona.risk;
  const ageValue = persona.age;
  const raceValue = persona.race;
  const genderValue = persona.gender;

  const politicsId = politicsSpriteIndex(politicsValue);
  const riskId = riskSpriteIndex(riskValue);
  const ageId = ageSpriteIndex(ageValue);
  const raceFile = raceSpriteFile(raceValue);
  const genderFile = genderSpriteFile(genderValue);

  const setLayerSrc = (id, path) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.src = path;
    el.onerror = () => {
      el.style.display = "none";
    };
    el.onload = () => {
      el.style.display = "block";
    };
  };

  setLayerSrc("sprite-politics", `sprite/politics/${politicsId}.png`);
  setLayerSrc("sprite-race", `sprite/race/${raceFile}`);
  setLayerSrc("sprite-risk", `sprite/risk/${riskId}.png`);
  setLayerSrc("sprite-age", `sprite/age/${ageId}.png`);
  setLayerSrc("sprite-gender", `sprite/gender/${genderFile}`);
}

document.addEventListener("DOMContentLoaded", () => {
  updateCurrentPersona();
});

// Listen for RUN button from popup
// Sends request to background, which will forward RUN_DECISION_LOOP only to
// the tab where the user clicked "run" and will track running state per tab.
document.getElementById("runBtn").addEventListener("click", async () => {
  clearError();
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  try {
    const resp = await browser.runtime.sendMessage({
      type: "RUN_DECISION_LOOP",
      tabId: tab.id,
    });
    console.log("Run triggered:", resp);
    window.close(); // optional: close the popup
  } catch (e) {
    console.error(
      "Could not trigger content script. Is it injected on this page?",
      e,
    );
    showError(e);
  }
});

// Listen for STOP button from popup
// Sends request to background to disable the decision loop for this tab.
document.getElementById("stopBtn").addEventListener("click", async () => {
  clearError();
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  try {
    const resp = await browser.runtime.sendMessage({
      type: "STOP_DECISION_LOOP",
      tabId: tab.id,
    });
    console.log("Stop triggered:", resp);
    window.close(); // optional: close the popup
  } catch (e) {
    console.error(
      "Could not send stop command. Is it injected on this page?",
      e,
    );
    showError(e);
  }
});

// Manage Personas button
document.getElementById("manageBtn").addEventListener("click", () => {
  const url = browser.runtime.getURL("manage_personas.html");
  browser.tabs.create({ url });
  window.close(); // close the popup
});
