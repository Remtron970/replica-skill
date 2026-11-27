// Remtron5000: a free AI chat app. Everything runs on the device:
// the model (WebLLM on WebGPU, or a local Ollama server), accounts and chats (localStorage).
import { marked } from "./vendor/marked.esm.js";
import DOMPurify from "./vendor/purify.es.mjs";

const APP_NAME = "Remtron5000";

// True inside the native iOS app (Capacitor). The web build ignores this.
const IS_NATIVE = !!window.Capacitor?.isNativePlatform?.();

const WEBLLM_URL = "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.79/+esm";

// Open-weight models WebLLM ships prebuilt. Sizes are approximate download sizes.
const WEBLLM_MODELS = [
  { id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC", phone: true, label: "Qwen 2.5 1.5B · balanced (~1 GB)" },
  { id: "Llama-3.2-1B-Instruct-q4f16_1-MLC", phone: true, label: "Llama 3.2 1B · fast (~0.9 GB)" },
  { id: "Llama-3.2-3B-Instruct-q4f16_1-MLC", label: "Llama 3.2 3B · smarter (~2 GB)" },
  { id: "Qwen2.5-3B-Instruct-q4f16_1-MLC", label: "Qwen 2.5 3B · smarter (~2 GB)" },
  { id: "Phi-3.5-mini-instruct-q4f16_1-MLC", label: "Phi 3.5 mini · reasoning (~2.2 GB)" },
  { id: "gemma-2-2b-it-q4f16_1-MLC", phone: true, label: "Gemma 2 2B (~1.4 GB)" },
  { id: "SmolLM2-360M-Instruct-q4f16_1-MLC", phone: true, label: "SmolLM2 360M · tiny (~0.3 GB)" },
  { id: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC", phone: true, label: "Qwen 2.5 0.5B · tiny (~0.4 GB)" },
];

// On phones, only offer models that fit in an iPhone's memory budget.
const MODELS = IS_NATIVE ? WEBLLM_MODELS.filter((m) => m.phone) : WEBLLM_MODELS;

const SUGGESTIONS = [
  { icon: "🧠", color: "var(--accent)", text: "Explain how vaccines train the immune system, simply" },
  { icon: "💻", color: "var(--violet)", text: "Write a Python function that removes duplicate lines from a file" },
  { icon: "✈️", color: "var(--teal)", text: "Plan a 3-day weekend trip on a small budget" },
  { icon: "✉️", color: "var(--pink)", text: "Help me write a polite email asking for a deadline extension" },
];

const DEFAULT_SYSTEM = `You are ${APP_NAME}, a friendly, helpful, honest and concise assistant. Use Markdown for formatting when it helps. If you are not sure about something, say so.`;

// Avatar gradients people can pick on the Account page.
const AVATAR_COLORS = [
  ["#ff9a3c", "#ff5e62"], ["#f472b6", "#a855f7"], ["#60a5fa", "#7c3aed"],
  ["#34d399", "#0d9488"], ["#fbbf24", "#f97316"], ["#fb7185", "#e11d48"],
];
const GUEST_COLORS = ["#a8a29e", "#78716c"];

// ---------- storage ----------
const PREFIX = "r5k:";
const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(PREFIX + key); return v == null ? fallback : JSON.parse(v); }
    catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
  },
  remove(key) { try { localStorage.removeItem(PREFIX + key); } catch { /* ignore */ } },
};

// One-time move of data saved under the app's old name, so nobody loses their chats.
(function migrateOldData() {
  try {
    if (localStorage.getItem(PREFIX + "migrated")) return;
    const old = (k) => localStorage.getItem("parley:" + k);
    if (old("chats")) localStorage.setItem(PREFIX + "chats:guest", old("chats"));
    if (old("activeId")) localStorage.setItem(PREFIX + "activeId:guest", old("activeId"));
    if (old("settings")) localStorage.setItem(PREFIX + "settings", old("settings"));
    if (old("chats")) localStorage.setItem(PREFIX + "session", JSON.stringify("guest")); // returning user: don't block them
    localStorage.setItem(PREFIX + "migrated", "1");
  } catch { /* storage blocked */ }
})();

const state = {
  users: store.get("users", []),
  session: store.get("session", null), // a user id, "guest", or null (hasn't chosen yet)
  chats: [],
  activeId: null,
  settings: Object.assign(
    { engine: "webllm", model: WEBLLM_MODELS[0].id, ollamaUrl: "http://localhost:11434", ollamaModel: "", systemPrompt: DEFAULT_SYSTEM, temperature: 0.7, theme: "system" },
    store.get("settings", {})
  ),
  generating: false,
  abort: null,
};
if (/^You are Parley\b/.test(state.settings.systemPrompt)) state.settings.systemPrompt = DEFAULT_SYSTEM;

const currentUser = () => state.users.find((u) => u.id === state.session) || null;
const dataKey = () => (currentUser() ? currentUser().id : "guest");
const loadUserData = () => {
  state.chats = store.get("chats:" + dataKey(), []);
  state.activeId = store.get("activeId:" + dataKey(), null);
};
const saveChats = () => store.set("chats:" + dataKey(), state.chats);
const setActive = (id) => { state.activeId = id; store.set("activeId:" + dataKey(), id); };
const saveSettings = () => store.set("settings", state.settings);
const saveUsers = () => store.set("users", state.users);
const activeChat = () => state.chats.find((c) => c.id === state.activeId) || null;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const els = {
  app: $("app"), chatList: $("chatList"), messages: $("messages"), empty: $("empty"), suggestions: $("suggestions"),
  input: $("input"), composer: $("composer"), send: $("send"), stop: $("stop"), status: $("status"),
  modelSelect: $("modelSelect"), progress: $("progress"), progressBar: $("progressBar"), search: $("search"),
  settings: $("settings"), engineSelect: $("engineSelect"), ollamaUrl: $("ollamaUrl"), ollamaUrlRow: $("ollamaUrlRow"),
  systemPrompt: $("systemPrompt"), temperature: $("temperature"), tempOut: $("tempOut"), greeting: $("greeting"),
};

const setStatus = (text) => {
  els.status.textContent = text;
  // "idle" messages are hidden on narrow screens to give the model menu room; progress and errors stay visible.
  els.status.dataset.state = /^(Ready|Ollama connected|Model loads)/.test(text) ? "idle" : "busy";
};
const setProgress = (fraction) => {
  if (fraction == null) { els.progress.hidden = true; return; }
  els.progress.hidden = false;
  els.progressBar.style.width = Math.round(fraction * 100) + "%";
};

let toastTimer = 0;
function toast(text) {
  const t = $("toast");
  t.textContent = text;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

// ---------- engines ----------
// Each engine exposes: ensureReady(), stream(messages, opts) -> async iterator of text deltas, stop().
const webllmEngine = {
  engine: null, loadedModel: null, loading: null,
  async ensureReady(model) {
    if (!("gpu" in navigator)) {
      if (IS_NATIVE) throw new Error(`${APP_NAME} needs iOS 26 or later to run the AI on this iPhone. Please update iOS in Settings → General → Software Update.`);
      throw new Error("This browser has no WebGPU. Use a recent Chrome, Edge or Safari 26+, or switch the engine to Ollama in Settings.");
    }
    if (this.engine && this.loadedModel === model) return;
    if (this.loading) await this.loading.catch(() => {});
    if (this.engine && this.loadedModel === model) return;
    this.loading = (async () => {
      setStatus("Loading engine…");
      let webllm;
      try { webllm = await import(WEBLLM_URL); }
      catch { throw new Error("Couldn't download the AI engine. Check your internet connection (only the first load needs it), or switch the engine to Ollama in Settings."); }
      const initProgressCallback = (r) => { setStatus(r.text); setProgress(r.progress); };
      // In the iOS app, store model weights in IndexedDB, which is reliable inside WKWebView.
      const appConfig = { ...webllm.prebuiltAppConfig, useIndexedDBCache: IS_NATIVE };
      if (!this.engine) this.engine = await webllm.CreateMLCEngine(model, { initProgressCallback, appConfig });
      else await this.engine.reload(model);
      this.loadedModel = model;
      setProgress(null);
      setStatus("Ready · " + labelFor(model));
    })();
    try { await this.loading; } finally { this.loading = null; setProgress(null); }
  },
  async *stream(messages, { temperature }) {
    const chunks = await this.engine.chat.completions.create({ messages, temperature, stream: true });
    for await (const chunk of chunks) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) yield delta;
    }
  },
  stop() { this.engine?.interruptGenerate(); },
};

const ollamaEngine = {
  models: [],
  base() { return state.settings.ollamaUrl.replace(/\/+$/, ""); },
  async listModels() {
    const res = await fetch(this.base() + "/api/tags");
    if (!res.ok) throw new Error("Ollama answered " + res.status);
    const data = await res.json();
    this.models = (data.models || []).map((m) => m.name);
    return this.models;
  },
  async ensureReady(model) {
    if (!model) throw new Error("No Ollama model found. Run `ollama pull llama3.2` in a terminal, then reopen Settings.");
    setStatus("Ready · Ollama · " + model);
  },
  async *stream(messages, { temperature, signal }) {
    const res = await fetch(this.base() + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: state.settings.ollamaModel, messages, stream: true, options: { temperature } }),
      signal,
    });
    if (!res.ok || !res.body) throw new Error("Ollama answered " + res.status + ". " + (await res.text().catch(() => "")));
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        const obj = JSON.parse(line);
        if (obj.error) throw new Error(obj.error);
        if (obj.message?.content) yield obj.message.content;
      }
    }
  },
  stop() { /* handled by AbortController */ },
};

const currentEngine = () => (state.settings.engine === "ollama" ? ollamaEngine : webllmEngine);
const currentModel = () => (state.settings.engine === "ollama" ? state.settings.ollamaModel : state.settings.model);
const labelFor = (id) => WEBLLM_MODELS.find((m) => m.id === id)?.label.split(" (")[0] || id;

async function populateModels() {
  const sel = els.modelSelect;
  sel.innerHTML = "";
  if (state.settings.engine === "ollama") {
    try {
      const models = await ollamaEngine.listModels();
      if (!models.length) throw new Error("no models");
      if (!models.includes(state.settings.ollamaModel)) state.settings.ollamaModel = models[0];
      for (const m of models) sel.add(new Option("Ollama · " + m, m, false, m === state.settings.ollamaModel));
      setStatus("Ollama connected");
    } catch {
      sel.add(new Option("Ollama not reachable", ""));
      state.settings.ollamaModel = "";
      setStatus("Can't reach Ollama at " + state.settings.ollamaUrl + " (see README)");
    }
  } else {
    if (!MODELS.some((m) => m.id === state.settings.model)) state.settings.model = MODELS[0].id;
    for (const m of MODELS) sel.add(new Option(m.label, m.id, false, m.id === state.settings.model));
    setStatus(webllmEngine.loadedModel === state.settings.model ? "Ready · " + labelFor(state.settings.model) : "Model loads on your first message");
  }
  saveSettings();
}

// ---------- accounts (stored on this device only) ----------
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function hashPassword(password, saltB64) {
  if (!crypto?.subtle) throw new Error("Accounts need a secure (https) connection.");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: unb64(saltB64), iterations: 210000 }, key, 256);
  return b64(bits);
}
const newSalt = () => b64(crypto.getRandomValues(new Uint8Array(16)));
const normUser = (u) => u.trim().toLowerCase();
const sameHash = (a, b) => a.length === b.length && [...a].reduce((d, ch, i) => d | (ch.charCodeAt(0) ^ b.charCodeAt(i)), 0) === 0;

const accounts = {
  validate(username, password) {
    if (!/^[a-z0-9_.]{3,20}$/.test(username)) return "Username must be 3–20 characters: letters, numbers, _ or .";
    if (password.length < 6) return "Password must be at least 6 characters.";
    return "";
  },
  async create({ name, username, password, bring }) {
    username = normUser(username);
    const problem = this.validate(username, password);
    if (problem) throw new Error(problem);
    if (state.users.some((u) => u.username === username)) throw new Error("That username is taken on this device.");
    const salt = newSalt();
    const user = {
      id: "u_" + uid(), username, name: name.trim() || username, color: Math.floor(Math.random() * AVATAR_COLORS.length),
      salt, hash: await hashPassword(password, salt), createdAt: Date.now(),
    };
    state.users.push(user);
    saveUsers();
    if (bring) {
      // Move the guest's chats into the new account.
      store.set("chats:" + user.id, store.get("chats:guest", []));
      store.set("activeId:" + user.id, store.get("activeId:guest", null));
      store.remove("chats:guest"); store.remove("activeId:guest");
    }
    this.startSession(user.id);
    return user;
  },
  async signIn(username, password) {
    const user = state.users.find((u) => u.username === normUser(username));
    const hash = user ? await hashPassword(password, user.salt) : await hashPassword(password, newSalt()); // same timing either way
    if (!user || !sameHash(hash, user.hash)) throw new Error("Wrong username or password.");
    this.startSession(user.id);
    return user;
  },
  startSession(id) {
    if (state.generating) stopGenerating();
    state.session = id;
    store.set("session", id);
    loadUserData();
    renderAll();
  },
  signOut() { this.startSession(null); showAuth("signin"); },
  async changePassword(oldPass, newPass) {
    const user = currentUser();
    if (!sameHash(await hashPassword(oldPass, user.salt), user.hash)) throw new Error("Current password is wrong.");
    if (newPass.length < 6) throw new Error("New password must be at least 6 characters.");
    user.salt = newSalt();
    user.hash = await hashPassword(newPass, user.salt);
    saveUsers();
  },
  remove() {
    const user = currentUser();
    store.remove("chats:" + user.id); store.remove("activeId:" + user.id);
    state.users = state.users.filter((u) => u.id !== user.id);
    saveUsers();
    this.startSession(null);
    showAuth(state.users.length ? "signin" : "signup");
  },
};

function paintAvatar(el, user) {
  const [c1, c2] = user ? AVATAR_COLORS[user.color % AVATAR_COLORS.length] : GUEST_COLORS;
  el.style.setProperty("--c1", c1);
  el.style.setProperty("--c2", c2);
  const initials = user ? user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => [...w][0]).join("").toUpperCase() : "G";
  el.textContent = initials || "?";
}

function renderIdentity() {
  const user = currentUser();
  paintAvatar($("chipAvatar"), user);
  paintAvatar($("topAvatar"), user);
  $("chipName").textContent = user ? user.name : "Guest";
  $("chipSub").textContent = user ? "@" + user.username : "Sign in or create account";
  const first = user?.name.split(/\s+/)[0];
  els.greeting.textContent = first ? `Hi ${first}! What can I help with?` : "What can I help with?";
}

// Sign-in screen
let authMode = "signin";
function showAuth(mode) {
  setAuthMode(mode);
  const a = $("auth");
  a.classList.remove("leaving");
  a.hidden = false;
  $("authError").textContent = "";
  $("authPass").value = "";
  setTimeout(() => (mode === "signup" ? $("authName") : $("authUser")).focus(), 50);
}
function hideAuth() {
  const a = $("auth");
  if (a.hidden) return;
  a.classList.add("leaving");
  setTimeout(() => { a.hidden = true; a.classList.remove("leaving"); els.input.focus(); }, 340);
}
function setAuthMode(mode) {
  authMode = mode;
  const up = mode === "signup";
  $("tabSignIn").setAttribute("aria-selected", String(!up));
  $("tabSignUp").setAttribute("aria-selected", String(up));
  document.querySelector(".tabs").classList.toggle("signup", up);
  $("nameRow").hidden = !up;
  $("bringRow").hidden = !(up && store.get("chats:guest", []).length);
  $("authPass").autocomplete = up ? "new-password" : "current-password";
  $("authSubmit").textContent = up ? "Create account" : "Sign in";
  $("authError").textContent = "";
}
$("tabSignIn").addEventListener("click", () => setAuthMode("signin"));
$("tabSignUp").addEventListener("click", () => setAuthMode("signup"));
$("authForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("authSubmit");
  btn.disabled = true;
  $("authError").textContent = "";
  try {
    const user = authMode === "signup"
      ? await accounts.create({ name: $("authName").value, username: $("authUser").value, password: $("authPass").value, bring: $("bringChats").checked })
      : await accounts.signIn($("authUser").value, $("authPass").value);
    hideAuth();
    toast(authMode === "signup" ? `Welcome, ${user.name}! 🎉` : `Welcome back, ${user.name}!`);
    $("authForm").reset();
  } catch (err) {
    $("authError").textContent = err.message;
  } finally {
    btn.disabled = false;
  }
});
$("continueGuest").addEventListener("click", () => { accounts.startSession("guest"); hideAuth(); });

// Account page
function openAccount() {
  const user = currentUser();
  closeSidebar();
  paintAvatar($("accAvatar"), user);
  $("accName").textContent = user ? user.name : "Guest";
  $("accHandle").textContent = user ? "@" + user.username : "Not signed in";
  $("statChats").textContent = state.chats.length;
  $("statMsgs").textContent = state.chats.reduce((n, c) => n + c.messages.length, 0);
  $("statSince").textContent = user ? new Date(user.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" }) : "-";
  $("accGuest").hidden = !!user;
  $("accUser").hidden = !user;
  for (const id of ["passError", "passOk", "profileOk"]) $(id).textContent = "";
  $("passForm").reset();
  if (user) {
    $("profName").value = user.name;
    $("passUserHint").value = user.username;
    renderSwatches(user.color);
  }
  $("account").showModal();
}
function renderSwatches(selected) {
  const box = $("swatches");
  box.querySelectorAll(".swatch").forEach((s) => s.remove());
  AVATAR_COLORS.forEach(([c1, c2], i) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "swatch";
    b.style.setProperty("--c1", c1); b.style.setProperty("--c2", c2);
    b.setAttribute("aria-label", "Color " + (i + 1));
    b.setAttribute("aria-pressed", String(i === selected));
    b.onclick = () => {
      box.querySelectorAll(".swatch").forEach((s) => s.setAttribute("aria-pressed", "false"));
      b.setAttribute("aria-pressed", "true");
      box.dataset.choice = i;
      const preview = { ...currentUser(), color: i, name: $("profName").value || currentUser().name };
      paintAvatar($("accAvatar"), preview);
    };
    box.appendChild(b);
  });
  box.dataset.choice = selected;
}
$("openAccount").addEventListener("click", openAccount);
$("topAvatar").addEventListener("click", openAccount);
$("closeAccount").addEventListener("click", () => $("account").close());
$("account").addEventListener("click", (e) => { if (e.target === $("account")) $("account").close(); });
$("accSignUp").addEventListener("click", () => { $("account").close(); showAuth("signup"); });
$("accSignIn").addEventListener("click", () => { $("account").close(); showAuth("signin"); });
$("profileForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const user = currentUser();
  user.name = $("profName").value.trim() || user.username;
  user.color = Number($("swatches").dataset.choice ?? user.color);
  saveUsers();
  renderIdentity();
  $("accName").textContent = user.name;
  paintAvatar($("accAvatar"), user);
  $("profileOk").textContent = "Saved ✓";
});
$("passForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("passError").textContent = ""; $("passOk").textContent = "";
  try {
    await accounts.changePassword($("passOld").value, $("passNew").value);
    $("passForm").reset();
    $("passOk").textContent = "Password updated ✓";
  } catch (err) { $("passError").textContent = err.message; }
});
$("signOut").addEventListener("click", () => { $("account").close(); accounts.signOut(); });
$("deleteAccount").addEventListener("click", () => {
  const user = currentUser();
  if (!confirm(`Delete the account “${user.username}” and all ${state.chats.length} of its chats from this device? This can't be undone.`)) return;
  $("account").close();
  accounts.remove();
  toast("Account deleted");
});

// ---------- rendering ----------
marked.setOptions({ gfm: true, breaks: true });
function renderMarkdown(text) {
  const html = DOMPurify.sanitize(marked.parse(text));
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  for (const pre of tpl.content.querySelectorAll("pre")) {
    const btn = document.createElement("button");
    btn.className = "copy-code"; btn.type = "button"; btn.textContent = "Copy";
    pre.appendChild(btn);
  }
  for (const a of tpl.content.querySelectorAll("a")) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
  return tpl.content;
}

function dayGroup(ts) {
  const d = new Date(ts), now = new Date();
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = (startOf(now) - startOf(d)) / 86400000;
  if (diff < 1) return "Today";
  if (diff < 2) return "Yesterday";
  if (diff < 7) return "Previous 7 days";
  if (diff < 30) return "Previous 30 days";
  return d.toLocaleString(undefined, { month: "long", year: "numeric" });
}

function renderChatList() {
  const q = els.search.value.trim().toLowerCase();
  const list = [...state.chats]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .filter((c) => !q || c.title.toLowerCase().includes(q) || c.messages.some((m) => m.content.toLowerCase().includes(q)));
  els.chatList.innerHTML = "";
  if (!list.length) {
    const p = document.createElement("p");
    p.className = "chat-group";
    p.textContent = q ? "No chats match." : "No chats yet.";
    els.chatList.appendChild(p);
    return;
  }
  let lastGroup = null;
  list.forEach((chat, i) => {
    const g = dayGroup(chat.updatedAt);
    if (g !== lastGroup) {
      const h = document.createElement("div"); h.className = "chat-group"; h.textContent = g;
      els.chatList.appendChild(h); lastGroup = g;
    }
    const row = document.createElement("div");
    row.className = "chat-item" + (chat.id === state.activeId ? " active" : "");
    row.style.setProperty("--i", Math.min(i, 12));
    const open = document.createElement("button");
    open.className = "open"; open.textContent = chat.title; open.title = chat.title;
    open.onclick = () => { selectChat(chat.id); closeSidebar(); };
    const actions = document.createElement("div"); actions.className = "row-actions";
    const ren = document.createElement("button"); ren.textContent = "✎"; ren.setAttribute("aria-label", "Rename chat");
    ren.onclick = () => {
      const t = prompt("Rename chat", chat.title);
      if (t && t.trim()) { chat.title = t.trim().slice(0, 120); saveChats(); renderChatList(); }
    };
    const del = document.createElement("button"); del.textContent = "🗑"; del.setAttribute("aria-label", "Delete chat");
    del.onclick = () => {
      if (!confirm(`Delete “${chat.title}”?`)) return;
      state.chats = state.chats.filter((c) => c.id !== chat.id);
      if (state.activeId === chat.id) setActive(null);
      saveChats(); renderAll(); toast("Chat deleted");
    };
    actions.append(ren, del);
    row.append(open, actions);
    els.chatList.appendChild(row);
  });
}

function messageNode(msg, index, chat) {
  const wrap = document.createElement("article");
  wrap.className = "msg " + msg.role;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  if (msg.role === "user") bubble.textContent = msg.content;
  else if (msg.error) { const p = document.createElement("p"); p.className = "error-note"; p.textContent = msg.content; bubble.appendChild(p); }
  else bubble.appendChild(renderMarkdown(msg.content));
  wrap.appendChild(bubble);

  const actions = document.createElement("div");
  actions.className = "msg-actions";
  const add = (label, fn) => { const b = document.createElement("button"); b.type = "button"; b.textContent = label; b.onclick = fn; actions.appendChild(b); return b; };
  const copyBtn = add("Copy", async () => {
    await navigator.clipboard.writeText(msg.content).catch(() => {});
    copyBtn.textContent = "Copied ✓"; setTimeout(() => (copyBtn.textContent = "Copy"), 1200);
  });
  if (msg.role === "user") add("Edit", () => startEdit(wrap, index, chat));
  const isLast = index === chat.messages.length - 1;
  if (msg.role === "assistant" && isLast) add("↻ Regenerate", () => regenerate());
  wrap.appendChild(actions);
  return wrap;
}

function renderMessages() {
  const chat = activeChat();
  els.messages.innerHTML = "";
  const empty = !chat || chat.messages.length === 0;
  els.empty.hidden = !empty;
  if (empty) return;
  chat.messages.forEach((m, i) => {
    const node = messageNode(m, i, chat);
    node.style.animationDelay = Math.max(0, i - chat.messages.length + 4) * 40 + "ms"; // stagger the last few
    els.messages.appendChild(node);
  });
  scrollToBottom(true);
}

function scrollToBottom(force) {
  const m = els.messages;
  const nearBottom = m.scrollHeight - m.scrollTop - m.clientHeight < 120;
  if (force || nearBottom) m.scrollTop = m.scrollHeight;
}

function renderAll() { renderIdentity(); renderChatList(); renderMessages(); updateComposer(); }

function updateComposer() {
  els.send.hidden = state.generating;
  els.stop.hidden = !state.generating;
  els.send.disabled = !els.input.value.trim();
}

function startEdit(wrap, index, chat) {
  if (state.generating) return;
  const original = chat.messages[index].content;
  wrap.innerHTML = "";
  const ta = document.createElement("textarea");
  ta.className = "edit-box"; ta.value = original; ta.rows = Math.min(10, original.split("\n").length + 1);
  const row = document.createElement("div"); row.className = "edit-actions";
  const cancel = document.createElement("button"); cancel.className = "ghost"; cancel.type = "button"; cancel.textContent = "Cancel";
  const save = document.createElement("button"); save.className = "primary"; save.type = "button"; save.textContent = "Send";
  cancel.onclick = renderMessages;
  save.onclick = () => {
    const text = ta.value.trim();
    if (!text) return;
    chat.messages = chat.messages.slice(0, index);
    sendMessage(text);
  };
  row.append(cancel, save);
  wrap.append(ta, row);
  ta.focus();
}

// ---------- chat flow ----------
function selectChat(id) {
  if (state.generating) stopGenerating();
  setActive(id); renderAll(); els.input.focus();
}

function newChat() {
  if (state.generating) stopGenerating();
  setActive(null); renderAll(); closeSidebar(); els.input.focus();
}

function ensureChat(firstText) {
  let chat = activeChat();
  if (!chat) {
    chat = { id: uid(), title: firstText.replace(/\s+/g, " ").slice(0, 48) || "New chat", createdAt: Date.now(), updatedAt: Date.now(), messages: [] };
    state.chats.push(chat);
    setActive(chat.id);
  }
  return chat;
}

async function sendMessage(text) {
  if (state.generating) return;
  const chat = ensureChat(text);
  chat.messages.push({ role: "user", content: text });
  chat.updatedAt = Date.now();
  saveChats();
  els.input.value = ""; autosize();
  await generateReply(chat);
}

async function regenerate() {
  const chat = activeChat();
  if (!chat || state.generating) return;
  if (chat.messages.at(-1)?.role === "assistant") chat.messages.pop();
  if (!chat.messages.length) return;
  await generateReply(chat);
}

async function generateReply(chat) {
  state.generating = true;
  state.abort = new AbortController();
  renderAll();

  const reply = { role: "assistant", content: "" };
  chat.messages.push(reply);
  const node = messageNode(reply, chat.messages.length - 1, chat);
  const bubble = node.querySelector(".bubble");
  bubble.innerHTML = '<span class="dots" aria-label="Thinking"><i></i><i></i><i></i></span>';
  node.querySelector(".msg-actions").style.visibility = "hidden";
  els.messages.appendChild(node);
  els.empty.hidden = true;
  scrollToBottom(true);

  const engine = currentEngine();
  const history = chat.messages.slice(0, -1).filter((m) => !m.error).map(({ role, content }) => ({ role, content }));
  const sys = state.settings.systemPrompt.trim();
  const messages = sys ? [{ role: "system", content: sys }, ...history] : history;

  let frame = 0;
  const paint = () => { bubble.classList.add("typing"); bubble.replaceChildren(renderMarkdown(reply.content)); scrollToBottom(); };
  try {
    await engine.ensureReady(currentModel());
    setStatus("Thinking…");
    for await (const delta of engine.stream(messages, { temperature: Number(state.settings.temperature), signal: state.abort.signal })) {
      reply.content += delta;
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; paint(); });
    }
  } catch (err) {
    if (err.name !== "AbortError") {
      if (!reply.content) { reply.content = "⚠ " + (err.message || String(err)); reply.error = true; }
      else reply.content += "\n\n_(stopped: " + (err.message || err) + ")_";
    }
  } finally {
    if (frame) cancelAnimationFrame(frame);
    if (!reply.content) chat.messages.pop(); // stopped before any text arrived
    state.generating = false;
    state.abort = null;
    chat.updatedAt = Date.now();
    saveChats();
    // Re-render in place without replaying the entrance animation on every message.
    renderIdentity(); renderChatList(); updateComposer();
    els.messages.innerHTML = "";
    chat.messages.forEach((m, i) => { const n = messageNode(m, i, chat); n.style.animation = "none"; els.messages.appendChild(n); });
    els.empty.hidden = chat.messages.length > 0;
    scrollToBottom();
    if (engine === webllmEngine && webllmEngine.loadedModel) setStatus("Ready · " + labelFor(webllmEngine.loadedModel));
    else if (engine === ollamaEngine && state.settings.ollamaModel) setStatus("Ready · Ollama · " + state.settings.ollamaModel);
  }
}

function stopGenerating() {
  currentEngine().stop();
  state.abort?.abort();
}

// ---------- UI wiring ----------
function autosize() {
  els.input.style.height = "auto";
  els.input.style.height = Math.min(els.input.scrollHeight, 200) + "px";
  updateComposer();
}

function openSidebar() { els.app.classList.add("sidebar-open"); $("scrim").hidden = false; }
function closeSidebar() { els.app.classList.remove("sidebar-open"); $("scrim").hidden = true; }

const isDark = () => state.settings.theme === "dark" || (state.settings.theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
function applyTheme() {
  const t = state.settings.theme;
  if (t === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  $("themeToggle").textContent = isDark() ? "☀" : "☾";
}

els.composer.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = els.input.value.trim();
  if (text) sendMessage(text);
});
els.input.addEventListener("input", autosize);
els.input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); els.composer.requestSubmit(); }
});
els.stop.addEventListener("click", stopGenerating);
$("newChat").addEventListener("click", newChat);
$("openSidebar").addEventListener("click", openSidebar);
$("closeSidebar").addEventListener("click", closeSidebar);
$("scrim").addEventListener("click", closeSidebar);
els.search.addEventListener("input", renderChatList);

els.messages.addEventListener("click", async (e) => {
  const btn = e.target.closest(".copy-code");
  if (!btn) return;
  const code = btn.parentElement.querySelector("code")?.innerText ?? btn.parentElement.innerText.replace(/Copy$/, "");
  await navigator.clipboard.writeText(code).catch(() => {});
  btn.textContent = "Copied ✓"; setTimeout(() => (btn.textContent = "Copy"), 1200);
});

els.modelSelect.addEventListener("change", () => {
  if (state.settings.engine === "ollama") state.settings.ollamaModel = els.modelSelect.value;
  else state.settings.model = els.modelSelect.value;
  saveSettings();
  setStatus(state.settings.engine === "ollama" ? "Ready · Ollama · " + els.modelSelect.value : "Model loads on your next message");
});

$("themeToggle").addEventListener("click", () => {
  state.settings.theme = isDark() ? "light" : "dark";
  saveSettings(); applyTheme();
});

// Settings dialog
$("openSettings").addEventListener("click", () => {
  els.engineSelect.value = state.settings.engine;
  els.ollamaUrl.value = state.settings.ollamaUrl;
  els.systemPrompt.value = state.settings.systemPrompt;
  els.temperature.value = state.settings.temperature;
  els.tempOut.textContent = state.settings.temperature;
  els.ollamaUrlRow.hidden = state.settings.engine !== "ollama";
  closeSidebar();
  els.settings.showModal();
});
els.engineSelect.addEventListener("change", () => { els.ollamaUrlRow.hidden = els.engineSelect.value !== "ollama"; });
els.temperature.addEventListener("input", () => { els.tempOut.textContent = els.temperature.value; });
els.settings.addEventListener("close", () => {
  state.settings.engine = els.engineSelect.value;
  state.settings.ollamaUrl = els.ollamaUrl.value || "http://localhost:11434";
  state.settings.systemPrompt = els.systemPrompt.value;
  state.settings.temperature = Number(els.temperature.value);
  saveSettings();
  populateModels();
});
$("clearAll").addEventListener("click", () => {
  if (!confirm("Delete every chat in this account? This can't be undone.")) return;
  state.chats = []; setActive(null); saveChats();
  els.settings.close(); renderAll(); toast("All chats deleted");
});

SUGGESTIONS.forEach((s, i) => {
  const b = document.createElement("button");
  b.type = "button";
  b.style.setProperty("--c", s.color);
  b.style.setProperty("--i", i);
  const ico = document.createElement("span"); ico.className = "ico"; ico.textContent = s.icon; ico.setAttribute("aria-hidden", "true");
  const t = document.createElement("span"); t.textContent = s.text;
  b.append(ico, t);
  b.onclick = () => sendMessage(s.text);
  els.suggestions.appendChild(b);
});

// ---------- installable app ----------
let installPrompt = null;
const installBtn = $("installApp");
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

if (IS_NATIVE) {
  // Native app: no install button, no service worker, and no Ollama (there's no local server on a phone).
  state.settings.engine = "webllm";
  els.engineSelect.querySelector('option[value="ollama"]')?.remove();
  els.engineSelect.closest("label").hidden = true;
  document.documentElement.classList.add("native");
} else if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installPrompt = e;
  installBtn.hidden = false;
});
window.addEventListener("appinstalled", () => { installPrompt = null; installBtn.hidden = true; toast(`${APP_NAME} installed 🎉`); });
if (!IS_NATIVE && !isStandalone() && isIOS) installBtn.hidden = false; // iOS has no install prompt; show instructions
installBtn.addEventListener("click", async () => {
  if (installPrompt) {
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") installBtn.hidden = true;
    installPrompt = null;
    return;
  }
  $("installSteps").textContent = isIOS
    ? "In Safari, tap the Share button, then “Add to Home Screen”."
    : "Open your browser's menu and choose “Install app” or “Add to Home screen”.";
  $("installHelp").showModal();
});

// ---------- start ----------
if (state.session && state.session !== "guest" && !currentUser()) { state.session = null; store.set("session", null); }
loadUserData();
if (new URLSearchParams(location.search).has("new")) { setActive(null); history.replaceState(null, "", location.pathname); }

applyTheme();
populateModels();
renderAll();
if (state.session === null) showAuth(state.users.length ? "signin" : "signup");
else els.input.focus();
