"use client";

import { ArrowsClockwise, CheckCircle, CircleNotch, Globe, PencilSimple, Plus, Trash, WarningCircle } from "@phosphor-icons/react";
import { Button, Card, Chip, Input, Label, Skeleton, TextArea, TextField, toast } from "@heroui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES, SEED_QUESTIONS, TRACKS, inTrack, type Track } from "@/lib/seed-questions";
import { api, sb } from "@/lib/supabase";
import type { Answer } from "@/lib/types";

const HINTS = Object.fromEntries(SEED_QUESTIONS.map((q) => [q.key, q.hint ?? ""]));
type SaveState = "saving" | "saved" | "error";
type ProfileRow = {
  track: Track;
  portfolio_url: string | null;
  portfolio_pages: { url: string; title: string }[] | null;
  portfolio_fetched_at: string | null;
  portfolio_text: string | null;
};

export default function ProfilePage() {
  const [rows, setRows] = useState<Answer[] | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [status, setStatus] = useState<Record<string, SaveState>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [newQ, setNewQ] = useState("");
  const [uid, setUid] = useState("");

  useEffect(() => {
    (async () => {
      const db = sb();
      const { data: u } = await db.auth.getUser();
      const userId = u.user!.id;
      setUid(userId);
      const [{ data }, { data: prof }] = await Promise.all([
        db.from("answers").select("*").order("sort"),
        db.from("profiles").select("track,portfolio_url,portfolio_pages,portfolio_fetched_at,portfolio_text").maybeSingle(),
      ]);
      setProfile((prof as ProfileRow) ?? { track: "product_designer", portfolio_url: "", portfolio_pages: null, portfolio_fetched_at: null, portfolio_text: null });
      const have = new Set((data ?? []).map((a) => a.key));
      const missing = SEED_QUESTIONS.filter((q) => !have.has(q.key));
      if (missing.length) {
        const { error } = await db.from("answers").upsert(
          missing.map((q) => ({
            user_id: userId,
            key: q.key,
            category: q.category,
            question: q.question,
            aliases: q.aliases,
            long_form: Boolean(q.long_form),
            sort: SEED_QUESTIONS.indexOf(q),
          })),
          { onConflict: "user_id,key", ignoreDuplicates: true },
        );
        if (error) toast("Couldn't prepare your questions", { description: error.message, variant: "danger" });
        const again = await db.from("answers").select("*").order("sort");
        setRows((again.data as Answer[]) ?? []);
      } else {
        setRows((data as Answer[]) ?? []);
      }
    })();
  }, []);

  function update(id: string, patch: Partial<Answer>) {
    setRows((rs) => rs?.map((r) => (r.id === id ? { ...r, ...patch } : r)) ?? null);
    setStatus((s) => ({ ...s, [id]: "saving" }));
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(async () => {
      const { error } = await sb().from("answers").update(patch).eq("id", id);
      setStatus((s) => ({ ...s, [id]: error ? "error" : "saved" }));
      if (error) toast("Couldn't save that answer", { description: error.message, variant: "danger" });
    }, 600);
  }

  async function setTrack(track: Track) {
    setProfile((p) => (p ? { ...p, track } : p));
    const { error } = await sb().from("profiles").upsert({ user_id: uid, track }, { onConflict: "user_id" });
    if (error) toast("Couldn't save your track", { description: error.message, variant: "danger" });
    else toast(`Showing ${TRACKS.find((t) => t.id === track)?.label} questions`, { variant: "success" });
  }

  async function addCustom() {
    const question = newQ.trim();
    if (!question) return;
    const key = `custom_${question.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40)}_${Date.now().toString(36)}`;
    const words = question.toLowerCase().replace(/[?*:]/g, "").trim();
    const { data, error } = await sb()
      .from("answers")
      .insert({ user_id: uid, key, category: "other", question, aliases: [words], sort: 1000 + (rows?.length ?? 0) })
      .select()
      .single();
    if (error) return toast("Couldn't add that question", { description: error.message, variant: "danger" });
    setRows((rs) => [...(rs ?? []), data as Answer]);
    setNewQ("");
    toast("Question added", { description: "Type your answer below it.", variant: "success" });
  }

  async function remove(id: string) {
    setRows((rs) => rs?.filter((r) => r.id !== id) ?? null);
    const { error } = await sb().from("answers").delete().eq("id", id);
    if (error) toast("Couldn't delete", { description: error.message, variant: "danger" });
  }

  const track = profile?.track ?? "product_designer";
  const visible = useMemo(() => (rows ?? []).filter((r) => inTrack(r.key, track)), [rows, track]);
  const answered = visible.filter((r) => r.answer.trim()).length;
  const pct = visible.length ? Math.round((answered / visible.length) * 100) : 0;
  const grouped = useMemo(() => {
    const g: Record<string, Answer[]> = {};
    visible.forEach((r) => (g[r.category] ??= []).push(r));
    return g;
  }, [visible]);
  const portfolioRow = rows?.find((r) => r.key === "portfolio");
  const pending = Object.values(status).some((s) => s === "saving");

  return (
    <div className="space-y-6">
      {/* Header: title + byline left, progress right */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-xl space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
          <p className="text-sm text-muted">
            Your answers fill job application forms automatically. Everything is saved to your account as you type.
          </p>
          <p className="flex items-center gap-1.5 text-xs text-muted" aria-live="polite">
            {pending ? (
              <>
                <CircleNotch className="size-3.5 animate-spin" /> Saving…
              </>
            ) : (
              <>
                <CheckCircle className="size-3.5 text-success" /> All changes saved
              </>
            )}
          </p>
        </div>
        {rows && (
          <div className="w-full shrink-0 rounded-2xl border border-separator bg-surface p-4 sm:w-64">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-semibold tabular-nums">{pct}%</span>
              <span className="text-xs text-muted tabular-nums">
                {answered} of {visible.length} answered
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-default">
              <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </div>

      {!rows || !profile ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : (
        <>
          {/* Track */}
          <Card className="gap-3">
            <Card.Header>
              <Card.Title>What roles are you applying for?</Card.Title>
              <Card.Description>Each track asks for different things. Switching keeps all your answers.</Card.Description>
            </Card.Header>
            <Card.Content className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" role="radiogroup" aria-label="Career track">
              {TRACKS.map((t) => {
                const on = t.id === track;
                return (
                  <button
                    key={t.id}
                    role="radio"
                    aria-checked={on}
                    onClick={() => !on && setTrack(t.id)}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      on ? "border-accent bg-accent/5" : "border-separator hover:border-[var(--field-border-hover)]"
                    }`}
                  >
                    <span className="flex items-center justify-between text-sm font-medium">
                      {t.label}
                      {on && <CheckCircle className="size-4 text-accent" />}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted">{t.blurb}</span>
                  </button>
                );
              })}
            </Card.Content>
          </Card>

          {/* Portfolio */}
          {portfolioRow && (
            <PortfolioCard
              value={portfolioRow.answer}
              onChange={(v) => update(portfolioRow.id, { answer: v })}
              profile={profile}
              onRead={(p) => setProfile((x) => (x ? { ...x, ...p } : x))}
              emphasise={track === "product_designer"}
            />
          )}

          {/* Questions */}
          {CATEGORIES.filter((c) => grouped[c.id]?.length || c.id === "other").map((c) => {
            const list = (grouped[c.id] ?? []).filter((r) => r.key !== "portfolio");
            const done = list.filter((r) => r.answer.trim()).length;
            return (
              <Card key={c.id} className="gap-4">
                <Card.Header className="flex-row items-center justify-between">
                  <Card.Title>{c.label}</Card.Title>
                  <Chip size="sm" variant="soft" color={list.length && done === list.length ? "success" : "default"}>
                    {done}/{list.length}
                  </Chip>
                </Card.Header>
                <Card.Content className="grid gap-x-6 gap-y-5 md:grid-cols-2">
                  {list.map((r) => (
                    <QuestionField
                      key={r.id}
                      r={r}
                      state={status[r.id]}
                      onAnswer={(v) => update(r.id, { answer: v })}
                      onAliases={(aliases) => update(r.id, { aliases })}
                      onDelete={r.key.startsWith("custom_") ? () => remove(r.id) : undefined}
                    />
                  ))}
                  {c.id === "other" && (
                    <div className="flex items-end gap-2 md:col-span-2">
                      <TextField className="flex-1" value={newQ} onChange={setNewQ}>
                        <Label>Add a question you keep seeing</Label>
                        <Input placeholder="e.g. Are you comfortable with a design exercise?" onKeyDown={(e) => e.key === "Enter" && addCustom()} />
                      </TextField>
                      <Button variant="secondary" onPress={addCustom} isDisabled={!newQ.trim()}>
                        <Plus className="size-4" /> Add
                      </Button>
                    </div>
                  )}
                </Card.Content>
              </Card>
            );
          })}
        </>
      )}
    </div>
  );
}

function SaveMark({ state }: { state?: SaveState }) {
  if (state === "saving") return <span className="text-xs font-normal text-muted">Saving…</span>;
  if (state === "saved")
    return (
      <span className="flex items-center gap-1 text-xs font-normal text-success">
        <CheckCircle className="size-3.5" /> Saved
      </span>
    );
  if (state === "error")
    return (
      <span className="flex items-center gap-1 text-xs font-normal text-danger">
        <WarningCircle className="size-3.5" /> Not saved
      </span>
    );
  return null;
}

function QuestionField({
  r,
  state,
  onAnswer,
  onAliases,
  onDelete,
}: {
  r: Answer;
  state?: SaveState;
  onAnswer: (v: string) => void;
  onAliases: (a: string[]) => void;
  onDelete?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(r.aliases.join(", "));
  return (
    <div className={r.long_form ? "md:col-span-2" : ""}>
      <TextField value={r.answer} onChange={onAnswer}>
        <Label className="flex items-center justify-between gap-2">
          <span>{r.question}</span>
          <SaveMark state={state} />
        </Label>
        {r.long_form ? <TextArea rows={4} placeholder={HINTS[r.key] || "Your answer"} /> : <Input placeholder={HINTS[r.key] || "Your answer"} />}
      </TextField>
      <div className="mt-1.5 flex items-center gap-2 text-xs text-muted">
        {editing ? (
          <>
            <input
              autoFocus
              className="field-native min-w-0 flex-1 px-2 py-1 text-xs text-foreground"
              aria-label={`Phrases that identify "${r.question}" on forms`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              onBlur={() => {
                const aliases = draft.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
                if (aliases.join() !== r.aliases.join()) onAliases(aliases);
                setEditing(false);
              }}
            />
          </>
        ) : (
          <>
            <span className="min-w-0 flex-1 truncate" title={r.aliases.join(", ")}>
              Autofill matches: {r.aliases.slice(0, 4).join(", ")}
              {r.aliases.length > 4 ? ` +${r.aliases.length - 4}` : ""}
            </span>
            <button className="inline-flex items-center gap-1 text-accent hover:underline" onClick={() => setEditing(true)}>
              <PencilSimple className="size-3" /> Edit
            </button>
          </>
        )}
        {onDelete && (
          <button className="inline-flex items-center gap-1 text-danger hover:underline" onClick={onDelete} aria-label="Delete question">
            <Trash className="size-3" />
          </button>
        )}
      </div>
    </div>
  );
}

function PortfolioCard({
  value,
  onChange,
  profile,
  onRead,
  emphasise,
}: {
  value: string;
  onChange: (v: string) => void;
  profile: ProfileRow;
  onRead: (p: Partial<ProfileRow>) => void;
  emphasise: boolean;
}) {
  const [reading, setReading] = useState(false);
  const [note, setNote] = useState<{ tone: "ok" | "warn" | "err"; text: string } | null>(null);
  const lastRead = useRef(profile.portfolio_url ?? "");

  async function read(url = value) {
    const clean = url.trim();
    if (!clean) return;
    setReading(true);
    setNote(null);
    try {
      const r = await api<{ pages: { url: string; title: string }[]; chars: number; thin?: boolean }>("/api/profile/portfolio", { url: clean });
      lastRead.current = clean;
      onRead({ portfolio_url: clean, portfolio_pages: r.pages, portfolio_fetched_at: new Date().toISOString() });
      setNote(
        r.thin
          ? { tone: "warn", text: "Read the site but found very little text. If it's built in Framer/Notion with images only, add short project descriptions on each page." }
          : { tone: "ok", text: `Read ${r.pages.length} page${r.pages.length === 1 ? "" : "s"} (${r.chars.toLocaleString()} characters). The AI will reference these projects.` },
      );
    } catch (e) {
      setNote({ tone: "err", text: (e as Error).message });
    } finally {
      setReading(false);
    }
  }

  const pages = profile.portfolio_pages ?? [];
  return (
    <Card className={`gap-4 ${emphasise ? "border border-accent/30" : ""}`}>
      <Card.Header className="flex-row items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
          <Globe className="size-5" />
        </span>
        <div>
          <Card.Title>Portfolio</Card.Title>
          <Card.Description>
            Paste your portfolio link. The app reads your case studies automatically so every AI model can mention your real
            projects in tailored bullets and answers.
          </Card.Description>
        </div>
      </Card.Header>
      <Card.Content className="flex flex-col gap-3">
        <div className="flex items-end gap-2">
          <TextField className="min-w-0 flex-1" value={value} onChange={onChange} type="url">
            <Label>Portfolio URL</Label>
            <Input
              placeholder="https://yourname.design"
              onBlur={() => value.trim() && value.trim() !== lastRead.current && read()}
            />
          </TextField>
          <Button variant="secondary" className="shrink-0" onPress={() => read()} isPending={reading} isDisabled={!value.trim()}>
            {reading ? <CircleNotch className="size-4 animate-spin" /> : <ArrowsClockwise className="size-4" />}
            {pages.length ? "Read again" : "Read portfolio"}
          </Button>
        </div>
        {reading && <p className="text-sm text-muted">Reading your portfolio and its case studies…</p>}
        {note && (
          <p className={`text-sm ${note.tone === "ok" ? "text-success" : note.tone === "warn" ? "text-warning" : "text-danger"}`}>{note.text}</p>
        )}
        {!note && pages.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted">
              Pages the AI knows about
              {profile.portfolio_fetched_at ? ` · read ${new Date(profile.portfolio_fetched_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {pages.slice(0, 9).map((p) => (
                <a key={p.url} href={p.url} target="_blank" rel="noopener noreferrer">
                  <Chip size="sm" variant="soft">
                    {p.title.slice(0, 40) || p.url}
                  </Chip>
                </a>
              ))}
            </div>
          </div>
        )}
      </Card.Content>
    </Card>
  );
}
