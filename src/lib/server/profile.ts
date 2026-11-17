import type { SupabaseClient } from "@supabase/supabase-js";
import { htmlToText } from "./parse-job";

export type Profile = {
  user_id: string;
  track: string;
  portfolio_url: string | null;
  portfolio_text: string | null;
  portfolio_pages: { url: string; title: string }[] | null;
  portfolio_fetched_at: string | null;
  resume_text: string | null;
};


export async function loadProfile(db: SupabaseClient): Promise<Profile | null> {
  const { data } = await db.from("profiles").select("*").maybeSingle();
  return (data as Profile) ?? null;
}

/** Extra context every AI task gets: career track, portfolio and resume text. */
export function profileContext(p: Profile | null) {
  if (!p) return "";
  const parts: string[] = [];
  if (p.portfolio_text?.trim()) {
    parts.push(`PORTFOLIO (${p.portfolio_url}) — real projects and case studies; cite them by name where relevant:\n${p.portfolio_text.slice(0, 7000)}`);
  }
  if (p.resume_text?.trim()) parts.push(`RESUME TEXT:\n${p.resume_text.slice(0, 5000)}`);
  return parts.join("\n\n");
}

// ─────────────────────────── portfolio reader ───────────────────────────

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

async function getPage(url: string) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html" },
    redirect: "follow",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  const html = (await res.text()).slice(0, 1_500_000);
  const title = htmlToText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim();
  return { html, title, finalUrl: res.url || url };
}

/** Same-site links, case-study-looking pages first. */
function caseStudyLinks(html: string, base: string, limit: number) {
  const origin = new URL(base).origin;
  const seen = new Set<string>([new URL(base).href.replace(/#.*$/, "").replace(/\/$/, "")]);
  const links: string[] = [];
  for (const m of html.matchAll(/<a[^>]+href=["']([^"'#]+)["']/gi)) {
    let u: URL;
    try {
      u = new URL(m[1], base);
    } catch {
      continue;
    }
    if (u.origin !== origin) continue;
    if (/\.(pdf|png|jpe?g|gif|svg|webp|mp4|zip|css|js|ico|xml)$/i.test(u.pathname)) continue;
    if (/(login|signin|privacy|terms|cookie|cart|tag|category|feed)/i.test(u.pathname)) continue;
    const key = u.href.replace(/#.*$/, "").replace(/\/$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    links.push(key);
  }
  const score = (u: string) => (/(work|case|project|portfolio|stud|design|product|about)/i.test(u) ? 0 : 1);
  return links.sort((a, b) => score(a) - score(b)).slice(0, limit);
}

/** Reads the portfolio home page plus up to 8 case-study pages on the same site. */
export async function readPortfolio(url: string) {
  const home = await getPage(url);
  const pages = [{ url: home.finalUrl, title: home.title || "Home", text: htmlToText(home.html) }];
  const links = caseStudyLinks(home.html, home.finalUrl, 8);
  const results = await Promise.allSettled(links.map((l) => getPage(l)));
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      const text = htmlToText(r.value.html);
      if (text.length > 200) pages.push({ url: links[i], title: r.value.title || links[i], text });
    }
  });
  let budget = 24_000;
  const text = pages
    .map((p) => {
      const chunk = `## ${p.title} (${p.url})\n${p.text.slice(0, Math.max(0, Math.min(5000, budget)))}`;
      budget -= chunk.length;
      return budget > -5000 ? chunk : "";
    })
    .filter(Boolean)
    .join("\n\n");
  return {
    text,
    pages: pages.map((p) => ({ url: p.url, title: p.title })),
    thin: text.length < 600, // likely a JS-only site we couldn't read
  };
}
