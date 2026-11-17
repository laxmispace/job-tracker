import { json, preflight, requireUser } from "@/lib/server/auth";
import { readPortfolio } from "@/lib/server/profile";

export const OPTIONS = preflight;
export const maxDuration = 60;

/** POST { url } → reads your portfolio site and saves its text for the AI to reference. */
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const { db, user } = auth;

  let { url } = (await req.json().catch(() => ({}))) as { url?: string };
  url = (url ?? "").trim();
  if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
  if (!url) {
    await db.from("profiles").upsert({ user_id: user.id, portfolio_url: "", portfolio_text: "", portfolio_pages: [] }, { onConflict: "user_id" });
    return json({ pages: [], chars: 0 });
  }

  try {
    const r = await readPortfolio(url);
    const { error } = await db.from("profiles").upsert(
      {
        user_id: user.id,
        portfolio_url: url,
        portfolio_text: r.text,
        portfolio_pages: r.pages,
        portfolio_fetched_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) return json({ error: error.message }, 500);
    return json({ pages: r.pages, chars: r.text.length, thin: r.thin });
  } catch (e) {
    return json({ error: `Couldn't open ${url} (${(e as Error).message}). Check the link is public.` }, 502);
  }
}
