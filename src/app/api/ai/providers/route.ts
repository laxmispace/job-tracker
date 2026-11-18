import { AIError, APP_SKILL, BYOK_PROVIDERS, activeProviderId, chat, listModels, modelFor, providers, type ProviderId } from "@/lib/server/ai";
import { json, preflight, requireUser } from "@/lib/server/auth";
import { aiPrefs, listUserKeys } from "@/lib/server/user-keys";

export const OPTIONS = preflight;
export const maxDuration = 60;

/**
 * GET → every provider: whether it's usable for this user, whether the key is
 * their own or the app's shared one, and their current choice. Keys are never
 * returned; only the last 4 characters of the user's own keys.
 */
export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const prefs = await aiPrefs(auth.db, auth.user);
  const stored = await listUserKeys(auth.db);
  return json({
    active: activeProviderId(prefs),
    fallback: prefs.fallback !== false,
    instructions: prefs.instructions ?? "",
    skill: APP_SKILL,
    sharedAllowed: prefs.shared !== false,
    providers: providers(prefs).map((p) => {
      const mine = stored.find((k) => k.provider === p.id);
      return {
        id: p.id,
        label: p.label,
        note: p.note,
        signup: p.signup,
        keyEnv: p.keyEnv,
        configured: p.configured,
        source: p.source,
        byok: BYOK_PROVIDERS.includes(p.id),
        keyLast4: mine?.key_last4 ?? null,
        keyVia: mine?.source ?? null,
        defaultModel: p.defaultModel,
        model: modelFor(p, prefs),
      };
    }),
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
  const prefs = await aiPrefs(auth.db, auth.user);
  const p = providers(prefs).find((x) => x.id === body.provider);
  if (!p) return json({ error: "Unknown provider." }, 400);
  if (!p.configured) return json({ error: `Connect ${p.label} first.` }, 400);

  try {
    if (body.action === "models") return json({ models: await listModels(p) });
    if (body.action === "test") {
      const model = body.model || modelFor(p, prefs);
      if (!model) return json({ error: "Pick a model first." }, 400);
      const t0 = Date.now();
      const r = await chat("You are a connectivity check.", "Reply with exactly: ready", {
        prefs,
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
