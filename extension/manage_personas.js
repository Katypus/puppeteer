console.log("persona.js loaded");
// Global variables for race randomization persistence
let lastRaceValue = null;
let lastRaceFile = null;

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

function setStatus(text, statusElId) {
  const el = document.getElementById(statusElId || "status");
  if (el) el.textContent = text || "";
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

function updateSpriteWindow() {
  const politicsValue = document.getElementById("politics").value;
  const riskValue = document.getElementById("risk").value;
  const ageValue = document.getElementById("age").value;
  const raceValue = document.getElementById("race").value;
  const genderValue = document.getElementById("gender").value;

  const politicsId = politicsSpriteIndex(politicsValue);
  const riskId = riskSpriteIndex(riskValue);
  const ageId = ageSpriteIndex(ageValue);

  // Only randomize race sprite when race value changes
  let raceFile;
  if (raceValue !== lastRaceValue) {
    raceFile = raceSpriteFile(raceValue);
    lastRaceValue = raceValue;
    lastRaceFile = raceFile;
  } else {
    raceFile = lastRaceFile || raceSpriteFile(raceValue); // fallback for initial load
  }

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

function wireSpriteInputs() {
  ["politics", "risk", "age", "race", "gender"].forEach((field) => {
    const input = document.getElementById(field);
    if (!input) return;
    const eventName =
      input.tagName.toLowerCase() === "select" ? "change" : "input";
    input.addEventListener(eventName, updateSpriteWindow);
  });
  // Initialize race value on load
  const initialRaceValue = document.getElementById("race").value;
  if (initialRaceValue) {
    lastRaceValue = initialRaceValue;
    lastRaceFile = raceSpriteFile(initialRaceValue);
  }
  updateSpriteWindow();
}

function setActivePage(pageName) {
  // Hide all pages
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.remove("active");
  });
  // Deactivate all nav buttons
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.remove("active");
  });
  // Show selected page
  const page = document.getElementById(`page-${pageName}`);
  if (page) {
    page.classList.add("active");
  }
  // Activate selected nav button
  const btn = document.querySelector(`[data-page="${pageName}"]`);
  if (btn) {
    btn.classList.add("active");
  }
  // Load personas if switching to public or mine
  if (pageName === "public") {
    loadPersonas("/personas/public", "public");
  } else if (pageName === "mine") {
    loadPersonas("/personas/mine", "mine");
  }
}

function createSpriteWindowHTML(persona, uniqueId) {
  const politicsId = politicsSpriteIndex(persona.politics ?? 5);
  const riskId = riskSpriteIndex(persona.risk ?? 5);
  const ageId = ageSpriteIndex(persona.age ?? 30);
  const raceFile = raceSpriteFile(persona.race ?? "white");
  const genderFile = genderSpriteFile(persona.gender ?? "male");

  return `
    <div class="sprite-layer">
      <img class="sprite-img" src="sprite/politics/${politicsId}.png" alt="politics" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" />
    </div>
    <div class="sprite-layer">
      <img class="sprite-img" src="sprite/race/${raceFile}" alt="race" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" />
    </div>
    <div class="sprite-layer">
      <img class="sprite-img" src="sprite/risk/${riskId}.png" alt="risk" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" />
    </div>
    <div class="sprite-layer">
      <img class="sprite-img" src="sprite/age/${ageId}.png" alt="age" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" />
    </div>
    <div class="sprite-layer">
      <img class="sprite-img" src="sprite/gender/${genderFile}" alt="gender" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" />
    </div>
  `;
}

function renderPersonas(personas, listContainerId) {
  const list = document.getElementById(listContainerId);
  if (!list) return;
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
      card.className = "persona-card";

      if (selected && p.id === selected.id) {
        card.classList.add("selected");
      }

      // Create sprite container
      const spriteContainer = document.createElement("div");
      spriteContainer.className = "sprite-container";
      spriteContainer.innerHTML = createSpriteWindowHTML(p, p.id);
      card.appendChild(spriteContainer);

      // Add title
      const title = document.createElement("h3");
      title.textContent = p.name ?? "(unnamed persona)";
      card.appendChild(title);

      // Add description as subtitle
      const desc = document.createElement("p");
      desc.textContent = p.description ?? "";
      card.appendChild(desc);

      // Add select button
      const selectBtn = document.createElement("button");
      selectBtn.className = "select-btn";
      selectBtn.textContent = "Select";
      selectBtn.addEventListener("click", async () => {
        await setSelectedPersona(p);
        // Reload the list to update highlighting
        const activePageId = document.querySelector(".page.active")?.id || "";
        if (activePageId === "page-public") {
          await loadPersonas("/personas/public", "public");
        } else if (activePageId === "page-mine") {
          await loadPersonas("/personas/mine", "mine");
        }
        // Update current display
        updateCurrentPersona();
      });
      card.appendChild(selectBtn);

      list.appendChild(card);
    }
  });
}

async function loadPersonas(route, pageType) {
  const statusElId = `status-${pageType}`;
  const listElId = `persona-list-${pageType}`;
  const statusEl = document.getElementById(statusElId);

  clearError();
  if (statusEl) setStatus(`Loading ${route}…`, statusElId);
  console.log(`[loadPersonas] Fetching data for route: ${route}`);
  try {
    const result = await apiFetch(route, { method: "GET" });
    console.log(`[loadPersonas] API fetch result:`, result);
    if (!result) {
      throw new Error("apiFetch returned undefined");
    }
    if (!result.ok) {
      const msg =
        typeof result.body === "string"
          ? result.body
          : JSON.stringify(result.body);
      showError(`HTTP ${result.status}: ${msg}`);
      if (statusEl) setStatus("Error", statusElId);
      return;
    }

    const data = result.body;
    renderPersonas(data, listElId);
    if (statusEl)
      setStatus(
        `${Array.isArray(data) ? data.length : 0} persona(s)`,
        statusElId,
      );
  } catch (e) {
    console.error("[loadPersonas] failed:", e);
    showError(String(e));
    if (statusEl) setStatus("Error", statusElId);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // Wire up navigation buttons
  const navBtns = document.querySelectorAll(".nav-btn");
  navBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const pageName = btn.dataset.page;
      setActivePage(pageName);
    });
  });

  wireSpriteInputs();
  setActivePage("public");
});
