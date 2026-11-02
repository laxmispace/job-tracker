"use client";

import { ArrowUpRightFromSquare, CircleCheck, Sparkles } from "@gravity-ui/icons";
import {
  Button,
  Card,
  Chip,
  ComboBox,
  Description,
  Input,
  Label,
  ListBox,
  Skeleton,
  Spinner,
  Switch,
  toast,
} from "@heroui/react";
import { TextArea, TextField } from "@heroui/react";
import { useState } from "react";
import { useAIPrefs, type ProviderInfo } from "@/lib/ai-prefs";
import { api } from "@/lib/supabase";

type ModelInfo = { id: string; free: boolean };

export default function SettingsPage() {
  const { state, error, setProvider, setModel, setFallback, setInstructions } = useAIPrefs();

  if (error) return <p className="py-10 text-danger">{error}</p>;
  if (!state) return <Skeleton className="h-96 rounded-2xl" />;

  const configured = state.providers.filter((p) => p.configured);
  const missing = state.providers.filter((p) => !p.configured);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">AI settings</h1>
        <p className="max-w-2xl text-sm text-muted">
          Pick which model tailors your experience and drafts answers. Your choice syncs to your phone and the Chrome
          extension. API keys stay on the server — they&apos;re never shown here or sent to your browser.
        </p>
      </div>

      <Card className="flex-row items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Automatic fallback</p>
          <p className="text-xs text-muted">
            If the active model fails or hits its free limit, try your other models in order. The card shows which one answered.
          </p>
        </div>
        <Switch
          isSelected={state.fallback}
          onChange={(v) => setFallback(v).catch((e) => toast("Couldn't save", { description: e.message, variant: "danger" }))}
          aria-label="Automatic fallback"
        >
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch.Content>
        </Switch>
      </Card>

      <InstructionsCard
        key={state.instructions}
        initial={state.instructions}
        skill={state.skill}
        onSave={setInstructions}
      />

      {configured.length === 0 && (
        <Card className="gap-2">
          <Card.Title>No AI keys yet</Card.Title>
          <Card.Description>
            Add at least one key below as an environment variable in Vercel (Project → Settings → Environment Variables), then
            redeploy. Gemini is the easiest free start.
          </Card.Description>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {configured.map((p) => (
          <ProviderCard
            key={p.id}
            p={p}
            active={state.active === p.id}
            onUse={async () => {
              await setProvider(p.id);
              toast(`Now using ${p.label}`, { variant: "success" });
            }}
            onModel={(m) => setModel(p.id, m)}
          />
        ))}
      </div>

      {missing.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted">Not set up yet</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {missing.map((p) => (
              <Card key={p.id} className="gap-2">
                <Card.Header>
                  <Card.Title className="text-base">{p.label}</Card.Title>
                  <Card.Description>{p.note}</Card.Description>
                </Card.Header>
                <Card.Content>
                  <p className="text-xs text-muted">
                    Add <code className="rounded bg-default px-1 py-0.5 text-foreground">{p.keyEnv}</code> in Vercel
                    {p.id === "custom" ? " (plus CUSTOM_API_KEY, CUSTOM_MODEL, CUSTOM_NAME)" : ""} and redeploy.
                  </p>
                </Card.Content>
                {p.signup && (
                  <Card.Footer>
                    <a
                      href={p.signup}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
                    >
                      {p.id === "ollama" ? "Download" : "Get a key"} <ArrowUpRightFromSquare className="size-3.5" />
                    </a>
                  </Card.Footer>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProviderCard({
  p,
  active,
  onUse,
  onModel,
}: {
  p: ProviderInfo;
  active: boolean;
  onUse: () => Promise<void>;
  onModel: (m: string) => Promise<void>;
}) {
  const [models, setModels] = useState<ModelInfo[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
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
    try {
      await onModel(v);
      setResult(null);
    } catch (e) {
      toast("Couldn't save model", { description: (e as Error).message, variant: "danger" });
    }
  }

  async function test() {
    setTesting(true);
    setResult(null);
    try {
      const r = await api<{ ms: number; reply: string; model: string }>("/api/ai/providers", {
        action: "test",
        provider: p.id,
        model: draft || p.model,
      });
      setResult({ ok: true, text: `Works — ${r.model} replied in ${(r.ms / 1000).toFixed(1)}s` });
    } catch (e) {
      setResult({ ok: false, text: (e as Error).message });
    } finally {
      setTesting(false);
    }
  }

  const freeCount = models?.filter((m) => m.free).length ?? 0;

  return (
    <Card className={`gap-4 ${active ? "ring-2 ring-accent" : ""}`}>
      <Card.Header className="flex-row items-start justify-between gap-3">
        <div>
          <Card.Title className="flex items-center gap-2">
            {p.label}
            {active && (
              <Chip size="sm" color="accent" variant="soft">
                <CircleCheck className="size-3" /> Active
              </Chip>
            )}
          </Card.Title>
          <Card.Description>{p.note}</Card.Description>
        </div>
        <Chip size="sm" color="success" variant="soft" className="shrink-0">
          Key added
        </Chip>
      </Card.Header>

      <Card.Content className="flex flex-col gap-2">
        <ComboBox
          allowsCustomValue
          inputValue={draft}
          onInputChange={setDraft}
          onSelectionChange={(k) => {
            if (k == null) return;
            setDraft(String(k));
            void commit(String(k));
          }}
          onOpenChange={(open) => open && loadModels()}
          menuTrigger="focus"
        >
          <Label>Model</Label>
          <ComboBox.InputGroup>
            <Input
              placeholder={p.defaultModel || "Search or type a model id"}
              onBlur={() => commit(draft)}
              onFocus={loadModels}
            />
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
          <Description>
            {loading
              ? "Loading models…"
              : models
                ? `${models.length} models${freeCount ? ` · ${freeCount} free` : ""} — or type any id`
                : p.defaultModel
                  ? `Default: ${p.defaultModel}`
                  : "Open the list to choose a model"}
          </Description>
        </ComboBox>
        {result && <p className={`text-sm ${result.ok ? "text-success" : "text-danger"}`}>{result.text}</p>}
      </Card.Content>

      <Card.Footer className="gap-2">
        {!active && (
          <Button onPress={onUse} isDisabled={!p.model && !draft}>
            <Sparkles className="size-4" /> Use this
          </Button>
        )}
        <Button variant="secondary" onPress={test} isPending={testing} isDisabled={!p.model && !draft}>
          {testing && <Spinner color="current" size="sm" />}
          Test
        </Button>
      </Card.Footer>
    </Card>
  );
}

function InstructionsCard({
  initial,
  skill,
  onSave,
}: {
  initial: string;
  skill: string;
  onSave: (v: string) => Promise<void>;
}) {
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const dirty = value !== initial;
  return (
    <Card className="gap-4">
      <Card.Header>
        <Card.Title>What every model knows</Card.Title>
        <Card.Description>
          Every model gets the same role brief, your instructions and your data on every request. Context lives in the app,
          not inside one model, so switching models mid-task loses nothing.
        </Card.Description>
      </Card.Header>
      <Card.Content className="flex flex-col gap-3">
        <TextField value={value} onChange={setValue}>
          <Label>Your standing instructions</Label>
          <TextArea
            rows={5}
            placeholder={
              "e.g. I'm a product designer moving into fintech. Target roles: Senior / Lead Product Designer in Bengaluru or remote.\nKeep answers under 120 words, confident but not salesy. Always mention my design-systems work where relevant."
            }
          />
          <Description>Your goals, target roles, tone, things to always or never mention. Applied to tailoring, answers, everything.</Description>
        </TextField>
        <details className="rounded-xl border border-separator p-3 text-sm">
          <summary className="cursor-pointer font-medium">View the role brief the app sends to every model</summary>
          <pre className="mt-3 max-h-80 overflow-auto font-sans text-xs leading-relaxed whitespace-pre-wrap text-muted">{skill}</pre>
        </details>
      </Card.Content>
      <Card.Footer>
        <Button
          isDisabled={!dirty}
          isPending={saving}
          onPress={async () => {
            setSaving(true);
            try {
              await onSave(value.trim());
              toast("Instructions saved — every model will follow them", { variant: "success" });
            } catch (e) {
              toast("Couldn't save", { description: (e as Error).message, variant: "danger" });
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving && <Spinner color="current" size="sm" />}
          Save instructions
        </Button>
      </Card.Footer>
    </Card>
  );
}
