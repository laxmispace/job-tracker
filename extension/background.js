// Background service worker: owns the Supabase session and talks to the
// web app's API. Content scripts and the popup message it.
importScripts("shared.js");

const store = {
  get: (keys) => chrome.storage.local.get(keys),
  set: (obj) => chrome.storage.local.set(obj),
  remove: (keys) => chrome.storage.local.remove(keys),
};

// ───────────────────────────── config ─────────────────────────────
async function getConfig() {
  const { appUrl, supabaseUrl, supabaseAnonKey } = await store.get(["appUrl", "supabaseUrl", "supabaseAnonKey"]);
  return { appUrl, supabaseUrl, supabaseAnonKey };
}

async function setAppUrl(appUrl) {
  appUrl = String(appUrl || "").trim().replace(/\/+$/, "");
  if (!/^https?:\/\//.test(appUrl)) throw new Error("Enter the full URL, e.g. https://your-app.vercel.app");
  const res = await fetch(appUrl + "/api/config").catch(() => null);
  if (!res || !res.ok) throw new Error("Couldn't reach " + appUrl + "/api/config — is the app deployed?");
  const cfg = await res.json();
  if (!cfg.supabaseUrl) throw new Error("The app is missing its Supabase env vars.");
  await store.set({ appUrl, supabaseUrl: cfg.supabaseUrl, supabaseAnonKey: cfg.supabaseAnonKey, ai: cfg.ai });
  return cfg;
}

// ───────────────────────────── auth ───────────────────────────────
async function signIn(email, password) {
  const { supabaseUrl, supabaseAnonKey } = await getConfig();
  const res = await fetch(supabaseUrl + "/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: { apikey: supabaseAnonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error_description || body.msg || body.message || "Sign-in failed");
  await saveSession(body);
  return { email: body.user.email };
}

async function saveSession(s) {
  await store.set({
    session: {
      access_token: s.access_token,
      refresh_token: s.refresh_token,
      expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600),
      user: { id: s.user.id, email: s.user.email },
    },
  });
}

let refreshing = null;
async function getSession() {
  const { session } = await store.get("session");
  if (!session) return null;
  if (session.expires_at - 60 > Date.now() / 1000) return session;
  // Refresh (de-duplicated across concurrent callers)
  refreshing =
    refreshing ||
    (async () => {
      const { supabaseUrl, supabaseAnonKey } = await getConfig();
      const res = await fetch(supabaseUrl + "/auth/v1/token?grant_type=refresh_token", {
        method: "POST",
        headers: { apikey: supabaseAnonKey, "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: session.refresh_token }),
      });
      if (!res.ok) {
        await store.remove("session");
        return null;
      }
      const body = await res.json();
      await saveSession(body);
      return (await store.get("session")).session;
    })().finally(() => (refreshing = null));
  return refreshing;
}

async function requireSession() {
  const s = await getSession();
  if (!s) throw new Error("Sign in from the Job Tracker extension popup first.");
  return s;
}

// ──────────────────────── Supabase REST helpers ────────────────────
async function rest(path, { method = "GET", body, prefer } = {}) {
  const { supabaseUrl, supabaseAnonKey } = await getConfig();
  const s = await requireSession();
  const res = await fetch(supabaseUrl + "/rest/v1/" + path, {
    method,
    headers: {
      apikey: supabaseAnonKey,
      Authorization: "Bearer " + s.access_token,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error((data && (data.message || data.hint)) || "Database error " + res.status);
  return data;
}

async function appApi(path, body) {
  const { appUrl } = await getConfig();
  const s = await requireSession();
  const res = await fetch(appUrl + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + s.access_token },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed (" + res.status + ")");
  return data;
}

// ───────────────────────────── jobs ───────────────────────────────
async function findJob(url) {
  const rows = await rest("jobs?select=id,status,title,company,url&url=eq." + encodeURIComponent(JT.canonicalUrl(url)));
  return rows[0] || null;
}

/**
 * Creates or updates a job card. Never blanks out existing fields and never
 * moves a card backwards (e.g. Interview → Applied) when auto-tracking.
 */
async function saveJob(job, { auto = false } = {}) {
  const s = await requireSession();
  const url = JT.canonicalUrl(job.url);
  const existing = (
    await rest("jobs?select=id,status,applied_at,title,company,description&url=eq." + encodeURIComponent(url))
  )[0];
  const status = job.status || "applied";
  const nowIso = new Date().toISOString();

  if (existing) {
    const patch = {};
    ["title", "company", "location", "notes", "salary"].forEach((k) => {
      if (job[k] && (!existing[k] || !auto)) patch[k] = job[k];
    });
    if (job.description && (!existing.description || existing.description.length < job.description.length)) {
      patch.description = job.description.slice(0, 15000);
    }
    const upgrade = JT.STATUS_RANK[status] > JT.STATUS_RANK[existing.status];
    if (!auto || upgrade) patch.status = status;
    if (status !== "saved" && !existing.applied_at) patch.applied_at = nowIso;
    if (!Object.keys(patch).length) return { ...existing, unchanged: true };
    const rows = await rest("jobs?id=eq." + existing.id, { method: "PATCH", body: patch, prefer: "return=representation" });
    return rows[0];
  }

  const row = {
    user_id: s.user.id,
    url,
    title: job.title || "",
    company: job.company || "",
    location: job.location || "",
    source: JT.detectSource(url),
    status,
    description: (job.description || "").slice(0, 15000),
    notes: job.notes || "",
    applied_at: status === "saved" ? null : nowIso,
  };
  const rows = await rest("jobs", { method: "POST", body: row, prefer: "return=representation" });
  return { ...rows[0], created: true };
}

// ─────────────────────── answers + resume ──────────────────────────
let answersCache = { at: 0, rows: [] };
async function getAnswers(force) {
  if (!force && Date.now() - answersCache.at < 2 * 60 * 1000) return answersCache.rows;
  const rows = await rest("answers?select=key,question,answer,aliases,long_form&answer=neq.");
  answersCache = { at: Date.now(), rows };
  return rows;
}

async function getResume() {
  const { supabaseUrl, supabaseAnonKey } = await getConfig();
  const s = await requireSession();
  const headers = { apikey: supabaseAnonKey, Authorization: "Bearer " + s.access_token };
  const list = await fetch(supabaseUrl + "/storage/v1/object/list/resumes", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ prefix: s.user.id + "/", limit: 5 }),
  }).then((r) => r.json());
  const file = (Array.isArray(list) ? list : []).find((f) => f.name && f.name !== ".emptyFolderPlaceholder");
  if (!file) return null;
  const res = await fetch(supabaseUrl + "/storage/v1/object/authenticated/resumes/" + s.user.id + "/" + encodeURIComponent(file.name), { headers });
  if (!res.ok) return null;
  const buf = await res.arrayBuffer();
  let bin = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return { name: file.name, type: res.headers.get("content-type") || "application/pdf", base64: btoa(bin) };
}

// ──────────────── remember which job a tab was showing ─────────────
// Lets us link "Apply on company site" tabs back to the LinkedIn posting.
async function rememberTabJob(tabId, job) {
  if (!job || !job.title) return;
  const key = "tab_" + tabId;
  await chrome.storage.session.set({ [key]: { ...job, at: Date.now() } });
}
async function tabJob(tabId) {
  if (tabId == null) return null;
  const key = "tab_" + tabId;
  const r = await chrome.storage.session.get(key);
  return r[key] || null;
}
chrome.tabs.onRemoved.addListener((tabId) => chrome.storage.session.remove("tab_" + tabId));

async function handleApplied(job, tab) {
  const { autoTrack = true } = await store.get("autoTrack");
  if (!autoTrack) return { skipped: "auto-track off" };
  // If this tab was opened from a job posting (e.g. LinkedIn → company ATS),
  // track it against that original posting instead of creating a duplicate.
  let target = job;
  const opener = tab && tab.openerTabId != null ? await tabJob(tab.openerTabId) : null;
  if (opener && Date.now() - opener.at < 6 * 60 * 60 * 1000) {
    target = { ...opener, notes: "Applied via " + job.url };
  } else if (!job.title) {
    const same = await tabJob(tab && tab.id);
    if (same) target = { ...same, url: same.url };
  }
  const saved = await saveJob({ ...target, status: "applied" }, { auto: true });
  return { job: saved };
}

// ─────────────────────── AI model switcher ────────────────────────
// Same setting as the web app's dropdown (stored on the Supabase user).
async function aiState() {
  const { appUrl } = await getConfig();
  const s = await requireSession();
  const res = await fetch(appUrl + "/api/ai/providers", { headers: { Authorization: "Bearer " + s.access_token } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Couldn't load AI models");
  return {
    active: data.active,
    providers: (data.providers || []).filter((p) => p.configured).map((p) => ({ id: p.id, label: p.label, model: p.model })),
  };
}

async function setAiProvider(id) {
  const { supabaseUrl, supabaseAnonKey } = await getConfig();
  const s = await requireSession();
  const headers = { apikey: supabaseAnonKey, Authorization: "Bearer " + s.access_token, "Content-Type": "application/json" };
  const user = await fetch(supabaseUrl + "/auth/v1/user", { headers }).then((r) => r.json());
  const ai = { ...((user.user_metadata && user.user_metadata.ai) || {}), provider: id };
  const res = await fetch(supabaseUrl + "/auth/v1/user", { method: "PUT", headers, body: JSON.stringify({ data: { ai } }) });
  if (!res.ok) throw new Error("Couldn't switch model");
  return { active: id };
}

// ───────────────────────────── router ─────────────────────────────
const handlers = {
  async state() {
    const cfg = await getConfig();
    const s = await getSession().catch(() => null);
    const { autoTrack = true, ai } = await store.get(["autoTrack", "ai"]);
    return { appUrl: cfg.appUrl, signedIn: Boolean(s), email: s && s.user.email, autoTrack, ai };
  },
  setAppUrl: (m) => setAppUrl(m.appUrl),
  signIn: (m) => signIn(m.email, m.password),
  signOut: () => store.remove("session").then(() => ({ ok: true })),
  setAutoTrack: (m) => store.set({ autoTrack: Boolean(m.value) }).then(() => ({ ok: true })),
  findJob: (m) => findJob(m.url),
  saveJob: (m) => saveJob(m.job),
  answers: (m) => getAnswers(m.force),
  resume: () => getResume(),
  aiAnswer: (m) => appApi("/api/ai/answer", m.payload),
  aiState: () => aiState(),
  setAiProvider: (m) => setAiProvider(m.id),
  pageJob: (m, sender) => rememberTabJob(sender.tab && sender.tab.id, m.job).then(() => ({ ok: true })),
  applied: (m, sender) => handleApplied(m.job, sender.tab),
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const h = handlers[msg && msg.type];
  if (!h) return false;
  Promise.resolve()
    .then(() => h(msg, sender))
    .then((data) => sendResponse({ ok: true, data }))
    .catch((e) => sendResponse({ ok: false, error: e.message || String(e) }));
  return true; // async response
});

// Keyboard shortcut → autofill the active tab (all frames).
chrome.commands.onCommand.addListener(async (cmd) => {
  if (cmd !== "autofill") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) chrome.tabs.sendMessage(tab.id, { type: "autofill" }).catch(() => {});
});
