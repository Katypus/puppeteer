console.log("persona.js loaded");
document
  .getElementById("persona-form")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const data = {
      name: document.getElementById("name").value,
      description: document.getElementById("description").value,
      risk: parseInt(document.getElementById("risk").value),
      politics: parseInt(document.getElementById("politics").value),
      is_public: document.getElementById("is_public").checked,
      attention: parseInt(document.getElementById("attention").value),
      patience: parseInt(document.getElementById("patience").value),
      gender: document.getElementById("gender").value,
      age: parseInt(document.getElementById("age").value),
      race: document.getElementById("race").value,
      interests: document
        .getElementById("interests")
        .value.split(",")
        .map((s) => s.trim()),
    };

    await apiFetch("/personas", {
      method: "POST",
      body: JSON.stringify(data),
    });

    alert("Persona created!");
  });

// Sends message to background to get the APIfetch function, which includes the user_id in the headers for authentication
async function apiFetch(path, options = {}) {
  console.log(`[persona.js apiFetch] ${options.method || "GET"} ${path}`);
  const result = await browser.runtime.sendMessage({
    type: "API_FETCH",
    path,
    options,
  });
  console.log(`[persona.js apiFetch] resolved:`, result);
  if (result === undefined) {
    console.error(
      "[persona.js apiFetch] got undefined — background did not respond properly",
    );
  }
  if (!result.ok) {
    throw new Error(`API ${result.status}: ${JSON.stringify(result.body)}`);
  }
  return result;
}

function setStatus(text) {
  const el = document.getElementById("status");
  el.textContent = text || "";
}

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

async function setSelectedPersona(persona) {
  await browser.storage.local.set({ selectedPersona: persona });
}

async function updateCurrentPersona() {
  const selected = await getSelectedPersona();
  const el = document.getElementById("current-persona");
  el.textContent = selected
    ? `Current: ${selected.name}`
    : "Current: Default (Brad)";
}

function setActiveTab(activeButton) {
  document
    .querySelectorAll(".tab")
    .forEach((btn) => btn.classList.remove("active"));
  activeButton.classList.add("active");
}

function renderPersonas(personas) {
  const list = document.getElementById("persona-list");
  list.innerHTML = "";

  if (!Array.isArray(personas) || personas.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No personas found.";
    list.appendChild(empty);
    return;
  }

  // Get selected persona to highlight
  getSelectedPersona().then((selected) => {
    for (const p of personas) {
      const card = document.createElement("div");
      card.className = "card";

      if (selected && p.id === selected.id) {
        card.classList.add("selected");
      }

      const title = document.createElement("h3");
      title.textContent = p.name ?? "(unnamed persona)";
      card.appendChild(title);

      const desc = document.createElement("div");
      desc.textContent = p.description ?? "";
      card.appendChild(desc);

      const meta = document.createElement("div");
      meta.className = "meta";

      // Adjust these field names to match your API response
      const id = p.id ? `id=${p.id}` : "";
      const owner = p.owner_id
        ? `owner=${p.owner_id}`
        : p.ownerId
          ? `owner=${p.ownerId}`
          : "";
      const pub =
        p.is_public !== undefined
          ? `public=${p.is_public}`
          : p.public !== undefined
            ? `public=${p.public}`
            : "";

      meta.textContent = [id, owner, pub].filter(Boolean).join(" • ");
      card.appendChild(meta);

      const selectBtn = document.createElement("button");
      selectBtn.textContent = "Select as Active";
      selectBtn.addEventListener("click", async () => {
        await setSelectedPersona(p);
        alert(`Selected ${p.name} as active persona`);
        // Reload the list to update highlighting
        loadTab(document.querySelector(".tab.active").dataset.route);
        // Update current display
        updateCurrentPersona();
      });
      card.appendChild(selectBtn);

      list.appendChild(card);
    }
  });
}

async function loadTab(route) {
  clearError();
  setStatus(`Loading ${route}…`);
  console.log(`[loadTab] Fetching data for route: ${route}`);
  try {
    const result = await apiFetch(route, { method: "GET" }); // result = { ok, status, body }
    console.log(`[loadTab] API fetch result:`, result);
    if (!result) {
      throw new Error("apiFetch returned undefined");
    }
    if (!result.ok) {
      // show useful info
      const msg =
        typeof result.body === "string"
          ? result.body
          : JSON.stringify(result.body);
      showError(`HTTP ${result.status}: ${msg}`);
      setStatus("Error");
      return;
    }

    const data = result.body; // ✅ unwrap

    renderPersonas(data);
    setStatus(`${Array.isArray(data) ? data.length : 0} persona(s)`);
  } catch (e) {
    console.error("[loadTab] failed:", e);
    showError(String(e));
    setStatus("Error");
  }
}
function wireTabs() {
  // 🔒 One-time guard
  if (window.__tabsWired) {
    console.log("[wireTabs] already wired, skipping");
    return;
  }
  window.__tabsWired = true;

  console.log("[wireTabs] wiring listeners");
  const tabs = document.querySelectorAll(".tab");

  tabs.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const route = btn.dataset.route;
      setActiveTab(btn);
      try {
        await loadTab(route);
      } catch (err) {
        setStatus("");
        showError(err);
      }
    });
  });

  // Load default tab on first open (Accessible)
  const defaultTab =
    document.querySelector(".tab.active") ||
    document.getElementById("tab-accessible");
  loadTab(defaultTab.dataset.route).catch((err) => {
    setStatus("");
    showError(err);
  });

  // Update current persona display
  updateCurrentPersona();
}

document.addEventListener("DOMContentLoaded", wireTabs);

// Listen for RUN button from popup
// Sends request to background, which will forward RUN_DECISION_LOOP only to
// the tab where the user clicked "run" and will track running state per tab.
document.getElementById("runBtn").addEventListener("click", async () => {
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
  }
});

// Listen for STOP button from popup
// Sends request to background to disable the decision loop for this tab.
document.getElementById("stopBtn").addEventListener("click", async () => {
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
  }
});
