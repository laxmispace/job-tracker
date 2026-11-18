import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/**
 * Encryption for users' own AI keys. The 256-bit key is derived from
 * KEY_ENCRYPTION_SECRET if set, otherwise from the Supabase JWT secret that
 * the Vercel ↔ Supabase integration already provides, so no extra setup is
 * needed. (If that secret is ever rotated, users simply reconnect their keys.)
 */
function masterKey() {
  const secret =
    process.env.KEY_ENCRYPTION_SECRET || process.env.SUPABASE_JWT_SECRET || process.env.SUPABASE_SECRET_KEY || "";
  if (!secret) throw new Error("Server has no encryption secret (set KEY_ENCRYPTION_SECRET).");
  return Buffer.from(hkdfSync("sha256", secret, "job-tracker/user-ai-keys", "aes-256-gcm v1", 32));
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", masterKey(), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]).toString("base64");
}

export function decryptSecret(blob: string): string {
  const raw = Buffer.from(blob, "base64");
  const d = createDecipheriv("aes-256-gcm", masterKey(), raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8");
}
