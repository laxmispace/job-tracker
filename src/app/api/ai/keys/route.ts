import { AIError, BYOK_PROVIDERS, listModels, providers, type ProviderId } from "@/lib/server/ai";
import { json, preflight, requireUser } from "@/lib/server/auth";
import { encryptSecret } from "@/lib/server/crypto";

export const OPTIONS = preflight;
export const maxDuration = 30;

/**
 * Manage the signed-in user's own AI keys.
 *   { action: "save", provider, key }            paste a key (checked before saving)
 *   { action: "remove", provider }
 *   { action: "openrouter", code, verifier }     finish OpenRouter's one-click connect
 * Keys are encrypted before storage and never sent back to the browser.
 */
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const { db, user } = auth;
  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    provider?: string;
    key?: string;
    code?: string;
    verifier?: string;
  };

  if (body.action === "remove") {
    const { error } = await db.from("user_ai_keys").delete().eq("provider", body.provider ?? "");
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  let provider: ProviderId;
  let key = "";
  let source: "pasted" | "oauth" = "pasted";

  if (body.action === "openrouter") {
    if (!body.code || !body.verifier) return json({ error: "Missing code from OpenRouter. Try connecting again." }, 400);
    const res = await fetch("https://openrouter.ai/api/v1/auth/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: body.code, code_verifier: body.verifier, code_challenge_method: "S256" }),
      signal: AbortSignal.timeout(15_000),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || !out.key) {
      return json({ error: out?.error?.message || "OpenRouter didn't confirm the connection. Try again." }, 502);
    }
    provider = "openrouter";
    key = String(out.key);
    source = "oauth";
  } else if (body.action === "save") {
    provider = body.provider as ProviderId;
    key = (body.key ?? "").trim();
    if (!BYOK_PROVIDERS.includes(provider)) return json({ error: "That provider can't take a personal key." }, 400);
    if (key.length < 12) return json({ error: "That doesn't look like a full API key." }, 400);
  } else {
    return json({ error: "Unknown action." }, 400);
  }

  // Check the key works before saving it.
  const p = providers({ keys: { [provider]: key }, shared: false }).find((x) => x.id === provider)!;
  try {
    await listModels(p);
  } catch (e) {
    const msg = e instanceof AIError ? e.message : (e as Error).message;
    return json({ error: `${p.label} didn't accept that key (${msg}).` }, 400);
  }

  const { error } = await db.from("user_ai_keys").upsert(
    { user_id: user.id, provider, key_cipher: encryptSecret(key), key_last4: key.slice(-4), source },
    { onConflict: "user_id,provider" },
  );
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, provider, last4: key.slice(-4) });
}
