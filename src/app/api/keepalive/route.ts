import { createClient } from "@supabase/supabase-js";
import { connection } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/server/auth";

/**
 * Hit daily by a Vercel cron (see vercel.json) so the free Supabase project
 * never goes 7 days without activity and gets paused.
 */
export async function GET() {
  await connection(); // always run at request time, never prerendered
  if (!SUPABASE_URL) return Response.json({ ok: false, reason: "no supabase env" });
  const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { error } = await db.from("jobs").select("id", { head: true, count: "exact" }).limit(1);
  return Response.json({ ok: !error, at: new Date().toISOString() });
}
