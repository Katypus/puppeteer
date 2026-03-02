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
      interests: {},
    };

    await apiFetch("/personas", {
      method: "POST",
      body: JSON.stringify(data),
    });

    alert("Persona created!");
  });

// Sends message to background to get the APIfetch function, which includes the user_id in the headers for authentication
async function apiFetch(url, options = {}) {
  const result = await browser.runtime.sendMessage({
    type: "API_FETCH",
    url,
    options,
  });
  if (!result.ok)
    throw new Error(`API ${result.status}: ${JSON.stringify(result.body)}`);
  return result.body;
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

  for (const p of personas) {
    const card = document.createElement("div");
    card.className = "card";

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

    list.appendChild(card);
  }
}

async function loadTab(route) {
  clearError();
  setStatus(`Loading ${route}…`);
  const data = await apiFetch(route, { method: "GET" });
  renderPersonas(data);
  setStatus(`${Array.isArray(data) ? data.length : 0} persona(s)`);
}

function wireTabs() {
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
}

document.addEventListener("DOMContentLoaded", wireTabs);
