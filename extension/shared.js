// Shared helpers for content script, popup and background (plain JS, no build).
// Keep in sync with src/lib/job-url.ts in the web app.
(function (g) {
  function safeHost(url) {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch (_) {
      return "";
    }
  }

  function detectSource(url) {
    const h = safeHost(url);
    if (h.includes("linkedin.")) return "linkedin";
    if (h.includes("greenhouse.io")) return "greenhouse";
    if (h.includes("lever.co")) return "lever";
    if (h.includes("myworkdayjobs") || h.includes("workday")) return "workday";
    if (h.includes("ashbyhq")) return "ashby";
    if (h.includes("naukri")) return "naukri";
    if (h.includes("instahyre")) return "instahyre";
    if (h.includes("wellfound") || h.includes("angel.co")) return "wellfound";
    if (h.includes("smartrecruiters")) return "smartrecruiters";
    if (h.includes("indeed.")) return "indeed";
    return "other";
  }

  function canonicalUrl(raw) {
    let u;
    try {
      u = new URL(String(raw).trim());
    } catch (_) {
      return String(raw || "").trim();
    }
    const host = u.hostname.toLowerCase();
    if (host.includes("linkedin.")) {
      const id =
        u.searchParams.get("currentJobId") ||
        (u.pathname.match(/\/jobs\/view\/(?:[^/]*?-)?(\d{6,})/) || [])[1] ||
        (u.pathname.match(/(\d{8,})/) || [])[1];
      if (id) return "https://www.linkedin.com/jobs/view/" + id + "/";
    }
    if (host.includes("greenhouse.io")) {
      const gh = u.searchParams.get("gh_jid");
      const path = u.pathname.replace(/\/(confirmation|thanks)\/?$/, "").replace(/\/$/, "");
      return u.origin + path + (gh ? "?gh_jid=" + gh : "");
    }
    if (host.includes("lever.co")) {
      const m = u.pathname.match(/^\/([^/]+)\/([0-9a-f-]{36})/i);
      if (m) return u.origin + "/" + m[1] + "/" + m[2];
    }
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "ref", "refId", "trackingId", "trk", "src", "source", "lipi"].forEach(
      (p) => u.searchParams.delete(p),
    );
    u.hash = "";
    return u.toString().replace(/\/$/, "");
  }

  const STATUS_RANK = { saved: 0, applied: 1, interview: 2, offer: 3, rejected: 4, ghosted: 4 };

  g.JT = { detectSource, canonicalUrl, STATUS_RANK };
})(typeof self !== "undefined" ? self : window);
