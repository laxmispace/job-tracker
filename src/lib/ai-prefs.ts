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
  defaultModel: string;
  model: string;
};

export type AIState = {
  active: string | null;
  fallback: boolean;
  instructions: string;
  skill: string;
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

const actions = {
  reload: () => load(true),
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
