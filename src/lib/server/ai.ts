// Multi-provider AI client. Every provider speaks the OpenAI chat API.
//
// Add a key per provider as server env vars (Vercel → Settings → Environment
// Variables). Which one is used is chosen per user on the Settings page and
// stored in the Supabase user's metadata, so you can switch any time without
// redeploying. If the chosen provider fails (rate limit, quota, outage) the
// next configured provider is tried automatically, unless you turn that off.
//
//   GEMINI_API_KEY      DEEPSEEK_API_KEY     QWEN_API_KEY
//   OPENROUTER_API_KEY  GROQ_API_KEY         OLLAMA_BASE_URL (local only)
//   CUSTOM_BASE_URL + CUSTOM_API_KEY + CUSTOM_MODEL (+ CUSTOM_NAME)
//
// Optional per provider: <ID>_MODEL (default model) and <ID>_BASE_URL.

import type { User } from "@supabase/supabase-js";

export const PROVIDER_IDS = ["gemini", "deepseek", "qwen", "openrouter", "groq", "xai", "ollama", "custom"] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

type Preset = {
  id: ProviderId;
  label: string;
  baseUrl: string;
  defaultModel: string;
  note: string;
  signup: string;
  needsKey: boolean;
};

const PRESETS: Record<ProviderId, Preset> = {
  gemini: {
    id: "gemini",
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-3.8-flash",
    note: "Free tier with daily limits",
    signup: "https://aistudio.google.com/apikey",
    needsKey: true,
  },
  deepseek: {
    id: "deepseek",
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    defaultModel: "deepseek-flash",
    note: "Pay-as-you-go, very cheap",
    signup: "https://platform.deepseek.com/api_keys",
    needsKey: true,
  },
  qwen: {
    id: "qwen",
    label: "Qwen (Alibaba Cloud)",
    baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen-plus",
    note: "Alibaba Cloud Model Studio",
    signup: "https://modelstudio.console.alibabacloud.com/",
    needsKey: true,
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "",
    note: "Many models in one key, including free ones (ids ending in :free)",
    signup: "https://openrouter.ai/keys",
    needsKey: true,
  },
  groq: {
    id: "groq",
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "",
    note: "Free tier, very fast",
    signup: "https://console.groq.com/keys",
    needsKey: true,
  },
  xai: {
    id: "xai",
    label: "xAI Grok",
    baseUrl: "https://api.x.ai/v1",
    defaultModel: "",
    note: "Grok models from xAI (paid)",
    signup: "https://console.x.ai/",
    needsKey: true,
  },
  ollama: {
    id: "ollama",
    label: "Ollama (on your Mac)",
    baseUrl: "http://localhost:11434/v1",
    defaultModel: "qwen3:8b",
    note: "Free and offline, but only works when the app runs on your Mac",
    signup: "https://ollama.com/download",
    needsKey: false,
  },
  custom: {
    id: "custom",
    label: "Custom",
    baseUrl: "",
    defaultModel: "",
    note: "Any other OpenAI-compatible API (Kimi, GLM, …)",
    signup: "",
    needsKey: false,
  },
};

export type KeySource = "user" | "shared" | null;
export type Provider = Preset & { apiKey: string; configured: boolean; keyEnv: string; source: KeySource; userKey: boolean };

const env = (k: string) => (process.env[k] ?? "").trim();

/**
 * Also accept short, lowercase variable names (e.g. `gemini`, `deepseek`,
 * `openrouter`), since Vercel doesn't allow renaming a secret once saved.
 * A variable named `grok` may hold either an xAI Grok key ("xai-…") or a
 * Groq key ("gsk_…"), so it's routed by the key's prefix.
 */
function shortNameKey(id: ProviderId): string {
  const direct = env(id) || env(id.toUpperCase());
  if (direct) return direct;
  const grok = env("grok") || env("GROK") || env("GROK_API_KEY");
  if (id === "groq" && grok.startsWith("gsk_")) return grok;
  if (id === "xai" && grok && !grok.startsWith("gsk_")) return grok;
  return "";
}

function resolve(id: ProviderId, ctx: KeyContext = {}): Provider {
  const p = PRESETS[id];
  const ID = id.toUpperCase();
  // Older single-provider setup (AI_PROVIDER + AI_API_KEY) still works.
  const legacy = env("AI_PROVIDER").toLowerCase() === id;
  const legacyCustom = id === "custom" && !PRESETS[env("AI_PROVIDER").toLowerCase() as ProviderId] && env("AI_BASE_URL");

  const apiKey = env(`${ID}_API_KEY`) || shortNameKey(id) || (legacy || legacyCustom ? env("AI_API_KEY") : "");
  const baseUrl = (env(`${ID}_BASE_URL`) || (legacy || legacyCustom ? env("AI_BASE_URL") : "") || p.baseUrl).replace(/\/+$/, "");
  const defaultModel = env(`${ID}_MODEL`) || (legacy || legacyCustom ? env("AI_MODEL") : "") || p.defaultModel;
  const label = id === "custom" ? env("CUSTOM_NAME") || p.label : p.label;

  const shared = ctx.shared !== false;
  const userKey = ctx.keys?.[id] ?? "";

  let sharedOk: boolean;
  if (id === "ollama") sharedOk = Boolean(env("OLLAMA_BASE_URL") || env("OLLAMA_MODEL"));
  else if (id === "custom") sharedOk = Boolean(baseUrl);
  else sharedOk = Boolean(apiKey);
  sharedOk = sharedOk && shared;

  const source: KeySource = userKey ? "user" : sharedOk ? "shared" : null;
  return {
    ...p,
    label,
    apiKey: userKey || (sharedOk ? apiKey : ""),
    baseUrl,
    defaultModel,
    configured: Boolean(source),
    source,
    userKey: Boolean(userKey),
    keyEnv: id === "ollama" ? "OLLAMA_BASE_URL" : id === "custom" ? "CUSTOM_BASE_URL" : `${ID}_API_KEY`,
  };
}

/**
 * Keys a request may use: the signed-in user's own keys, plus the app's
 * shared keys (server env vars) only for the owner. Set OWNER_EMAILS to a
 * comma-separated list so everyone else must bring their own key; if it's
 * unset, shared keys are open to all users.
 */
export type KeyContext = { keys?: Partial<Record<ProviderId, string>>; shared?: boolean };

export function sharedKeysAllowed(email: string | null | undefined) {
  const owners = env("OWNER_EMAILS")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!owners.length) return true;
  return Boolean(email && owners.includes(email.toLowerCase()));
}

/** Providers that can actually serve keys to the user (own or shared). */
export function providers(ctx: KeyContext = {}): Provider[] {
  return PROVIDER_IDS.map((id) => resolve(id, ctx));
}

/** Providers a user may add their own key for (not local/custom ones). */
export const BYOK_PROVIDERS: ProviderId[] = ["openrouter", "gemini", "deepseek", "groq", "qwen", "xai"];

// ─────────────────────────── user preferences ───────────────────────────

export type AIPrefs = KeyContext & {
  provider?: ProviderId;
  models?: Partial<Record<ProviderId, string>>;
  fallback?: boolean;
  /** Your standing instructions, sent to every model on every request. */
  instructions?: string;
};

// ───────────────────────────── the app skill ─────────────────────────────
// Sent as the first part of the system prompt on EVERY call, to EVERY model.
// Context lives in the app (Supabase), not in any one model's memory, so
// switching models mid-task loses nothing: the next model gets the same
// brief, the same instructions and the same data.

export const APP_SKILL = `# Your role
You are the AI assistant built into "Job Tracker", the candidate's personal job-search app. You work for one person: the candidate whose data appears below. Several different AI models take turns doing this job, and the candidate switches between them at will, so act exactly as the brief says, consistently, whichever model you are.

# The app you live in
- Job cards: every job the candidate saved or applied to, with the posting link, a saved copy of the job description, status (saved → applied → interview → offer / rejected / ghosted) and notes.
- Answers bank: the candidate's own answers to common application-form questions (contact details, CTC, notice period, work authorization, long answers like "why this company").
- Experience: the candidate's master list of roles and achievement bullets. This is the single source of truth about their career.
- Chrome extension: fills application forms from the answers bank and asks you to draft answers to open questions on live forms.

# What you are asked to do
- Tailor experience: rephrase the candidate's real bullets so they use the job description's keywords.
- Draft form answers: write answers to application questions for a specific job.
- Extract postings: pull title, company, location and description out of pasted text.
- Import resumes: split pasted resume text into structured roles.
Each request ends with a TASK section that says which one it is and the exact output format.

# Rules that always apply
1. Truth first. Never invent employers, titles, dates, tools, metrics, degrees or achievements. Use only what the candidate's data says. If something the job wants is missing, say so where the format allows it, and never fake it.
2. The candidate's data is the source of truth. If anything you "know" conflicts with it, the data wins.
3. Sound like the candidate: first person in form answers, confident and specific, no clichés ("passionate", "synergy"), no filler.
4. Indian job market conventions unless the job is clearly elsewhere: CTC in LPA, notice periods in days, Indian English spelling.
5. Return exactly the requested format: valid JSON when JSON is asked for, plain text otherwise. No preamble, no markdown fences, no notes about yourself.
6. Keep it consistent with earlier work for the same job (e.g. a tailored summary already on the card) so everything the candidate sends tells one story.`;

function systemFor(task: string, prefs: AIPrefs) {
  const mine = (prefs.instructions ?? "").trim();
  return [
    APP_SKILL,
    mine ? `# The candidate's standing instructions (always follow unless they break rule 1)\n${mine.slice(0, 2000)}` : "",
    `# TASK\n${task}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function prefsFrom(user: User | null | undefined): AIPrefs {
  const ai = (user?.user_metadata as { ai?: AIPrefs } | undefined)?.ai;
  return ai && typeof ai === "object" ? ai : {};
}

export function activeProviderId(prefs: AIPrefs): ProviderId | null {
  const all = providers(prefs);
  const ok = (id?: string) => all.find((p) => p.id === id && p.configured)?.id ?? null;
  return ok(prefs.provider) ?? ok(env("AI_PROVIDER").toLowerCase()) ?? all.find((p) => p.configured)?.id ?? null;
}

export function modelFor(p: Provider, prefs: AIPrefs) {
  return (prefs.models?.[p.id] || p.defaultModel || "").trim();
}

// ─────────────────────────────── calling ───────────────────────────────

export class AIError extends Error {}

export type AIResult<T = string> = { data: T; provider: ProviderId; label: string; model: string };

type RunOptions = {
  prefs?: AIPrefs;
  /** Force one provider (e.g. the "Test" button). Disables fallback. */
  provider?: ProviderId;
  model?: string;
  temperature?: number;
};

async function callOnce(p: Provider, model: string, system: string, user: string, temperature: number) {
  const res = await fetch(`${p.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(p.apiKey ? { Authorization: `Bearer ${p.apiKey}` } : {}),
      ...(p.id === "openrouter" ? { "X-Title": "Job Tracker" } : {}),
    },
    body: JSON.stringify({
      model,
      temperature,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(55_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message || body?.[0]?.error?.message || body?.message || res.statusText;
    const why = res.status === 429 ? "rate limit / quota reached" : res.status === 401 || res.status === 403 ? "key rejected" : msg;
    throw new AIError(`${why} (${res.status})`);
  }
  const text: string = body?.choices?.[0]?.message?.content ?? "";
  if (!text.trim()) throw new AIError("empty reply");
  // Reasoning models (DeepSeek R-series, Qwen3…) may include <think> blocks.
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

/**
 * Runs a prompt on the user's chosen provider, falling back to the other
 * configured providers if it fails. `parse` runs inside the loop, so a model
 * that returns unusable output also triggers the fallback.
 */
async function run<T>(system: string, user: string, parse: (text: string) => T, opts: RunOptions = {}): Promise<AIResult<T>> {
  const prefs = opts.prefs ?? {};
  const all = providers(prefs);

  let order: Provider[];
  if (opts.provider) {
    const p = all.find((x) => x.id === opts.provider);
    if (!p) throw new AIError(`Unknown provider "${opts.provider}".`);
    order = [p];
  } else {
    const first = activeProviderId(prefs);
    if (!first) throw new AIError("No AI model is connected yet. Open AI settings and connect one; OpenRouter takes one click.");
    const rest = prefs.fallback === false ? [] : all.filter((p) => p.configured && p.id !== first);
    order = [all.find((p) => p.id === first)!, ...rest];
  }

  const errors: string[] = [];
  for (const p of order) {
    const model = (opts.provider ? opts.model : undefined) || modelFor(p, prefs);
    if (!model) {
      errors.push(`${p.label}: pick a model in Settings`);
      continue;
    }
    if (!p.configured && !opts.provider) continue;
    try {
      const text = await callOnce(p, model, systemFor(system, prefs), user, opts.temperature ?? 0.4);
      return { data: parse(text), provider: p.id, label: p.label, model };
    } catch (e) {
      errors.push(`${p.label}: ${(e as Error).message}`);
    }
  }
  throw new AIError(errors.join(" · ") || "No AI provider could answer.");
}

export function chat(system: string, user: string, opts: RunOptions = {}) {
  return run(system, user, (t) => t, opts);
}

/** Asks for JSON and parses it, tolerating ```json fences and stray prose. */
export function chatJSON<T>(system: string, user: string, opts: RunOptions = {}) {
  return run<T>(
    system + "\n\nRespond with a single JSON object only. No markdown, no commentary.",
    user,
    (raw) => {
      const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      if (start === -1 || end === -1) throw new AIError("reply was not JSON");
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T;
      } catch {
        throw new AIError("reply had broken JSON");
      }
    },
    { temperature: 0.3, ...opts },
  );
}

// ─────────────────────────── model listing ───────────────────────────

export type ModelInfo = { id: string; free: boolean };

const NOT_CHAT = /embed|tts|whisper|transcri|speech|audio|imagen|image-gen|veo|aqa|moderation|guard|rerank|dall-e|learnlm/i;

/** Lists chat models a provider offers (OpenAI-compatible GET /models). */
export async function listModels(p: Provider): Promise<ModelInfo[]> {
  const res = await fetch(`${p.baseUrl}/models`, {
    headers: p.apiKey ? { Authorization: `Bearer ${p.apiKey}` } : {},
    signal: AbortSignal.timeout(15_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new AIError(body?.error?.message || `Couldn't list models (${res.status})`);
  const raw: Record<string, unknown>[] = body?.data ?? body?.models ?? [];
  const seen = new Set<string>();
  return raw
    .map((m) => {
      const id = String(m.id ?? m.name ?? "").replace(/^models\//, "");
      const pricing = m.pricing as { prompt?: string; completion?: string } | undefined;
      const free = id.endsWith(":free") || (pricing ? Number(pricing.prompt) === 0 && Number(pricing.completion) === 0 : false);
      return { id, free };
    })
    .filter((m) => m.id && !NOT_CHAT.test(m.id) && !seen.has(m.id) && seen.add(m.id))
    .sort((a, b) => Number(b.free) - Number(a.free) || a.id.localeCompare(b.id))
    .slice(0, 400);
}

// ─────────────────────────────── prompts ───────────────────────────────

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
