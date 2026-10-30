import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: CORS_HEADERS });
}

export function preflight() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Resolves the signed-in user from the `Authorization: Bearer <access token>`
 * header and returns a Supabase client that acts as that user (RLS applies).
 */
export async function requireUser(
  req: Request,
): Promise<{ user: User; db: SupabaseClient } | Response> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return json({ error: "Supabase env vars are not set on the server." }, 500);
  }
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Not signed in." }, 401);
  const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return json({ error: "Session expired. Sign in again." }, 401);
  return { user: data.user, db };
}
