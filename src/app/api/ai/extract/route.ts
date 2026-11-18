import { AIError, EXTRACT_SYSTEM, chatJSON } from "@/lib/server/ai";
import { json, preflight, requireUser } from "@/lib/server/auth";
import { aiPrefs } from "@/lib/server/user-keys";

export const OPTIONS = preflight;
export const maxDuration = 60;

/** POST { text } → { title, company, location, salary, description } from pasted posting text. */
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  if (!text || text.trim().length < 40) return json({ error: "Paste more of the job posting text." }, 400);

  try {
    const r = await chatJSON<Record<string, string>>(EXTRACT_SYSTEM, text.slice(0, 20000), { prefs: await aiPrefs(auth.db, auth.user) });
    return json(r.data);
  } catch (e) {
    return json({ error: e instanceof AIError ? e.message : `AI request failed: ${(e as Error).message}` }, 502);
  }
}
