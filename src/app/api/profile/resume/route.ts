import { extractText, getDocumentProxy } from "unpdf";
import { AIError, chatJSON } from "@/lib/server/ai";
import { json, preflight, requireUser } from "@/lib/server/auth";
import { aiPrefs } from "@/lib/server/user-keys";

export const OPTIONS = preflight;
export const maxDuration = 60;

const SYSTEM = `Split resume text into structured work experience. Copy the candidate's wording exactly; do not rewrite or invent anything.
Output JSON: { "experiences": [ { "company": string, "title": string, "location": string, "start_date": string, "end_date": string, "skills": string, "bullets": string[] } ] }
Most recent role first. Use "Present" for current roles. "skills" = comma-separated tools/skills mentioned for that role, or "". Ignore education, projects and certifications sections.`;

type Parsed = {
  company?: string;
  title?: string;
  location?: string;
  start_date?: string;
  end_date?: string;
  skills?: string;
  bullets?: string[];
};

/**
 * POST { replace?: boolean }
 * Reads the resume PDF you uploaded, saves its text for the AI, and fills
 * your Experience roles automatically. Existing roles are only replaced when
 * `replace` is true.
 */
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const { db, user } = auth;
  const { replace = false } = (await req.json().catch(() => ({}))) as { replace?: boolean };

  const { data: files } = await db.storage.from("resumes").list(user.id, { limit: 10 });
  const file = files?.find((f) => f.name !== ".emptyFolderPlaceholder");
  if (!file) return json({ error: "Upload your resume first." }, 400);
  if (!/\.pdf$/i.test(file.name)) return json({ error: "Automatic import reads PDF resumes. Upload a PDF version." }, 400);

  const { data: blob, error: dlErr } = await db.storage.from("resumes").download(`${user.id}/${file.name}`);
  if (dlErr || !blob) return json({ error: "Couldn't read the uploaded file." }, 500);

  let text = "";
  try {
    const pdf = await getDocumentProxy(new Uint8Array(await blob.arrayBuffer()));
    text = (await extractText(pdf, { mergePages: true })).text as unknown as string;
  } catch {
    return json({ error: "That PDF couldn't be read. Export it again from Google Docs, Word or Figma and re-upload." }, 400);
  }
  text = String(text).replace(/[ \t]+/g, " ").trim();
  if (text.length < 200) {
    return json({ error: "That PDF has almost no selectable text (it may be an image). Export it as a text PDF." }, 400);
  }

  await db.from("profiles").upsert({ user_id: user.id, resume_text: text.slice(0, 30000) }, { onConflict: "user_id" });

  const { count } = await db.from("experiences").select("id", { count: "exact", head: true });
  if ((count ?? 0) > 0 && !replace) return json({ saved: true, created: 0, existing: count });

  let parsed: Parsed[] = [];
  try {
    const r = await chatJSON<{ experiences: Parsed[] }>(SYSTEM, text.slice(0, 20000), { prefs: await aiPrefs(db, user) });
    parsed = r.data.experiences ?? [];
  } catch (e) {
    return json({ saved: true, error: e instanceof AIError ? e.message : "AI import failed." }, 502);
  }
  if (!parsed.length) return json({ saved: true, created: 0, error: "No work experience found in the resume." }, 200);

  if (replace) await db.from("experiences").delete().eq("user_id", user.id);
  const rows = parsed.map((e, i) => ({
    user_id: user.id,
    company: e.company ?? "",
    title: e.title ?? "",
    location: e.location ?? "",
    start_date: e.start_date ?? "",
    end_date: e.end_date ?? "",
    skills: e.skills ?? "",
    bullets: (e.bullets ?? []).join("\n"),
    sort: i,
  }));
  const { error } = await db.from("experiences").insert(rows);
  if (error) return json({ error: error.message }, 500);
  return json({ saved: true, created: rows.length });
}
