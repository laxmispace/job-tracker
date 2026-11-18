"use client";

import {
  ArrowsClockwise,
  Briefcase,
  ChatCircleText,
  CheckCircle,
  CircleNotch,
  Globe,
  GraduationCap,
  IdentificationCard,
  Laptop,
  Link as LinkIcon,
  ListChecks,
  PaintBrush,
  Plus,
  PlusCircle,
  ShieldCheck,
  SlidersHorizontal,
  Trash,
  UsersThree,
  WarningCircle,
  X,
  type Icon,
} from "@phosphor-icons/react";
import { Button, Chip, Input, Label, Skeleton, TextArea, TextField, toast } from "@heroui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES, RETIRED_KEYS, SEED_QUESTIONS } from "@/lib/seed-questions";
import Panel from "@/components/Panel";
import { api, sb } from "@/lib/supabase";
import type { Answer } from "@/lib/types";

const CATEGORY_ICON: Record<string, Icon> = {
  personal: IdentificationCard,
  links: LinkIcon,
  craft: PaintBrush,
  work: Briefcase,
  preferences: SlidersHorizontal,
  education: GraduationCap,
  authorization: ShieldCheck,
  screening: ListChecks,
  eeo: UsersThree,
  long: ChatCircleText,
  other: PlusCircle,
};

const SEED = Object.fromEntries(SEED_QUESTIONS.map((q) => [q.key, q]));
type SaveState = "saving" | "saved" | "error";
type ProfileRow = {
  portfolio_url: string | null;
  portfolio_pages: { url: string; title: string }[] | null;
  portfolio_fetched_at: string | null;
};

function readTipDismissed() {
  try {
    return localStorage.getItem("jt-profile-tip") === "1";
  } catch {
    return false;
  }
}

export default function ProfilePage() {
  const [rows, setRows] = useState<Answer[] | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [status, setStatus] = useState<Record<string, SaveState>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [phrases, setPhrases] = useState<Record<string, boolean>>({});
  const [tipHidden, setTipHidden] = useState(true);
  const [newQ, setNewQ] = useState("");
  const [uid, setUid] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read a per-device preference once
    setTipHidden(readTipDismissed());
    (async () => {
      const db = sb();
      const { data: u } = await db.auth.getUser();
      const userId = u.user!.id;
      setUid(userId);
      const [{ data }, { data: prof }] = await Promise.all([
        db.from("answers").select("*").order("sort"),
        db.from("profiles").select("portfolio_url,portfolio_pages,portfolio_fetched_at").maybeSingle(),
      ]);
      setProfile((prof as ProfileRow) ?? { portfolio_url: "", portfolio_pages: null, portfolio_fetched_at: null });
      const have = new Set((data ?? []).map((a) => a.key));
      const missing = SEED_QUESTIONS.filter((q) => !have.has(q.key));
      let list = (data as Answer[]) ?? [];
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
        list = ((await db.from("answers").select("*").order("sort")).data as Answer[]) ?? [];
      }
      setRows(list);
      // Open the first section that still has blanks
      const firstGap = CATEGORIES.find((c) =>
        list.some((r) => !RETIRED_KEYS.has(r.key) && (SEED[r.key]?.category ?? r.category) === c.id && !r.answer.trim()),
      );
      setOpen({ [firstGap?.id ?? "personal"]: true });
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

  async function addCustom() {
    const question = newQ.trim();
    if (!question) return;
    const key = `custom_${question.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40)}_${Date.now().toString(36)}`;
    const { data, error } = await sb()
      .from("answers")
      .insert({ user_id: uid, key, category: "other", question, aliases: [question.toLowerCase().replace(/[?*:]/g, "").trim()], sort: 1000 + (rows?.length ?? 0) })
      .select()
      .single();
    if (error) return toast("Couldn't add that question", { description: error.message, variant: "danger" });
    setRows((rs) => [...(rs ?? []), data as Answer]);
    setNewQ("");
    toast("Question added", { variant: "success" });
  }

  async function remove(id: string) {
    setRows((rs) => rs?.filter((r) => r.id !== id) ?? null);
    const { error } = await sb().from("answers").delete().eq("id", id);
    if (error) toast("Couldn't delete", { description: error.message, variant: "danger" });
  }

  const visible = useMemo(() => (rows ?? []).filter((r) => !RETIRED_KEYS.has(r.key) && r.key !== "portfolio"), [rows]);
  const answered = visible.filter((r) => r.answer.trim()).length;
  const pct = visible.length ? Math.round((answered / visible.length) * 100) : 0;
  const grouped = useMemo(() => {
    const g: Record<string, Answer[]> = {};
    visible.forEach((r) => (g[SEED[r.key]?.category ?? r.category] ??= []).push(r));
    return g;
  }, [visible]);
  const portfolioRow = rows?.find((r) => r.key === "portfolio");

  return (
    <div className="space-y-4">
      {/* Header: title + byline left, progress right */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
          <p className="text-sm text-muted">Your answers fill job application forms for you. Fill a section at a time; it all saves as you type.</p>
        </div>
        {rows && (
          <div className="w-full shrink-0 rounded-2xl border border-separator bg-surface px-4 py-3 sm:w-60">
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-semibold tabular-nums">{pct}%</span>
              <span className="text-xs text-muted tabular-nums">
                {answered} of {visible.length} answered
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-default" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Profile completion">
              <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Phone tip */}
      {!tipHidden && (
        <div className="flex items-start gap-3 rounded-2xl border border-separator bg-surface p-3 text-sm md:hidden">
          <Laptop className="mt-0.5 size-5 shrink-0 text-accent" />
          <p className="flex-1 text-muted">
            <span className="font-medium text-foreground">Tip:</span> this is a long form, so it&apos;s quicker on a laptop. Everything saves as you go, so
            you can stop and continue anywhere.
          </p>
          <button
            aria-label="Dismiss tip"
            className="rounded-md p-1 text-muted hover:text-foreground"
            onClick={() => {
              setTipHidden(true);
              try {
                localStorage.setItem("jt-profile-tip", "1");
              } catch {}
            }}
          >
            <X weight="bold" className="size-4" />
          </button>
        </div>
      )}

      {!rows || !profile ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : (
        <>
          {portfolioRow && (
            <PortfolioCard
              value={portfolioRow.answer}
              onChange={(v) => update(portfolioRow.id, { answer: v })}
              profile={profile}
              onRead={(p) => setProfile((x) => (x ? { ...x, ...p } : x))}
            />
          )}

          {CATEGORIES.filter((c) => grouped[c.id]?.length || c.id === "other").map((c) => {
            const list = grouped[c.id] ?? [];
            const done = list.filter((r) => r.answer.trim()).length;
            const isOpen = Boolean(open[c.id]);
            const st = list.map((r) => status[r.id]);
            const sectionState = st.includes("saving") ? "saving" : st.includes("error") ? "error" : st.includes("saved") ? "saved" : null;
            return (
              <Panel
                key={c.id}
                icon={CATEGORY_ICON[c.id] ?? PlusCircle}
                title={c.label}
                open={isOpen}
                onToggle={() => setOpen((o) => ({ ...o, [c.id]: !o[c.id] }))}
                bodyClassName=""
                meta={
                  list.length > 0 ? (
                    done === list.length ? (
                      <span className="flex items-center gap-1 text-success">
                        <CheckCircle className="size-3.5" /> Done
                      </span>
                    ) : (
                      `${done} of ${list.length}`
                    )
                  ) : null
                }
              >
                  <>
                    <div className="grid grid-cols-1 gap-x-5 gap-y-4 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-3">
                      {list.map((r) => (
                        <QuestionField
                          key={r.id}
                          r={r}
                          state={status[r.id]}
                          phrases={Boolean(phrases[c.id])}
                          onAnswer={(v) => update(r.id, { answer: v })}
                          onAliases={(aliases) => update(r.id, { aliases })}
                          onDelete={r.key.startsWith("custom_") ? () => remove(r.id) : undefined}
                        />
                      ))}
                      {c.id === "other" && (
                        <div className="col-span-full flex items-end gap-2">
                          <TextField className="flex-1" value={newQ} onChange={setNewQ}>
                            <Label>Add a question you keep seeing</Label>
                            <Input placeholder="e.g. Are you comfortable with a design exercise?" onKeyDown={(e) => e.key === "Enter" && addCustom()} />
                          </TextField>
                          <Button variant="secondary" onPress={addCustom} isDisabled={!newQ.trim()}>
                            <Plus className="size-4" /> Add
                          </Button>
                        </div>
                      )}
                    </div>
                    {list.length > 0 && (
                      <div className="flex items-center justify-between gap-3 px-4 pb-4 text-xs sm:px-5" aria-live="polite">
                        <span className="flex items-center gap-1.5 text-muted">
                          {sectionState === "saving" && (
                            <>
                              <CircleNotch className="size-3.5 animate-spin" /> Saving…
                            </>
                          )}
                          {sectionState === "saved" && (
                            <>
                              <CheckCircle className="size-3.5 text-success" /> All changes saved
                            </>
                          )}
                          {sectionState === "error" && (
                            <span className="flex items-center gap-1.5 text-danger">
                              <WarningCircle className="size-3.5" /> Some answers didn&apos;t save. Edit them again.
                            </span>
                          )}
                          {!sectionState && "Saves as you type"}
                        </span>
                        <button
                          className="text-accent hover:underline"
                          onClick={() => setPhrases((p) => ({ ...p, [c.id]: !p[c.id] }))}
                          title="The wording the Chrome extension looks for on job forms to recognise each question"
                        >
                          {phrases[c.id] ? "Hide form wording" : "Edit form wording"}
                        </button>
                      </div>
                    )}
                  </>
              </Panel>
            );
          })}
        </>
      )}
    </div>
  );
}

function QuestionField({
  r,
  state,
  phrases,
  onAnswer,
  onAliases,
  onDelete,
}: {
  r: Answer;
  state?: SaveState;
  phrases: boolean;
  onAnswer: (v: string) => void;
  onAliases: (a: string[]) => void;
  onDelete?: () => void;
}) {
  const seed = SEED[r.key];
  const question = seed?.question ?? r.question;
  const raw = seed?.hint ?? "";
  // Show examples as examples, so they never look like a saved answer.
  const hint = raw && !/^(e\.g\.|only|or:)/i.test(raw) ? `e.g. ${raw}` : raw;
  const long = seed?.long_form ?? r.long_form;
  const [draft, setDraft] = useState(r.aliases.join(", "));
  const mark =
    state === "saved" ? (
      <CheckCircle className="size-4 text-success" aria-label="Saved" />
    ) : state === "saving" ? (
      <CircleNotch className="size-4 animate-spin text-muted" aria-label="Saving" />
    ) : state === "error" ? (
      <WarningCircle className="size-4 text-danger" aria-label="Not saved" />
    ) : null;
  return (
    <div className={long ? "col-span-full" : ""}>
      <TextField value={r.answer} onChange={onAnswer}>
        <Label className="flex items-center justify-between gap-2">
          <span>{question}</span>
          {onDelete && (
            <button type="button" className="text-muted hover:text-danger" onClick={onDelete} aria-label="Delete this question">
              <Trash className="size-3.5" />
            </button>
          )}
        </Label>
        <div className="relative">
          {long ? (
            <TextArea rows={4} placeholder={hint || "Your answer"} className="w-full pr-9" />
          ) : (
            <Input placeholder={hint || "Your answer"} className="w-full pr-9" />
          )}
          {mark && <span className={`pointer-events-none absolute right-3 ${long ? "top-3" : "top-1/2 -translate-y-1/2"}`}>{mark}</span>}
        </div>
      </TextField>
      {phrases && (
        <input
          className="field-native mt-2 w-full px-2.5 py-1.5 text-xs text-foreground"
          aria-label={`How job forms word "${question}"`}
          placeholder="Wordings forms use, comma-separated"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const aliases = draft.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
            if (aliases.join() !== r.aliases.join()) onAliases(aliases);
          }}
        />
      )}
    </div>
  );
}

function PortfolioCard({
  value,
  onChange,
  profile,
  onRead,
}: {
  value: string;
  onChange: (v: string) => void;
  profile: ProfileRow;
  onRead: (p: Partial<ProfileRow>) => void;
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
          ? { tone: "warn", text: "Found very little text. If your case studies are mostly images, add a short description to each page." }
          : { tone: "ok", text: `Read ${r.pages.length} page${r.pages.length === 1 ? "" : "s"}. Every AI model can now refer to these projects.` },
      );
    } catch (e) {
      setNote({ tone: "err", text: (e as Error).message });
    } finally {
      setReading(false);
    }
  }

  const pages = profile.portfolio_pages ?? [];
  return (
    <Panel
      icon={Globe}
      title="Portfolio"
      description="The app reads your case studies so every AI model can mention your real projects."
      bodyClassName="space-y-3 p-4 sm:p-5"
    >
      <div className="flex items-center gap-2">
        <TextField className="min-w-0 flex-1" value={value} onChange={onChange} type="url" aria-label="Portfolio URL">
          <Input placeholder="https://yourname.design" onBlur={() => value.trim() && value.trim() !== lastRead.current && read()} />
        </TextField>
        <Button variant="secondary" className="shrink-0" onPress={() => read()} isPending={reading} isDisabled={!value.trim()}>
          {reading ? <CircleNotch className="size-4 animate-spin" /> : <ArrowsClockwise className="size-4" />}
          <span className="hidden sm:inline">{pages.length ? "Read again" : "Read portfolio"}</span>
        </Button>
      </div>
      {reading && <p className="text-sm text-muted">Reading your portfolio and its case studies…</p>}
      {note && <p className={`text-sm ${note.tone === "ok" ? "text-success" : note.tone === "warn" ? "text-warning" : "text-danger"}`}>{note.text}</p>}
      {!note && pages.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {pages.slice(0, 8).map((p) => (
            <a key={p.url} href={p.url} target="_blank" rel="noopener noreferrer">
              <Chip size="sm" variant="soft">
                {p.title.slice(0, 36) || p.url}
              </Chip>
            </a>
          ))}
        </div>
      )}
    </Panel>
  );
}
