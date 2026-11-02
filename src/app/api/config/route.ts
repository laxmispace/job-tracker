import { connection } from "next/server";
import { providers } from "@/lib/server/ai";
import { SUPABASE_ANON_KEY, SUPABASE_URL, json, preflight } from "@/lib/server/auth";

export const OPTIONS = preflight;

/** Public config the Chrome extension needs. (The anon key is safe to expose; RLS protects data.) */
export async function GET() {
  await connection();
  return json({
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: SUPABASE_ANON_KEY,
    ai: { providers: providers().filter((p) => p.configured).map((p) => p.id) },
  });
}
