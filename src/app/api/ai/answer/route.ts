import { canonicalUrl } from "@/lib/job-url";
import { AIError, ANSWER_SYSTEM, chat } from "@/lib/server/ai";
import { json, preflight, requireUser } from "@/lib/server/auth";
import { aiPrefs } from "@/lib/server/user-keys";
import { loadProfile, profileContext } from "@/lib/server/profile";
import type { Answer, Experience, Tailored } from "@/lib/types";

export const OPTIONS = preflight;
export const maxDuration = 60;

/**
 * POST { question, jobId?, url?, pageContext?, baseAnswer? }
 * Drafts an answer to an application question using your profile, your
 * experience and (when known) the job description.
 */
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const { db, user } = auth;

  const body = (await req.json().catch(() => ({}))) as {
    question?: string;
    jobId?: string;
    url?: string;
    pageContext?: string;
    baseAnswer?: string;
  };
  const question = (body.question ?? "").trim();
  if (!question) return json({ error: "Missing question." }, 400);

  let job: { title: string; company: string; description: string | null; tailored: Tailored | null } | null = null;
  if (body.jobId) {
    job = (await db.from("jobs").select("title,company,description,tailored").eq("id", body.jobId).maybeSingle()).data;
  } else if (body.url) {
    job = (await db.from("jobs").select("title,company,description,tailored").eq("url", canonicalUrl(body.url)).maybeSingle()).data;
  }

  const [{ data: answers }, { data: exps }, me] = await Promise.all([
    db.from("answers").select("question,answer,long_form").neq("answer", ""),
    db.from("experiences").select("company,title,start_date,end_date,bullets,skills").order("sort"),
    loadProfile(db),
  ]);

  const profile = ((answers ?? []) as Pick<Answer, "question" | "answer" | "long_form">[])
    .map((a) => `- ${a.question}: ${a.answer}`)
    .join("\n")
    .slice(0, 8000);
  const experience = ((exps ?? []) as Experience[])
    .map((e) => `${e.title} @ ${e.company} (${e.start_date} – ${e.end_date})\n${e.bullets}`)
    .join("\n\n")
    .slice(0, 8000);

  const prompt = `QUESTION ON THE FORM: ${question}
${body.baseAnswer ? `\nMY BASE ANSWER TO ADAPT:\n${body.baseAnswer}\n` : ""}
JOB: ${job ? `${job.title} at ${job.company}` : "(unknown)"}
JOB DESCRIPTION:
${(job?.description || body.pageContext || "(not available)").slice(0, 8000)}

${
  job?.tailored
    ? `ALREADY PREPARED FOR THIS JOB (stay consistent with it):\nSummary: ${job.tailored.summary}\nKeywords: ${job.tailored.keywords.join(", ")}\n`
    : ""
}
${profileContext(me)}

MY PROFILE ANSWERS:
${profile || "(none)"}

MY EXPERIENCE:
${experience || "(none)"}`;

  try {
    const r = await chat(ANSWER_SYSTEM, prompt, { temperature: 0.5, prefs: await aiPrefs(db, user) });
    return json({ answer: r.data, provider: r.label, model: r.model });
  } catch (e) {
    return json({ error: e instanceof AIError ? e.message : `AI request failed: ${(e as Error).message}` }, 502);
  }
}
