"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function supabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** Browser Supabase client. Session is kept in localStorage. */
export function sb(): SupabaseClient {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://missing.supabase.co",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "missing",
      { auth: { persistSession: true, autoRefreshToken: true } },
    );
  }
  return client;
}

/** Calls one of this app's /api routes with the user's access token. */
export async function api<T = unknown>(path: string, body?: unknown): Promise<T> {
  const { data } = await sb().auth.getSession();
  const res = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session?.access_token ?? ""}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json as T;
}
