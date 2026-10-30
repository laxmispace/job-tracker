import { AIError, TAILOR_SYSTEM, chatJSON } from "@/lib/server/ai";
import { json, preflight, requireUser } from "@/lib/server/auth";
import type { Experience, Tailored } from "@/lib/types";

export const OPTIONS = preflight;
export const maxDuration = 60;

/**
 * POST { jobId } or { description, title?, company? }
 * Rewrites your saved experience using the job description's keywords.
 * When jobId is given, the result is also saved on the job card.
 */
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const { db } = auth;

  const body = (await req.json().catch(() => ({}))) as {
    jobId?: string;
    description?: string;
    title?: string;
    company?: string;
  };

  let { description = "", title = "", company = "" } = body;
  if (body.jobId) {
    const { data: job, error } = await db.from("jobs").select("title,company,description").eq("id", body.jobId).single();
    if (error || !job) return json({ error: "Job not found." }, 404);
    description ||= job.description ?? "";
    title ||= job.title;
    company ||= job.company;
  }
  if (description.trim().length < 80) {
    return json({ error: "Add the job description to this card first (paste it in the Description box)." }, 400);
  }

  const { data: exps } = await db.from("experiences").select("*").order("sort");
  const experiences = (exps ?? []) as Experience[];
  if (!experiences.length || !experiences.some((e) => e.bullets.trim())) {
    return json({ error: "Add your work experience on the Experience page first." }, 400);
  }

  const { data: summaryRow } = await db.from("answers").select("answer").eq("key", "summary").maybeSingle();

  const prompt = `JOB: ${title} at ${company}

JOB DESCRIPTION:
${description.slice(0, 12000)}

CANDIDATE'S CURRENT SUMMARY:
${summaryRow?.answer || "(none)"}

CANDIDATE'S EXPERIENCE (JSON):
${JSON.stringify(
  experiences.map((e) => ({
    experience_id: e.id,
    company: e.company,
    title: e.title,
    dates: `${e.start_date ?? ""} – ${e.end_date ?? ""}`,
    skills: e.skills,
    bullets: e.bullets.split("\n").map((b) => b.replace(/^[-•*]\s*/, "").trim()).filter(Boolean),
  })),
)}`;

  try {
    const out = await chatJSON<Omit<Tailored, "generated_at">>(TAILOR_SYSTEM, prompt);
    const tailored: Tailored = {
      keywords: out.keywords ?? [],
      missing_keywords: out.missing_keywords ?? [],
      summary: out.summary ?? "",
      experiences: (out.experiences ?? []).map((x) => ({ ...x, bullets: x.bullets ?? [] })),
      generated_at: new Date().toISOString(),
    };
    if (body.jobId) await db.from("jobs").update({ tailored }).eq("id", body.jobId);
    return json({ tailored });
  } catch (e) {
    return json({ error: e instanceof AIError ? e.message : `AI request failed: ${(e as Error).message}` }, 502);
  }
}
