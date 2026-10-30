import { AIError, chatJSON } from "@/lib/server/ai";
import { json, preflight, requireUser } from "@/lib/server/auth";

export const OPTIONS = preflight;
export const maxDuration = 60;

const SYSTEM = `Split pasted resume text into structured work experience. Copy the candidate's wording exactly; do not rewrite or invent anything.
Output JSON: { "experiences": [ { "company": string, "title": string, "location": string, "start_date": string, "end_date": string, "skills": string, "bullets": string[] } ] }
Most recent role first. Use "Present" for current roles. "skills" = comma-separated tools/skills mentioned for that role, or "".`;

/** POST { text } → experiences parsed from pasted resume text (not saved). */
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  if (!text || text.trim().length < 80) return json({ error: "Paste your resume's experience section." }, 400);
  try {
    const out = await chatJSON<{ experiences: unknown[] }>(SYSTEM, text.slice(0, 20000));
    return json({ experiences: out.experiences ?? [] });
  } catch (e) {
    return json({ error: e instanceof AIError ? e.message : `AI request failed: ${(e as Error).message}` }, 502);
  }
}
