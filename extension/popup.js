const ext = typeof browser !== "undefined" ? browser : chrome;
const DEFAULT_SERVER_URL = "http://localhost:3000";

const noteInput = document.getElementById("noteInput");
const projectSelect = document.getElementById("projectSelect");
const charCount = document.getElementById("charCount");
const sendBtn = document.getElementById("sendBtn");
const statusLine = document.getElementById("statusLine");
const settingsBtn = document.getElementById("settingsBtn");
const settingsPanel = document.getElementById("settingsPanel");
const serverUrlInput = document.getElementById("serverUrlInput");
const passwordInput = document.getElementById("passwordInput");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");

let serverUrl = DEFAULT_SERVER_URL;
let appPassword = "";
let sending = false;

function storageGet(keys) {
  return new Promise((resolve) => {
    try {
      const maybePromise = ext.storage.local.get(keys, (res) => resolve(res || {}));
      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise.then((res) => resolve(res || {})).catch(() => resolve({}));
      }
    } catch {
      resolve({});
    }
  });
}

function storageSet(obj) {
  return new Promise((resolve) => {
    try {
      const maybePromise = ext.storage.local.set(obj, () => resolve());
      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise.then(() => resolve()).catch(() => resolve());
      }
    } catch {
      resolve();
    }
  });
}

function showStatus(msg, type) {
  statusLine.textContent = msg;
  statusLine.className = `status ${type}`;
}

function clearStatus() {
  statusLine.textContent = "";
  statusLine.className = "status hidden";
}

function normalizeUrl(raw) {
  return (raw || DEFAULT_SERVER_URL).trim().replace(/\/+$/, "");
}

function buildHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (appPassword) {
    headers["x-zeronote-password"] = appPassword;
  }
  return headers;
}

function populateProjects(projects, selectedId) {
  if (!Array.isArray(projects) || projects.length === 0) return;
  projectSelect.innerHTML = "";
  for (const p of projects) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    projectSelect.appendChild(opt);
  }
  if (selectedId && projects.some((p) => p.id === selectedId)) {
    projectSelect.value = selectedId;
  }
}

async function refreshProjects(selectedId) {
  try {
    const res = await fetch(`${serverUrl}/api/bootstrap`, {
      method: "GET",
      headers: buildHeaders(),
    });
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data.projects) && data.projects.length > 0) {
      populateProjects(data.projects, selectedId);
      await storageSet({ cachedProjects: data.projects });
    }
  } catch {
    // Keep cached projects silently if offline
  }
}

async function init() {
  const saved = await storageGet([
    "serverUrl",
    "appPassword",
    "lastProjectId",
    "cachedProjects",
  ]);
  serverUrl = normalizeUrl(saved.serverUrl);
  appPassword = saved.appPassword || "";
  serverUrlInput.value = serverUrl;
  passwordInput.value = appPassword;

  if (Array.isArray(saved.cachedProjects)) {
    populateProjects(saved.cachedProjects, saved.lastProjectId);
  }

  noteInput.focus();
  void refreshProjects(saved.lastProjectId);
}

async function sendNote() {
  const text = noteInput.value.trim();
  if (!text || sending) return;

  sending = true;
  sendBtn.disabled = true;
  clearStatus();

  try {
    const projectId = projectSelect.value || "default";
    const res = await fetch(`${serverUrl}/api/notes`, {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify({
        text,
        projectId,
        useAi: true,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showStatus(data.error || `Error (${res.status})`, "err");
      sending = false;
      sendBtn.disabled = false;
      return;
    }

    await storageSet({ lastProjectId: projectId });
    noteInput.value = "";
    charCount.textContent = "0/500";
    showStatus("Saved ✓", "ok");
    setTimeout(() => window.close(), 380);
  } catch {
    showStatus(`Cannot reach ${serverUrl}`, "err");
    sending = false;
    sendBtn.disabled = false;
  }
}

noteInput.addEventListener("input", () => {
  const len = noteInput.value.length;
  charCount.textContent = `${len}/500`;
  sendBtn.disabled = !noteInput.value.trim() || sending;
});

noteInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    void sendNote();
  } else if (e.key === "Escape") {
    window.close();
  }
});

projectSelect.addEventListener("change", () => {
  void storageSet({ lastProjectId: projectSelect.value });
  noteInput.focus();
});

sendBtn.addEventListener("click", () => {
  void sendNote();
});

settingsBtn.addEventListener("click", () => {
  settingsPanel.classList.toggle("hidden");
  if (!settingsPanel.classList.contains("hidden")) {
    serverUrlInput.focus();
  } else {
    noteInput.focus();
  }
});

saveSettingsBtn.addEventListener("click", async () => {
  serverUrl = normalizeUrl(serverUrlInput.value);
  appPassword = passwordInput.value.trim();
  await storageSet({ serverUrl, appPassword });
  settingsPanel.classList.add("hidden");
  showStatus("Settings saved", "ok");
  setTimeout(clearStatus, 1500);
  void refreshProjects(projectSelect.value);
  noteInput.focus();
});

void init();
