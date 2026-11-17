"use client";

import { ArrowSquareOut, CaretDown, CheckCircle, CircleNotch, Lightning, WarningCircle } from "@phosphor-icons/react";
import { Button, Card, Chip, ComboBox, Input, Label, ListBox, Skeleton, Switch, TextArea, TextField, toast } from "@heroui/react";
import { useState } from "react";
import ProviderLogo from "@/components/ProviderLogo";
import { useAIPrefs, type ProviderInfo } from "@/lib/ai-prefs";
import { api } from "@/lib/supabase";

type ModelInfo = { id: string; free: boolean };
type TestResult = { ok: boolean; text: string };

export default function AISettingsPage() {
  const { state, error, setProvider, setModel, setFallback, setInstructions } = useAIPrefs();

  if (error) return <p className="py-10 text-danger">{error}</p>;
  if (!state) return <Skeleton className="mx-auto h-96 max-w-3xl rounded-2xl" />;

  const configured = state.providers.filter((p) => p.configured);
  const missing = state.providers.filter((p) => !p.configured);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">AI settings</h1>
        <p className="text-sm text-muted">
          Choose which AI writes your tailored resume bullets and form answers. The choice syncs to your phone and the Chrome
          extension.
        </p>
      </div>

      {/* Models */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium">Your models</h2>
        <Card className="gap-0 p-0">
          {configured.length === 0 && (
            <p className="p-4 text-sm text-muted">No AI keys found yet. Add one in Vercel (see “Add another model” below).</p>
          )}
          {configured.map((p, i) => (
            <ModelRow
              key={p.id}
              p={p}
              active={state.active === p.id}
              first={i === 0}
              onUse={async () => {
                try {
                  await setProvider(p.id);
                  toast(`${p.label} is now in use`, { description: p.model || undefined, variant: "success" });
                } catch (e) {
                  toast("Couldn't switch", { description: (e as Error).message, variant: "danger" });
                }
              }}
              onModel={async (m) => {
                try {
                  await setModel(p.id, m);
                  toast(`${p.label} will use ${m}`, { variant: "success" });
                } catch (e) {
                  toast("Couldn't save model", { description: (e as Error).message, variant: "danger" });
                }
              }}
            />
          ))}
        </Card>
      </section>

      {/* Fallback */}
      <Card className="flex-row items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Use a backup model automatically</p>
          <p className="text-xs text-muted">
            If the model in use fails or hits its free limit, your other models take over. Each result shows which model wrote it.
          </p>
        </div>
        <Switch
          isSelected={state.fallback}
          aria-label="Use a backup model automatically"
          onChange={async (v) => {
            try {
              await setFallback(v);
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
      </Card>

      {/* Instructions */}
      <InstructionsCard key={state.instructions} initial={state.instructions} skill={state.skill} onSave={setInstructions} />

      {/* Add more */}
      {missing.length > 0 && (
        <details className="group rounded-2xl border border-separator bg-surface">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
            <span className="flex items-center gap-3">
              <span className="flex -space-x-1.5">
                {missing.slice(0, 4).map((p) => (
                  <span key={p.id} className="rounded-md ring-2 ring-surface">
                    <ProviderLogo id={p.id} label={p.label} size={20} />
                  </span>
                ))}
              </span>
              <span className="text-sm font-medium">Add another model</span>
            </span>
            <CaretDown className="size-4 text-muted transition-transform group-open:rotate-180" />
          </summary>
          <div className="divide-y divide-separator border-t border-separator">
            {missing.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                <ProviderLogo id={p.id} label={p.label} size={24} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{p.label}</p>
                  <p className="text-xs text-muted">
                    {p.note}. Add <code className="rounded bg-default px-1">{p.keyEnv}</code> in Vercel, then redeploy.
                  </p>
                </div>
                {p.signup && (
                  <a href={p.signup} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 text-sm text-accent hover:underline">
                    {p.id === "ollama" ? "Download" : "Get key"} <ArrowSquareOut className="size-3.5" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function ModelRow({
  p,
  active,
  first,
  onUse,
  onModel,
}: {
  p: ProviderInfo;
  active: boolean;
  first: boolean;
  onUse: () => Promise<void>;
  onModel: (m: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(!p.model);
  const [models, setModels] = useState<ModelInfo[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [draft, setDraft] = useState(p.model);

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
    await onModel(v);
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

  const freeCount = models?.filter((m) => m.free).length ?? 0;

  return (
    <div className={`${first ? "" : "border-t border-separator"} ${active ? "bg-accent/5" : ""}`}>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
        <ProviderLogo id={p.id} label={p.label} size={32} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-medium">
            {p.label}
            {active && (
              <Chip size="sm" color="accent" variant="soft">
                In use
              </Chip>
            )}
          </p>
          <p className="truncate text-xs text-muted">{p.model || "No model chosen yet"}</p>
          {result && (
            <p className={`mt-1 flex items-center gap-1 text-xs ${result.ok ? "text-success" : "text-danger"}`}>
              {result.ok ? <CheckCircle className="size-3.5" /> : <WarningCircle className="size-3.5" />}
              {result.text}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button size="sm" variant="ghost" onPress={test} isPending={testing} isDisabled={!p.model && !draft}>
            {testing ? <CircleNotch className="size-4 animate-spin" /> : <Lightning className="size-4" />}
            Test
          </Button>
          <Button size="sm" variant="ghost" onPress={() => setOpen((o) => !o)} aria-expanded={open}>
            Model <CaretDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
          </Button>
          {!active && (
            <Button size="sm" onPress={onUse} isDisabled={!p.model && !draft}>
              Use
            </Button>
          )}
        </div>
      </div>
      {open && (
        <div className="px-4 pb-4 sm:pl-[60px]">
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
                : p.defaultModel
                  ? `Default: ${p.defaultModel}. Click the box to see every model.`
                  : "Click the box to see every model."}
          </p>
        </div>
      )}
    </div>
  );
}

function InstructionsCard({ initial, skill, onSave }: { initial: string; skill: string; onSave: (v: string) => Promise<void> }) {
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const dirty = value.trim() !== initial.trim();
  return (
    <Card className="gap-3">
      <Card.Header>
        <Card.Title>Instructions every model follows</Card.Title>
        <Card.Description>
          Same brief for every model, so switching models mid-task doesn&apos;t lose context. Your track, portfolio, experience and
          answers are included automatically.
        </Card.Description>
      </Card.Header>
      <Card.Content className="flex flex-col gap-3">
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
      </Card.Content>
      <Card.Footer className="items-center gap-3">
        <Button
          isDisabled={!dirty}
          isPending={saving}
          onPress={async () => {
            setSaving(true);
            try {
              await onSave(value.trim());
              toast("Instructions saved", { description: "Every model will follow them from the next request.", variant: "success" });
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
      </Card.Footer>
    </Card>
  );
}
