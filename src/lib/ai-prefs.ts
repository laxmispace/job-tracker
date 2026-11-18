"use client";

import { useEffect, useSyncExternalStore } from "react";
import { api, sb } from "./supabase";

export type ProviderInfo = {
  id: string;
  label: string;
  note: string;
  signup: string;
  keyEnv: string;
  configured: boolean;
  /** "user" = the person's own key, "shared" = the app owner's key */
  source: "user" | "shared" | null;
  byok: boolean;
  keyLast4: string | null;
  keyVia: "pasted" | "oauth" | null;
  defaultModel: string;
  model: string;
};

export type AIState = {
  active: string | null;
  fallback: boolean;
  instructions: string;
  skill: string;
  sharedAllowed: boolean;
  providers: ProviderInfo[];
};

type Prefs = { provider?: string; models?: Record<string, string>; fallback?: boolean; instructions?: string };

// One shared store, so the header dropdown, the job page and Settings always agree.
let state: AIState | null = null;
let error = "";
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const set = (fn: (s: AIState) => AIState) => {
  if (state) state = fn(state);
  emit();
};

function load(force = false) {
  if (loading && !force) return loading;
  loading = api<AIState>("/api/ai/providers")
    .then((s) => {
      state = s;
      error = "";
    })
    .catch((e) => {
      error = (e as Error).message;
    })
    .finally(emit);
  return loading;
}

async function save(patch: (p: Prefs) => Prefs) {
  const { data } = await sb().auth.getUser();
  const current = ((data.user?.user_metadata as { ai?: Prefs })?.ai ?? {}) as Prefs;
  const { error: e } = await sb().auth.updateUser({ data: { ai: patch(current) } });
  if (e) throw e;
}

// ───────────── OpenRouter one-click connect (OAuth PKCE) ─────────────
const VERIFIER_KEY = "jt-openrouter-verifier";

function b64url(bytes: ArrayBuffer | Uint8Array) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Sends the user to OpenRouter to approve; they come back to /settings?code=… */
export async function startOpenRouterConnect() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  try {
    sessionStorage.setItem(VERIFIER_KEY, verifier);
  } catch {
    throw new Error("Your browser blocked session storage, which the connection needs.");
  }
  const callback = `${window.location.origin}/settings`;
  window.location.href =
    `https://openrouter.ai/auth?callback_url=${encodeURIComponent(callback)}` +
    `&code_challenge=${challenge}&code_challenge_method=S256&key_label=${encodeURIComponent("Job Tracker")}`;
}

/** Call on /settings load. Returns true if an OpenRouter connection was completed. */
export async function finishOpenRouterConnect(code: string) {
  let verifier = "";
  try {
    verifier = sessionStorage.getItem(VERIFIER_KEY) ?? "";
    sessionStorage.removeItem(VERIFIER_KEY);
  } catch {}
  if (!verifier) throw new Error("This connection link expired. Click Connect OpenRouter again.");
  await api("/api/ai/keys", { action: "openrouter", code, verifier });
  await load(true);
  return true;
}

const actions = {
  reload: () => load(true),
  async saveKey(provider: string, key: string) {
    await api("/api/ai/keys", { action: "save", provider, key });
    await load(true);
  },
  async removeKey(provider: string) {
    await api("/api/ai/keys", { action: "remove", provider });
    await load(true);
  },
  async setProvider(id: string) {
    set((s) => ({ ...s, active: id }));
    await save((p) => ({ ...p, provider: id }));
  },
  async setModel(id: string, model: string) {
    set((s) => ({ ...s, providers: s.providers.map((p) => (p.id === id ? { ...p, model } : p)) }));
    await save((p) => ({ ...p, models: { ...(p.models ?? {}), [id]: model } }));
  },
  async setFallback(fallback: boolean) {
    set((s) => ({ ...s, fallback }));
    await save((p) => ({ ...p, fallback }));
  },
  async setInstructions(instructions: string) {
    set((s) => ({ ...s, instructions }));
    await save((p) => ({ ...p, instructions }));
  },
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** AI model choice + instructions, saved on your Supabase profile so they sync to phone and extension. */
export function useAIPrefs() {
  const snap = useSyncExternalStore(
    subscribe,
    () => state,
    () => null,
  );
  const err = useSyncExternalStore(
    subscribe,
    () => error,
    () => "",
  );
  useEffect(() => {
    void load();
  }, []);
  return { state: snap, error: err, ...actions };
}
