import { canonicalUrl, detectSource } from "@/lib/job-url";
import { json, preflight, requireUser } from "@/lib/server/auth";
import { parseJobHtml } from "@/lib/server/parse-job";

export const OPTIONS = preflight;

/** POST { url } → best-effort title/company/location/description for a posting link. */
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

  const { url } = (await req.json().catch(() => ({}))) as { url?: string };
  if (!url || !/^https?:\/\//i.test(url)) return json({ error: "Send a valid http(s) url." }, 400);

  const canonical = canonicalUrl(url);
  const base = { url: canonical, source: detectSource(canonical) };

  try {
    const res = await fetch(canonical, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return json({ ...base, fetched: false, reason: `Site answered ${res.status}` });
    const html = (await res.text()).slice(0, 2_000_000);
    const parsed = parseJobHtml(html, canonical);
    const looksBlocked = !parsed.title || /sign in|log in|authwall|security verification/i.test(parsed.title);
    if (looksBlocked) return json({ ...base, fetched: false, reason: "The site needs a login to show details." });
    return json({ ...base, ...parsed, fetched: true });
  } catch (e) {
    return json({ ...base, fetched: false, reason: (e as Error).message });
  }
}
