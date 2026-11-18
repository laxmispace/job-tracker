"use client";

import {
  ArrowSquareOut,
  ArrowsClockwise,
  CaretDown,
  ChatCircleText,
  CheckCircle,
  CircleNotch,
  Key,
  Lightning,
  PlugsConnected,
  Sparkle,
  WarningCircle,
} from "@phosphor-icons/react";
import { Button, Chip, ComboBox, Input, Label, ListBox, Skeleton, Switch, TextArea, TextField, toast } from "@heroui/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Panel from "@/components/Panel";
import ProviderLogo from "@/components/ProviderLogo";
import { finishOpenRouterConnect, startOpenRouterConnect, useAIPrefs, type ProviderInfo } from "@/lib/ai-prefs";
import { api } from "@/lib/supabase";

type ModelInfo = { id: string; free: boolean };
type TestResult = { ok: boolean; text: string };

// Where each provider hands out keys (opened in a new tab).
const KEY_PAGE: Record<string, string> = {
  openrouter: "https://openrouter.ai/settings/keys",
  gemini: "https://aistudio.google.com/apikey",
  deepseek: "https://platform.deepseek.com/api_keys",
  groq: "https://console.groq.com/keys",
  qwen: "https://modelstudio.console.alibabacloud.com/",
  xai: "https://console.x.ai/",
};

// Order: the one-click option first, then free tiers, then paid.
const ORDER = ["openrouter", "gemini", "groq", "deepseek", "qwen", "xai", "ollama", "custom"];

export default function AISettingsPage() {
  const ai = useAIPrefs();
  const { state, error } = ai;
  const params = useSearchParams();
  const router = useRouter();
  const handled = useRef(false);
  const [connecting, setConnecting] = useState(false);

  // Coming back from OpenRouter's approval screen: /settings?code=…
  useEffect(() => {
    const code = params.get("code");
    if (!code || handled.current) return;
    handled.current = true;
    setConnecting(true);
    finishOpenRouterConnect(code)
      .then(() => toast("OpenRouter connected", { description: "Pick a model below. Free ones are tagged.", variant: "success" }))
      .catch((e) => toast("Couldn't connect OpenRouter", { description: (e as Error).message, variant: "danger" }))
      .finally(() => {
        setConnecting(false);
        router.replace("/settings");
      });
  }, [params, router]);

  if (error) return <p className="py-10 text-danger">{error}</p>;
  if (!state) return <Skeleton className="mx-auto h-96 max-w-3xl rounded-2xl" />;

  const list = [...state.providers]
    .filter((p) => p.byok || p.configured)
    .sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
  const anyConnected = list.some((p) => p.configured);

  async function connectOpenRouter() {
    try {
      await startOpenRouterConnect();
    } catch (e) {
      toast("Couldn't start the connection", { description: (e as Error).message, variant: "danger" });
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">AI settings</h1>
        <p className="text-sm text-muted">
          Connect the AI that tailors your resume bullets and drafts form answers. Use your own account, so it&apos;s free or
          pay-as-you-go on your terms.
        </p>
      </div>

      {connecting && (
        <div className="flex items-center gap-2 rounded-2xl border border-separator bg-surface p-4 text-sm text-muted">
          <CircleNotch className="size-4 animate-spin" /> Finishing the OpenRouter connection…
        </div>
      )}

      {!anyConnected && !connecting && (
        <Panel
          icon={PlugsConnected}
          title="Connect your first AI model"
          description="One click with OpenRouter: sign in there, approve, and you're back here. It gives you Gemini, DeepSeek, Qwen, Grok and more, including free models."
          bodyClassName="flex flex-wrap items-center gap-3 p-4 sm:p-5"
        >
          <Button onPress={connectOpenRouter}>
            <ProviderLogo id="openrouter" size={18} /> Connect OpenRouter
          </Button>
          <span className="text-xs text-muted">or add a key for a specific provider below</span>
        </Panel>
      )}

      <Panel
        icon={Sparkle}
        title="Models"
        description="Your keys are encrypted, checked before saving, and never shown again."
        bodyClassName=""
      >
        {list.map((p, i) => (
          <ModelRow key={p.id} p={p} first={i === 0} active={state.active === p.id} ai={ai} onConnectOpenRouter={connectOpenRouter} />
        ))}
      </Panel>

      <Panel
        icon={ArrowsClockwise}
        title="Use a backup model automatically"
        description="If the model in use fails or hits its free limit, your other connected models take over."
        actions={
          <Switch
            isSelected={state.fallback}
            aria-label="Use a backup model automatically"
            onChange={async (v) => {
              try {
                await ai.setFallback(v);
                toast(v ? "Backup models on" : "Backup models off", { variant: "success" });
              } catch (e) {
                toast("Couldn't save", { description: (e as Error).message, variant: "danger" });
              }
            }}
          >
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch.Content>
          </Switch>
        }
      />

      <InstructionsPanel key={state.instructions} initial={state.instructions} skill={state.skill} onSave={ai.setInstructions} />
    </div>
  );
}

function ModelRow({
  p,
  first,
  active,
  ai,
  onConnectOpenRouter,
}: {
  p: ProviderInfo;
  first: boolean;
  active: boolean;
  ai: ReturnType<typeof useAIPrefs>;
  onConnectOpenRouter: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [key, setKey] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [models, setModels] = useState<ModelInfo[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [draft, setDraft] = useState(p.model);

  async function saveKey() {
    setSavingKey(true);
    try {
      await ai.saveKey(p.id, key);
      setKey("");
      setAdding(false);
      setModelOpen(!p.defaultModel);
      toast(`${p.label} connected`, { description: p.defaultModel ? `Using ${p.defaultModel}` : "Now pick a model.", variant: "success" });
    } catch (e) {
      toast("Key not saved", { description: (e as Error).message, variant: "danger" });
    } finally {
      setSavingKey(false);
    }
  }

  async function removeKey() {
    try {
      await ai.removeKey(p.id);
      toast(`${p.label} disconnected`, { variant: "success" });
    } catch (e) {
      toast("Couldn't remove the key", { description: (e as Error).message, variant: "danger" });
    }
  }

  async function loadModels() {
    if (models || loading) return;
    setLoading(true);
    try {
      const r = await api<{ models: ModelInfo[] }>("/api/ai/providers", { action: "models", provider: p.id });
      setModels(r.models);
    } catch (e) {
      setModels([]);
      toast(`Couldn't list ${p.label} models`, { description: (e as Error).message, variant: "danger" });
    } finally {
      setLoading(false);
    }
  }

  async function commit(m: string) {
    const v = m.trim();
    if (!v || v === p.model) return;
    setResult(null);
    try {
      await ai.setModel(p.id, v);
      toast(`${p.label} will use ${v}`, { variant: "success" });
    } catch (e) {
      toast("Couldn't save model", { description: (e as Error).message, variant: "danger" });
    }
  }

  async function test() {
    setTesting(true);
    setResult(null);
    try {
      const r = await api<{ ms: number; model: string }>("/api/ai/providers", { action: "test", provider: p.id, model: draft || p.model });
      setResult({ ok: true, text: `Works · ${r.model} answered in ${(r.ms / 1000).toFixed(1)}s` });
    } catch (e) {
      setResult({ ok: false, text: (e as Error).message });
    } finally {
      setTesting(false);
    }
  }

  const status = p.source === "user" ? `Your key ••••${p.keyLast4 ?? ""}` : p.source === "shared" ? "Shared app key" : p.note;
  const freeCount = models?.filter((m) => m.free).length ?? 0;

  return (
    <div className={`${first ? "" : "border-t border-separator"} ${active ? "bg-accent/5" : ""}`}>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5">
        <ProviderLogo id={p.id} label={p.label} size={32} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-medium">
            {p.label}
            {active && (
              <Chip size="sm" color="accent" variant="soft">
                In use
              </Chip>
            )}
            {p.id === "openrouter" && !p.configured && (
              <Chip size="sm" variant="soft">
                Recommended
              </Chip>
            )}
          </p>
          <p className="truncate text-xs text-muted">
            {p.configured && p.model ? `${p.model} · ` : ""}
            {status}
          </p>
          {result && (
            <p className={`mt-1 flex items-center gap-1 text-xs ${result.ok ? "text-success" : "text-danger"}`}>
              {result.ok ? <CheckCircle className="size-3.5" /> : <WarningCircle className="size-3.5" />}
              {result.text}
            </p>
          )}
        </div>

        <div className="flex w-full flex-wrap items-center justify-end gap-1.5 sm:w-auto sm:shrink-0">
          {p.configured ? (
            <>
              <Button size="sm" variant="ghost" onPress={test} isPending={testing} isDisabled={!p.model && !draft}>
                {testing ? <CircleNotch className="size-4 animate-spin" /> : <Lightning className="size-4" />}
                Test
              </Button>
              <Button size="sm" variant="ghost" onPress={() => setModelOpen((o) => !o)} aria-expanded={modelOpen}>
                Model <CaretDown className={`size-3.5 transition-transform ${modelOpen ? "rotate-180" : ""}`} />
              </Button>
              {p.source === "user" && (
                <Button size="sm" variant="ghost" className="text-danger" onPress={removeKey}>
                  Remove
                </Button>
              )}
              {!active && (
                <Button
                  size="sm"
                  isDisabled={!p.model && !draft}
                  onPress={async () => {
                    try {
                      await ai.setProvider(p.id);
                      toast(`${p.label} is now in use`, { description: p.model || undefined, variant: "success" });
                    } catch (e) {
                      toast("Couldn't switch", { description: (e as Error).message, variant: "danger" });
                    }
                  }}
                >
                  Use
                </Button>
              )}
            </>
          ) : p.id === "openrouter" ? (
            <Button size="sm" onPress={onConnectOpenRouter}>
              <PlugsConnected className="size-4" /> Connect
            </Button>
          ) : p.byok ? (
            <Button size="sm" variant="secondary" onPress={() => setAdding((a) => !a)} aria-expanded={adding}>
              {adding ? "Cancel" : (
                <>
                  <Key className="size-4" /> Add key
                </>
              )}
            </Button>
          ) : null}
        </div>
      </div>

      {adding && !p.configured && (
        <div className="space-y-2 px-4 pb-4 sm:pl-[68px] sm:pr-5">
          <div className="flex items-center gap-2">
            <TextField className="min-w-0 flex-1" value={key} onChange={setKey} type="password" aria-label={`${p.label} API key`}>
              <Input placeholder={`Paste your ${p.label} API key`} autoComplete="off" onKeyDown={(e) => e.key === "Enter" && key.trim() && saveKey()} />
            </TextField>
            <Button className="shrink-0" onPress={saveKey} isPending={savingKey} isDisabled={key.trim().length < 12}>
              {savingKey && <CircleNotch className="size-4 animate-spin" />}
              Save
            </Button>
          </div>
          {KEY_PAGE[p.id] && (
            <a href={KEY_PAGE[p.id]} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
              Get a {p.label} key <ArrowSquareOut className="size-3" />
            </a>
          )}
        </div>
      )}

      {modelOpen && p.configured && (
        <div className="px-4 pb-4 sm:pl-[68px] sm:pr-5">
          <ComboBox
            allowsCustomValue
            inputValue={draft}
            onInputChange={setDraft}
            onSelectionChange={(k) => {
              if (k == null) return;
              setDraft(String(k));
              void commit(String(k));
            }}
            onOpenChange={(o) => o && loadModels()}
            menuTrigger="focus"
            aria-label={`${p.label} model`}
          >
            <Label className="sr-only">{p.label} model</Label>
            <ComboBox.InputGroup>
              <Input placeholder={p.defaultModel || "Search or type a model id"} onBlur={() => commit(draft)} onFocus={loadModels} />
              <ComboBox.Trigger />
            </ComboBox.InputGroup>
            <ComboBox.Popover>
              <ListBox>
                {(models ?? []).map((m) => (
                  <ListBox.Item key={m.id} id={m.id} textValue={m.id}>
                    <span className="flex w-full items-center justify-between gap-2">
                      <span className="truncate">{m.id}</span>
                      {m.free && (
                        <Chip size="sm" color="success" variant="soft">
                          free
                        </Chip>
                      )}
                    </span>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </ComboBox.Popover>
          </ComboBox>
          <p className="mt-1.5 text-xs text-muted">
            {loading
              ? "Loading models…"
              : models
                ? `${models.length} models${freeCount ? ` · ${freeCount} free (tagged)` : ""}. Pick one or type an id.`
                : "Click the box to see every model."}
          </p>
        </div>
      )}
    </div>
  );
}

function InstructionsPanel({ initial, skill, onSave }: { initial: string; skill: string; onSave: (v: string) => Promise<void> }) {
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const dirty = value.trim() !== initial.trim();
  return (
    <Panel
      icon={ChatCircleText}
      title="Instructions every model follows"
      description="Same brief for every model, so switching models mid-task doesn't lose context. Your portfolio, experience and answers are included automatically."
      bodyClassName="space-y-3 p-4 sm:p-5"
    >
      <TextField value={value} onChange={setValue}>
        <Label>Your instructions</Label>
        <TextArea
          rows={4}
          placeholder={"e.g. I'm targeting Senior Product Designer roles in fintech, Bengaluru or remote.\nKeep answers under 120 words, confident, no clichés."}
        />
      </TextField>
      <details className="text-sm">
        <summary className="cursor-pointer text-xs text-accent">See the full brief the app sends</summary>
        <pre className="mt-2 max-h-72 overflow-auto rounded-xl bg-default p-3 font-sans text-xs leading-relaxed whitespace-pre-wrap text-muted">{skill}</pre>
      </details>
      <div className="flex items-center gap-3">
        <Button
          isDisabled={!dirty}
          isPending={saving}
          onPress={async () => {
            setSaving(true);
            try {
              await onSave(value.trim());
              toast("Instructions saved", { description: "Every model follows them from the next request.", variant: "success" });
            } catch (e) {
              toast("Couldn't save", { description: (e as Error).message, variant: "danger" });
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving && <CircleNotch className="size-4 animate-spin" />}
          Save instructions
        </Button>
        {!dirty && initial && (
          <span className="flex items-center gap-1 text-xs text-success">
            <CheckCircle className="size-3.5" /> Saved
          </span>
        )}
      </div>
    </Panel>
  );
}
