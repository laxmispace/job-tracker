// One small client for any OpenAI-compatible chat API.
// Pick a provider with env vars (see README → "AI setup").

type Provider = { baseUrl: string; model: string };

const PROVIDERS: Record<string, Provider> = {
  gemini: { baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-3.8-flash" },
  deepseek: { baseUrl: "https://api.deepseek.com", model: "deepseek-flash" },
  qwen: { baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1", model: "qwen-plus" },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1", model: "" },
  groq: { baseUrl: "https://api.groq.com/openai/v1", model: "" },
  ollama: { baseUrl: "http://localhost:11434/v1", model: "qwen3:8b" },
};

export function aiConfig() {
  const name = (process.env.AI_PROVIDER || "gemini").toLowerCase();
  const preset = PROVIDERS[name] ?? { baseUrl: "", model: "" };
  return {
    name,
    baseUrl: (process.env.AI_BASE_URL || preset.baseUrl).replace(/\/$/, ""),
    model: process.env.AI_MODEL || preset.model,
    apiKey: process.env.AI_API_KEY || "",
  };
}

export class AIError extends Error {}

export async function chat(system: string, user: string, opts: { temperature?: number } = {}) {
  const cfg = aiConfig();
  if (!cfg.baseUrl) throw new AIError(`Unknown AI_PROVIDER "${cfg.name}". Set AI_BASE_URL.`);
  if (!cfg.model) throw new AIError(`Set AI_MODEL for provider "${cfg.name}".`);
  if (!cfg.apiKey && cfg.name !== "ollama") throw new AIError("AI_API_KEY is not set.");

  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: cfg.model,
      temperature: opts.temperature ?? 0.4,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message || body?.[0]?.error?.message || res.statusText;
    throw new AIError(`${cfg.name} error (${res.status}): ${msg}`);
  }
  const text: string = body?.choices?.[0]?.message?.content ?? "";
  // Some reasoning models wrap their thinking in <think> tags — drop it.
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

/** Asks for JSON and parses it, tolerating ```json fences and stray prose. */
export async function chatJSON<T>(system: string, user: string): Promise<T> {
  const raw = await chat(system + "\n\nRespond with a single JSON object only. No markdown, no commentary.", user, {
    temperature: 0.3,
  });
  const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new AIError("The model did not return JSON. Try again.");
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  } catch {
    throw new AIError("Could not read the model's JSON. Try again or switch model.");
  }
}

// ─────────────────────────── prompts ───────────────────────────

export const TAILOR_SYSTEM = `You are an expert resume writer and ATS keyword strategist.
You rewrite a candidate's real work experience so it matches a specific job description.

Hard rules:
- Never invent employers, titles, dates, tools, metrics or achievements. Only rephrase, reorder, merge or trim what is given.
- Weave in the job description's exact keywords and phrasing wherever the candidate's experience truthfully supports them (e.g. if JD says "stakeholder management" and the bullet describes working with stakeholders, use that phrase).
- Lead each bullet with a strong action verb; keep each bullet under 30 words; keep any numbers exactly as given.
- Put the most relevant bullets first. Drop bullets that are irrelevant to this job if a role has more than 6.
- Use Indian/US neutral professional English, no first person, no buzzword stuffing.

Output JSON shape:
{
  "keywords": string[],          // top 12-20 keywords/skills from the JD, most important first
  "missing_keywords": string[],  // JD keywords the candidate's experience does NOT support (be honest)
  "summary": string,             // 2-3 sentence professional summary targeted at this job
  "experiences": [ { "experience_id": string, "company": string, "title": string, "bullets": string[] } ]
}`;

export const ANSWER_SYSTEM = `You help a job candidate answer application form questions.
Write in first person, warm but professional, specific to the company and role when a job description is given.
Use only facts from the candidate's profile and experience. Never invent facts. If a base answer is provided, adapt it rather than starting over.
Keep it concise: 60-150 words unless the question clearly needs a one-line answer (then answer in one line).
Return plain text only.`;

export const EXTRACT_SYSTEM = `Extract job posting details from raw text copied from a job site.
Output JSON: { "title": string, "company": string, "location": string, "salary": string, "description": string }
"description" should be the cleaned job description (responsibilities + requirements), max 6000 characters. Use "" for unknown fields.`;
