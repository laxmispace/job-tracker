import {
  AIError,
  APP_SKILL,
  activeProviderId,
  chat,
  listModels,
  modelFor,
  prefsFrom,
  providers,
  type ProviderId,
} from "@/lib/server/ai";
import { json, preflight, requireUser } from "@/lib/server/auth";

export const OPTIONS = preflight;
export const maxDuration = 60;

/** GET → every provider, whether its key is set, and the user's current choice. Keys are never returned. */
export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const prefs = prefsFrom(auth.user);
  return json({
    active: activeProviderId(prefs),
    fallback: prefs.fallback !== false,
    instructions: prefs.instructions ?? "",
    skill: APP_SKILL,
    providers: providers().map((p) => ({
      id: p.id,
      label: p.label,
      note: p.note,
      signup: p.signup,
      keyEnv: p.keyEnv,
      configured: p.configured,
      defaultModel: p.defaultModel,
      model: modelFor(p, prefs),
    })),
  });
}

/**
 * POST { action: "models", provider }        → { models: [{ id, free }] }
 * POST { action: "test", provider, model? }  → { ok, ms, reply, model }
 */
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const body = (await req.json().catch(() => ({}))) as { action?: string; provider?: ProviderId; model?: string };
  const p = providers().find((x) => x.id === body.provider);
  if (!p) return json({ error: "Unknown provider." }, 400);
  if (!p.configured) return json({ error: `Add ${p.keyEnv} in Vercel first.` }, 400);

  try {
    if (body.action === "models") return json({ models: await listModels(p) });
    if (body.action === "test") {
      const model = body.model || modelFor(p, prefsFrom(auth.user));
      if (!model) return json({ error: "Pick a model first." }, 400);
      const t0 = Date.now();
      const r = await chat("You are a connectivity check.", "Reply with exactly: ready", {
        provider: p.id,
        model,
        temperature: 0,
      });
      return json({ ok: true, ms: Date.now() - t0, reply: r.data.slice(0, 80), model: r.model });
    }
    return json({ error: "Unknown action." }, 400);
  } catch (e) {
    return json({ error: e instanceof AIError ? e.message : (e as Error).message }, 502);
  }
}
