// Helpers to normalise job links so the same posting is never saved twice.
// Keep in sync with extension/shared.js (same logic, plain JS).

export function detectSource(url: string): string {
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

function safeHost(url: string) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/** Canonical form of a job URL (drops tracking params, resolves LinkedIn ids). */
export function canonicalUrl(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return raw.trim();
  }
  const host = u.hostname.toLowerCase();
  if (host.includes("linkedin.")) {
    const id =
      u.searchParams.get("currentJobId") ||
      u.pathname.match(/\/jobs\/view\/(?:[^/]*?-)?(\d{6,})/)?.[1] ||
      u.pathname.match(/(\d{8,})/)?.[1];
    if (id) return `https://www.linkedin.com/jobs/view/${id}/`;
  }
  if (host.includes("greenhouse.io")) {
    const gh = u.searchParams.get("gh_jid");
    const keep = gh ? `?gh_jid=${gh}` : "";
    const path = u.pathname.replace(/\/(confirmation|thanks)\/?$/, "").replace(/\/$/, "");
    return `${u.origin}${path}${keep}`;
  }
  if (host.includes("lever.co")) {
    // jobs.lever.co/company/<uuid>[/apply|/thanks]
    const m = u.pathname.match(/^\/([^/]+)\/([0-9a-f-]{36})/i);
    if (m) return `${u.origin}/${m[1]}/${m[2]}`;
  }
  const drop = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "ref", "refId", "trackingId", "trk", "src", "source", "lipi"];
  drop.forEach((p) => u.searchParams.delete(p));
  u.hash = "";
  return u.toString().replace(/\/$/, "");
}

/** Pulls the first http(s) link out of shared text (e.g. LinkedIn share sheet). */
export function extractUrl(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = text.match(/https?:\/\/[^\s<>"')]+/i);
  return m ? m[0] : null;
}
