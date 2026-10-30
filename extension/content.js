// Content script: reads job details, fills application forms and notices
// when an application has been submitted. Runs in every frame.
(function () {
  if (window.__jobTrackerLoaded) return;
  window.__jobTrackerLoaded = true;

  const IS_TOP = window === window.top;
  const send = (msg) =>
    new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(msg, (res) => {
          if (chrome.runtime.lastError) return resolve({ ok: false, error: chrome.runtime.lastError.message });
          resolve(res || { ok: false, error: "No response" });
        });
      } catch (e) {
        resolve({ ok: false, error: "Extension was reloaded — refresh this page." });
      }
    });

  const norm = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/[_\-]+/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[^a-z0-9+ ]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const text = (el) => (el ? (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim() : "");
  const q = (sel, root = document) => {
    for (const s of sel.split("||")) {
      const el = root.querySelector(s.trim());
      if (el && text(el)) return el;
    }
    return null;
  };

  // ─────────────────────────── job extraction ───────────────────────────
  function fromJsonLd() {
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const stack = [JSON.parse(s.textContent)];
        while (stack.length) {
          const n = stack.pop();
          if (!n || typeof n !== "object") continue;
          if (Array.isArray(n)) {
            stack.push(...n);
            continue;
          }
          const t = n["@type"];
          if (t === "JobPosting" || (Array.isArray(t) && t.includes("JobPosting"))) {
            const org = n.hiringOrganization;
            const locs = [].concat(n.jobLocation || []);
            const loc = locs
              .map((l) => l && l.address && [l.address.addressLocality, l.address.addressRegion].filter(Boolean).join(", "))
              .filter(Boolean)
              .join(" / ");
            const div = document.createElement("div");
            div.innerHTML = String(n.description || "");
            return {
              title: n.title || "",
              company: (org && (org.name || org)) || "",
              location: loc || (n.jobLocationType === "TELECOMMUTE" ? "Remote" : ""),
              description: text(div),
            };
          }
          if (n["@graph"]) stack.push(n["@graph"]);
        }
      } catch (_) {}
    }
    return null;
  }

  function linkedinJob() {
    const scope = document.querySelector(".jobs-search__job-details--container, .jobs-details, .job-view-layout, main") || document;
    const title = q(
      ".job-details-jobs-unified-top-card__job-title h1 || .job-details-jobs-unified-top-card__job-title || .jobs-unified-top-card__job-title || .top-card-layout__title || h1",
      scope,
    );
    const company = q(
      ".job-details-jobs-unified-top-card__company-name a || .job-details-jobs-unified-top-card__company-name || .jobs-unified-top-card__company-name || .topcard__org-name-link || .topcard__flavor",
      scope,
    );
    const loc = q(
      ".job-details-jobs-unified-top-card__primary-description-container .tvm__text || .job-details-jobs-unified-top-card__bullet || .jobs-unified-top-card__bullet || .topcard__flavor--bullet",
      scope,
    );
    const desc = q("#job-details || .jobs-description__content || .jobs-box__html-content || .show-more-less-html__markup", scope);
    // Fallback: document.title is "Role | Company | LinkedIn"
    const parts = document.title.replace(/^\(\d+\)\s*/, "").split(" | ");
    return {
      title: text(title) || (parts.length >= 3 ? parts[0] : ""),
      company: text(company) || (parts.length >= 3 ? parts[1] : ""),
      location: text(loc),
      description: text(desc),
    };
  }

  function genericJob() {
    const og = (p) => (document.querySelector(`meta[property="${p}"], meta[name="${p}"]`) || {}).content || "";
    const h1 = q(".posting-headline h2 || .app-title || .job__title h1 || [data-automation-id='jobPostingHeader'] || h1");
    const company =
      text(q(".company-name || .main-header-logo img || [data-automation-id='company']")) ||
      og("og:site_name") ||
      "";
    const main = document.querySelector(
      "[data-automation-id='jobPostingDescription'], .posting-page, .job__description, #content, main, article",
    );
    return {
      title: text(h1) || og("og:title") || document.title.split(/ [|\-–] /)[0],
      company: company.replace(/\s*careers?$/i, ""),
      location: text(q(".location || .posting-categories .location || [data-automation-id='locations']")),
      description: text(main).slice(0, 15000),
    };
  }

  function extractJob() {
    const url = JT.canonicalUrl(location.href);
    const isLinkedIn = location.hostname.includes("linkedin.");
    let job = isLinkedIn ? linkedinJob() : fromJsonLd() || genericJob();
    if (!isLinkedIn) {
      const g = genericJob();
      job = { ...g, ...Object.fromEntries(Object.entries(job).filter(([, v]) => v)) };
    }
    return { url, source: JT.detectSource(url), ...job, description: (job.description || "").slice(0, 15000) };
  }

  const looksLikeJobPage = () =>
    /linkedin\.[^/]+\/jobs/.test(location.href) ||
    /greenhouse\.io|lever\.co|myworkdayjobs|ashbyhq|smartrecruiters|naukri\.com\/job|instahyre|wellfound/.test(location.href) ||
    Boolean(fromJsonLd());

  // Remember the job this tab is showing (used to link external apply tabs back).
  let lastReported = "";
  let lastSeen = "";
  function reportPageJob() {
    if (!IS_TOP) return;
    const seen = location.href + "|" + document.title;
    if (seen === lastSeen) return; // nothing changed — skip the expensive read
    lastSeen = seen;
    if (!looksLikeJobPage()) return;
    const job = extractJob();
    const sig = job.url + job.title;
    if (!job.title || sig === lastReported) return;
    lastReported = sig;
    send({ type: "pageJob", job });
  }

  // ───────────────────────────── autofill ─────────────────────────────
  function visible(el) {
    if (el.disabled || el.readOnly) return false;
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    return (r.width > 0 || r.height > 0) && st.visibility !== "hidden" && st.display !== "none";
  }

  function labelFor(el) {
    const bits = [];
    if (el.labels && el.labels.length) bits.push(...[...el.labels].map(text));
    const lb = el.getAttribute("aria-labelledby");
    if (lb) bits.push(lb.split(/\s+/).map((id) => text(document.getElementById(id))).join(" "));
    if (el.getAttribute("aria-label")) bits.push(el.getAttribute("aria-label"));
    if (!bits.join("").trim()) {
      const wrap = el.closest("label");
      if (wrap) bits.push(text(wrap));
    }
    if (!bits.join("").trim()) {
      // Walk up a few levels and take the first short label-ish text (Lever, Workday, custom forms)
      let p = el.parentElement;
      for (let i = 0; i < 4 && p && !bits.join("").trim(); i++, p = p.parentElement) {
        const cand = p.querySelector("label, legend, .application-label, [data-automation-id*='formLabel'], .field-label, .label, h3, h4");
        if (cand && !cand.contains(el) && text(cand).length < 200) bits.push(text(cand));
      }
    }
    return bits.join(" ").trim();
  }

  function groupLabel(radio) {
    const fs = radio.closest("fieldset");
    if (fs) {
      const lg = fs.querySelector("legend");
      if (lg) return text(lg);
    }
    const rg = radio.closest("[role=radiogroup]");
    if (rg) {
      const id = rg.getAttribute("aria-labelledby");
      if (id) return text(document.getElementById(id));
      if (rg.getAttribute("aria-label")) return rg.getAttribute("aria-label");
    }
    let p = radio.parentElement;
    for (let i = 0; i < 5 && p; i++, p = p.parentElement) {
      const cand = p.querySelector("label:not(:has(input)), .application-label, legend, [class*='label'], [class*='question']");
      if (cand && !cand.contains(radio) && text(cand).length < 250) return text(cand);
    }
    return radio.name || "";
  }

  const STOP = new Set("a an the your you of to in for and or is are do does did have has what which please enter provide this".split(" "));

  // Questions about someone else (referrer, emergency contact, manager…) must not get *your* details.
  const IDENTITY = new Set(["full_name", "first_name", "last_name", "preferred_name", "email", "phone", "current_company", "current_title"]);
  const OTHER_PERSON = / (referr\w*|reference|emergency|guardian|father|mother|spouse|manager|supervisor|recruiter) /;

  function matchAnswer(labelText, answers) {
    const L = " " + norm(labelText) + " ";
    if (!L.trim()) return null;
    const aboutSomeoneElse = OTHER_PERSON.test(L);
    let best = null;
    let bestScore = 0;
    for (const a of answers) {
      if (aboutSomeoneElse && IDENTITY.has(a.key)) continue;
      let score = 0;
      for (const alias of [a.question, ...(a.aliases || [])]) {
        const n = norm(alias);
        if (n && L.includes(" " + n + " ")) score = Math.max(score, 50 + n.length);
      }
      if (!score) {
        const qt = norm(a.question).split(" ").filter((w) => w.length > 2 && !STOP.has(w));
        if (qt.length >= 2) {
          const hit = qt.filter((w) => L.includes(" " + w + " ")).length / qt.length;
          if (hit >= 0.75) score = 30 * hit;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        best = a;
      }
    }
    return best;
  }

  function setNativeValue(el, value) {
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
    el.focus();
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  function pickOption(options, answer) {
    const A = norm(answer);
    if (!A) return null;
    let best = null;
    let bestScore = 0;
    for (const o of options) {
      const T = norm(o.label);
      if (!T || /^(select|choose|please select|\-+)/.test(T)) continue;
      let s = 0;
      if (T === A) s = 100;
      else if (T.startsWith(A) || A.startsWith(T)) s = 70;
      else if (T.includes(A) || A.includes(T)) s = 50;
      else {
        const aw = A.split(" ");
        s = (aw.filter((w) => T.split(" ").includes(w)).length / aw.length) * 40;
      }
      if (s > bestScore) {
        bestScore = s;
        best = o;
      }
    }
    return bestScore >= 30 ? best : null;
  }

  function mark(el, kind) {
    el.classList.remove("jt-filled", "jt-review");
    el.classList.add(kind === "filled" ? "jt-filled" : "jt-review");
  }

  function fileToInput(input, resume) {
    const bytes = Uint8Array.from(atob(resume.base64), (c) => c.charCodeAt(0));
    const file = new File([bytes], resume.name, { type: resume.type });
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function autofill() {
    const res = await send({ type: "answers", force: true });
    if (!res.ok) return toast(res.error, "error");
    const answers = res.data || [];
    if (!answers.length) return IS_TOP && toast("Your answers bank is empty — fill it in the tracker first.", "error");

    let filled = 0;
    const review = [];

    // Text inputs, textareas, selects
    const fields = [...document.querySelectorAll("input, textarea, select")].filter((el) => {
      const t = (el.type || "").toLowerCase();
      if (["hidden", "submit", "button", "reset", "image", "password", "checkbox", "radio", "file", "search"].includes(t)) return false;
      return visible(el);
    });

    for (const el of fields) {
      const label = labelFor(el);
      const hint = [label, el.placeholder, el.name, el.id, el.getAttribute("autocomplete")].filter(Boolean).join(" ");
      let a = matchAnswer(label, answers) || matchAnswer(hint, answers);
      if (!a && el.type === "email") a = answers.find((x) => x.key === "email");
      if (!a && el.type === "tel") a = answers.find((x) => x.key === "phone");

      if (el.tagName === "SELECT") {
        if (el.value && el.selectedIndex > 0) continue;
        if (!a) {
          if (el.required) (mark(el, "review"), review.push(label));
          continue;
        }
        const opt = pickOption([...el.options].map((o) => ({ label: o.text, value: o.value, o })), a.answer);
        if (opt) {
          el.value = opt.value;
          el.dispatchEvent(new Event("change", { bubbles: true }));
          mark(el, "filled");
          filled++;
        } else {
          mark(el, "review");
          review.push(label);
        }
        continue;
      }

      if (el.value && el.value.trim()) continue; // never overwrite what's there
      if (a) {
        setNativeValue(el, a.answer);
        mark(el, "filled");
        filled++;
        if (el.tagName === "TEXTAREA" || a.long_form) addAiButton(el, label, a.answer);
      } else if (el.tagName === "TEXTAREA" || el.required || el.getAttribute("aria-required") === "true") {
        mark(el, "review");
        review.push(label);
        if (el.tagName === "TEXTAREA" || label.length > 25) addAiButton(el, label, "");
      }
    }

    // Radio groups (Yes/No questions, EEO)
    const groups = {};
    document.querySelectorAll("input[type=radio]").forEach((r) => {
      if (!visible(r) && !visible(r.parentElement || r)) return;
      const key = r.name || groupLabel(r);
      (groups[key] = groups[key] || []).push(r);
    });
    for (const radios of Object.values(groups)) {
      if (radios.some((r) => r.checked)) continue;
      const label = groupLabel(radios[0]);
      const a = matchAnswer(label, answers);
      if (!a) continue;
      const opt = pickOption(radios.map((r) => ({ label: labelFor(r) || r.value, r })), a.answer);
      if (opt) {
        opt.r.click();
        filled++;
      }
    }

    // Resume upload
    const fileInputs = [...document.querySelectorAll("input[type=file]")].filter((f) =>
      /resume|cv|curriculum/i.test(labelFor(f) + " " + f.name + " " + f.id + " " + (f.getAttribute("data-automation-id") || "")),
    );
    if (fileInputs.length && !fileInputs.every((f) => f.files && f.files.length)) {
      const r = await send({ type: "resume" });
      if (r.ok && r.data) {
        fileInputs.forEach((f) => {
          if (!(f.files && f.files.length)) {
            try {
              fileToInput(f, r.data);
              filled++;
            } catch (_) {}
          }
        });
      }
    }

    if (filled || review.length || IS_TOP) {
      toast(
        `Filled ${filled} field${filled === 1 ? "" : "s"}` +
          (review.length ? ` · ${review.length} need you (amber)` : "") +
          ". Check everything before submitting.",
        filled ? "ok" : "info",
      );
    }
    return { filled, review: review.length };
  }

  // ✨ button next to long questions → AI drafts an answer for this job
  function addAiButton(el, question, baseAnswer) {
    if (el.dataset.jtAi) return;
    el.dataset.jtAi = "1";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "jt-ai-btn";
    btn.textContent = baseAnswer ? "✨ Tailor to this job" : "✨ Draft with AI";
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      btn.disabled = true;
      btn.textContent = "Writing…";
      const job = extractJob();
      const r = await send({
        type: "aiAnswer",
        payload: {
          question: question || el.placeholder || "Tell us about yourself",
          url: job.url,
          pageContext: [job.title, job.company, job.description].filter(Boolean).join("\n").slice(0, 8000),
          baseAnswer: el.value || baseAnswer || "",
        },
      });
      btn.disabled = false;
      if (r.ok) {
        setNativeValue(el, r.data.answer);
        mark(el, "filled");
        btn.textContent = "↻ Regenerate";
      } else {
        btn.textContent = "✨ Retry";
        toast(r.error, "error");
      }
    });
    el.insertAdjacentElement("afterend", btn);
  }

  // ─────────────────────────── submit detection ───────────────────────────
  const ARM_KEY = "__jt_armed";
  const SUBMIT_RE = /\b(submit|apply|send application|finish|complete application|send)\b/i;
  const DONE_RE =
    /(your application (was|has been) (sent|submitted|received))|(application (sent|submitted|received)( successfully)?)|(thank(s| you) for (applying|your application|submitting))|(we('ve| have) received your application)|(successfully (applied|submitted))/i;
  const DONE_URL_RE = /\/(confirmation|thanks|thank-you|thankyou|application-submitted|submitted|success)(\/|\?|$)/i;

  const arm = () => {
    try {
      sessionStorage.setItem(ARM_KEY, String(Date.now()));
    } catch (_) {}
  };
  const armed = () => {
    try {
      return Date.now() - Number(sessionStorage.getItem(ARM_KEY) || 0) < 15 * 60 * 1000;
    } catch (_) {
      return false;
    }
  };

  document.addEventListener(
    "click",
    (e) => {
      const b = e.target.closest && e.target.closest("button, input[type=submit], [role=button], a");
      if (b && SUBMIT_RE.test(text(b) || b.value || b.getAttribute("aria-label") || "")) arm();
    },
    true,
  );
  document.addEventListener("submit", arm, true);

  let reported = false;
  function checkSubmitted() {
    if (reported) return;
    const onLinkedIn = location.hostname.includes("linkedin.");
    if (!onLinkedIn && !armed()) return;
    // On LinkedIn only look at dialogs/toasts (the "Application sent" modal) to avoid false hits.
    const body = onLinkedIn
      ? [...document.querySelectorAll("[role=dialog], .artdeco-modal, .artdeco-toast-item, [role=alert]")].map(text).join(" ")
      : text(document.body).slice(0, 20000);
    const hit = DONE_RE.test(body) || (!onLinkedIn && DONE_URL_RE.test(location.pathname));
    if (!hit) return;
    reported = true;
    try {
      sessionStorage.removeItem(ARM_KEY);
    } catch (_) {}
    const job = extractJob();
    send({ type: "applied", job }).then((r) => {
      if (r.ok && r.data && r.data.job) {
        const j = r.data.job;
        toast(`${j.unchanged ? "Already tracked" : "Added to Job Tracker"}: ${j.title || "job"}${j.company ? " · " + j.company : ""}`, "ok");
      } else if (r.ok && r.data && r.data.skipped) {
        // auto-track disabled: stay quiet
      } else if (!r.ok) {
        toast("Couldn't save this application: " + r.error, "error");
      }
    });
    // LinkedIn is a single-page app: allow the next application to be detected too.
    if (onLinkedIn) setTimeout(() => (reported = false), 20000);
  }

  let timer = null;
  const observer = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      checkSubmitted();
      reportPageJob();
    }, 900);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => {
    checkSubmitted();
    reportPageJob();
  }, 1500);

  // ───────────────────────────── toast UI ─────────────────────────────
  function toast(msg, tone = "info") {
    if (!document.body) return;
    let box = document.getElementById("jt-toast");
    if (!box) {
      box = document.createElement("div");
      box.id = "jt-toast";
      document.body.appendChild(box);
    }
    box.className = "jt-toast jt-" + tone;
    box.textContent = msg;
    box.style.opacity = "1";
    clearTimeout(box._t);
    box._t = setTimeout(() => (box.style.opacity = "0"), 5000);
  }

  // ─────────────────────────── messages from popup ───────────────────────────
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "extractJob") {
      if (!IS_TOP) return false;
      sendResponse({ job: extractJob(), confirmation: DONE_RE.test(text(document.body).slice(0, 20000)) });
      return false;
    }
    if (msg.type === "autofill") {
      autofill().then((r) => IS_TOP && sendResponse(r || {}));
      return IS_TOP;
    }
    return false;
  });
})();
