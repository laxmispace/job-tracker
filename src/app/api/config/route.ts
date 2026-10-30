import { connection } from "next/server";
import { aiConfig } from "@/lib/server/ai";
import { SUPABASE_ANON_KEY, SUPABASE_URL, json, preflight } from "@/lib/server/auth";

export const OPTIONS = preflight;

/** Public config the Chrome extension needs. (The anon key is safe to expose; RLS protects data.) */
export async function GET() {
  await connection();
  const ai = aiConfig();
  return json({
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: SUPABASE_ANON_KEY,
    ai: { provider: ai.name, model: ai.model, configured: Boolean(ai.apiKey) || ai.name === "ollama" },
  });
}
