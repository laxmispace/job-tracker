import type { SupabaseClient, User } from "@supabase/supabase-js";
import { PROVIDER_IDS, prefsFrom, sharedKeysAllowed, type AIPrefs, type ProviderId } from "./ai";
import { decryptSecret } from "./crypto";

export type StoredKey = { provider: ProviderId; key_last4: string; source: "pasted" | "oauth"; updated_at: string };

/** The user's saved keys, without the secret parts (safe to send to the browser). */
export async function listUserKeys(db: SupabaseClient): Promise<StoredKey[]> {
  const { data } = await db.from("user_ai_keys").select("provider,key_last4,source,updated_at");
  return Array.isArray(data) ? (data as StoredKey[]) : [];
}

/**
 * Everything an AI call needs for this user: their model choices and
 * instructions, their own decrypted keys, and whether they may fall back to
 * the app's shared keys.
 */
export async function aiPrefs(db: SupabaseClient, user: User): Promise<AIPrefs> {
  const base = prefsFrom(user);
  const { data } = await db.from("user_ai_keys").select("provider,key_cipher");
  const keys: Partial<Record<ProviderId, string>> = {};
  for (const row of Array.isArray(data) ? (data as { provider: string; key_cipher: string }[]) : []) {
    if (!(PROVIDER_IDS as readonly string[]).includes(row.provider)) continue;
    try {
      keys[row.provider as ProviderId] = decryptSecret(row.key_cipher);
    } catch {
      /* undecryptable (secret rotated): treat as not connected */
    }
  }
  return { ...base, keys, shared: sharedKeysAllowed(user.email) };
}
