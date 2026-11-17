const $ = (id) => document.getElementById(id);
const bg = (msg) =>
  new Promise((resolve) =>
    chrome.runtime.sendMessage(msg, (r) => resolve(r || { ok: false, error: chrome.runtime.lastError?.message || "No response" })),
  );
const show = (id) => ["setup", "login", "main"].forEach((s) => ($(s).hidden = s !== id));
const say = (id, text, tone = "") => {
  $(id).textContent = text;
  $(id).className = "msg " + tone;
};

let state = null;
let tab = null;
let savedJob = null;

async function init() {
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const r = await bg({ type: "state" });
  state = r.data || {};
  if (!state.appUrl) return show("setup");
  $("openApp").hidden = false;
  $("openApp").onclick = (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: state.appUrl });
  };
  if (!state.signedIn) return show("login");
  show("main");
  $("who").textContent = state.email;
  $("autoTrack").checked = state.autoTrack !== false;
  loadModels();
  await loadPage();
}

async function loadModels() {
  const r = await bg({ type: "aiState" });
  const sel = $("aiModel");
  if (!r.ok || !r.data.providers.length) {
    sel.innerHTML = `<option>${r.ok ? "No AI key yet — add one in the app" : "Couldn't load models"}</option>`;
    sel.disabled = true;
    return;
  }
  sel.disabled = false;
  sel.innerHTML = r.data.providers
    .map((p) => `<option value="${p.id}">${p.label}${p.model ? " · " + p.model : ""}</option>`)
    .join("");
  sel.value = r.data.active || r.data.providers[0].id;
}

$("aiModel").onchange = async (e) => {
  const r = await bg({ type: "setAiProvider", id: e.target.value });
  say("fillMsg", r.ok ? "Model switched — used for AI answers on forms." : r.error, r.ok ? "ok" : "err");
};

async function talkToTab(msg) {
  try {
    return await chrome.tabs.sendMessage(tab.id, msg);
  } catch (_) {
    // Page was open before the extension was installed — inject and retry.
    await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: ["shared.js", "content.js"] });
    await chrome.scripting.insertCSS({ target: { tabId: tab.id, allFrames: true }, files: ["content.css"] }).catch(() => {});
    return chrome.tabs.sendMessage(tab.id, msg);
  }
}

async function loadPage() {
  if (!tab || !/^https?:/.test(tab.url || "")) {
    $("save").disabled = $("autofill").disabled = true;
    return say("saveMsg", "Open a job posting or application form.", "");
  }
  let info = null;
  try {
    info = await talkToTab({ type: "extractJob" });
  } catch (_) {}
  const job = (info && info.job) || { url: JT.canonicalUrl(tab.url), title: tab.title || "", company: "" };
  $("title").value = job.title || "";
  $("company").value = job.company || "";
  $("location").value = job.location || "";
  $("status").value = info && info.confirmation ? "applied" : "saved";
  $("save").dataset.job = JSON.stringify(job);

  const found = await bg({ type: "findJob", url: job.url });
  if (found.ok && found.data) {
    savedJob = found.data;
    $("tracked").hidden = false;
    $("tracked").textContent = "Tracked · " + found.data.status;
    $("status").value = found.data.status;
    $("save").textContent = "Update job";
  }
}

$("saveUrl").onclick = async () => {
  $("saveUrl").disabled = true;
  const r = await bg({ type: "setAppUrl", appUrl: $("appUrl").value });
  $("saveUrl").disabled = false;
  if (!r.ok) return say("setupMsg", r.error, "err");
  init();
};

$("signIn").onclick = async () => {
  $("signIn").disabled = true;
  const r = await bg({ type: "signIn", email: $("email").value.trim(), password: $("password").value });
  $("signIn").disabled = false;
  if (!r.ok) return say("loginMsg", r.error, "err");
  init();
};
$("password").addEventListener("keydown", (e) => e.key === "Enter" && $("signIn").click());

$("googleSignIn").onclick = async () => {
  $("googleSignIn").disabled = true;
  const r = await bg({ type: "signInGoogle" });
  $("googleSignIn").disabled = false;
  if (!r.ok) return say("loginMsg", r.error, "err");
  init();
};

$("changeUrl").onclick = () => show("setup");

$("signOut").onclick = async () => {
  await bg({ type: "signOut" });
  init();
};

$("autoTrack").onchange = (e) => bg({ type: "setAutoTrack", value: e.target.checked });

$("save").onclick = async () => {
  const base = JSON.parse($("save").dataset.job || "{}");
  const job = {
    ...base,
    title: $("title").value.trim(),
    company: $("company").value.trim(),
    location: $("location").value.trim(),
    status: $("status").value,
  };
  $("save").disabled = true;
  const r = await bg({ type: "saveJob", job });
  $("save").disabled = false;
  if (!r.ok) return say("saveMsg", r.error, "err");
  savedJob = r.data;
  $("tracked").hidden = false;
  $("tracked").textContent = "Tracked · " + r.data.status;
  $("save").textContent = "Update job";
  say("saveMsg", r.data.created ? "Saved to your tracker ✓" : "Updated ✓", "ok");
};

$("tailor").onclick = async () => {
  if (!savedJob) {
    await $("save").onclick();
    if (!savedJob) return;
  }
  chrome.tabs.create({ url: state.appUrl + "/jobs/" + savedJob.id });
};

$("autofill").onclick = async () => {
  $("autofill").disabled = true;
  say("fillMsg", "Filling…");
  try {
    const r = await talkToTab({ type: "autofill" });
    say("fillMsg", r && r.filled != null ? `Filled ${r.filled} fields here. Green = filled, amber = needs you.` : "Done — see the page.", "ok");
  } catch (e) {
    say("fillMsg", "Couldn't reach this page: " + e.message, "err");
  }
  $("autofill").disabled = false;
};

init();
