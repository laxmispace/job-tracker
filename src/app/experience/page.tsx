"use client";

import { ArrowDown, ArrowUp, CaretDown, CheckCircle, CircleNotch, FileArrowUp, Info, PencilSimple, Plus, Trash, WarningCircle, X } from "@phosphor-icons/react";
import { Button, Card, Description, Input, Label, Skeleton, TextArea, TextField, toast } from "@heroui/react";
import { useEffect, useRef, useState } from "react";
import { api, sb } from "@/lib/supabase";
import type { Experience } from "@/lib/types";

type ResumeFile = { name: string; updated_at: string | null };
type ImportState =
  | { kind: "idle" }
  | { kind: "working"; step: string }
  | { kind: "done"; text: string }
  | { kind: "ask-replace"; existing: number }
  | { kind: "error"; text: string };

export default function ExperiencePage() {
  const [rows, setRows] = useState<Experience[] | null>(null);
  const [saved, setSaved] = useState<Record<string, "saving" | "saved" | "error">>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [resume, setResume] = useState<ResumeFile | null>(null);
  const [imp, setImp] = useState<ImportState>({ kind: "idle" });
  const [adding, setAdding] = useState(false);
  const [openRole, setOpenRole] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [uid, setUid] = useState("");

  async function loadRoles() {
    const { data, error } = await sb().from("experiences").select("*").order("sort");
    if (error) toast("Couldn't load your roles", { description: error.message, variant: "danger" });
    setRows((data as Experience[]) ?? []);
  }

  useEffect(() => {
    (async () => {
      const { data: u } = await sb().auth.getUser();
      setUid(u.user!.id);
      await loadRoles();
      const files = await sb().storage.from("resumes").list(u.user!.id, { limit: 10 });
      const f = files.data?.find((x) => x.name !== ".emptyFolderPlaceholder");
      if (f) setResume({ name: f.name, updated_at: f.updated_at });
    })();
  }, []);

  function update(id: string, patch: Partial<Experience>) {
    setRows((rs) => rs?.map((r) => (r.id === id ? { ...r, ...patch } : r)) ?? null);
    setSaved((s) => ({ ...s, [id]: "saving" }));
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(async () => {
      const { error } = await sb().from("experiences").update(patch).eq("id", id);
      setSaved((s) => ({ ...s, [id]: error ? "error" : "saved" }));
      if (error) toast("Couldn't save", { description: error.message, variant: "danger" });
    }, 600);
  }

  async function addRole() {
    setAdding(true);
    const { data, error } = await sb()
      .from("experiences")
      .insert({ user_id: uid, sort: rows?.length ?? 0 })
      .select()
      .single();
    setAdding(false);
    if (error) return toast("Couldn't add a role", { description: error.message, variant: "danger" });
    setRows((rs) => [...(rs ?? []), data as Experience]);
    setOpenRole((data as Experience).id);
    toast("New role added", { description: "Fill it in below; it saves as you type.", variant: "success" });
    setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }), 50);
  }

  async function remove(id: string) {
    if (!confirm("Delete this role?")) return;
    setRows((rs) => rs?.filter((r) => r.id !== id) ?? null);
    const { error } = await sb().from("experiences").delete().eq("id", id);
    if (error) toast("Couldn't delete", { description: error.message, variant: "danger" });
  }

  async function move(i: number, dir: -1 | 1) {
    if (!rows) return;
    const next = [...rows];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setRows(next);
    await Promise.all(next.map((r, idx) => sb().from("experiences").update({ sort: idx }).eq("id", r.id)));
  }

  async function importFromResume(replace = false) {
    setImp({ kind: "working", step: "Reading your resume and filling in your roles…" });
    try {
      const r = await api<{ created: number; existing?: number; error?: string }>("/api/profile/resume", { replace });
      if (r.error) return setImp({ kind: "error", text: r.error });
      if (r.existing && !replace) return setImp({ kind: "ask-replace", existing: r.existing });
      await loadRoles();
      setImp({ kind: "done", text: `Added ${r.created} role${r.created === 1 ? "" : "s"} from your resume. Check them below.` });
    } catch (e) {
      setImp({ kind: "error", text: (e as Error).message });
    }
  }

  async function uploadResume(file: File) {
    if (file.size > 5 * 1024 * 1024) return toast("Keep the resume under 5 MB", { variant: "danger" });
    setImp({ kind: "working", step: "Uploading your resume…" });
    const old = await sb().storage.from("resumes").list(uid);
    const stale = (old.data ?? []).map((f) => `${uid}/${f.name}`);
    if (stale.length) await sb().storage.from("resumes").remove(stale);
    const clean = file.name.replace(/[^\w.\- ]+/g, "_");
    const { error } = await sb().storage.from("resumes").upload(`${uid}/${clean}`, file, { upsert: true, contentType: file.type });
    if (error) return setImp({ kind: "error", text: `Upload failed: ${error.message}` });
    setResume({ name: clean, updated_at: new Date().toISOString() });
    if (/\.pdf$/i.test(clean)) await importFromResume(false);
    else setImp({ kind: "done", text: "Saved. The extension will attach it to forms. Upload a PDF to fill your roles automatically." });
  }

  async function openResume() {
    if (!resume) return;
    const { data } = await sb().storage.from("resumes").createSignedUrl(`${uid}/${resume.name}`, 60);
    if (data) window.open(data.signedUrl, "_blank");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight">Experience</h1>
          <p className="text-sm text-muted">
            Your master copy of every role. When you tailor for a job, the AI rephrases these bullets with the posting&apos;s
            keywords. It never adds anything that isn&apos;t written here.
          </p>
        </div>
        <Button variant="secondary" onPress={addRole} isPending={adding}>
          {adding ? <CircleNotch className="size-4 animate-spin" /> : <Plus className="size-4" />} Add role
        </Button>
      </div>

      {/* Resume → roles, automatically */}
      <Card className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-accent/10 text-accent">
              <FileArrowUp className="size-5" />
            </span>
            <div>
              <p className="flex items-center gap-1.5 text-sm font-medium">
                Resume
                <button
                  className="text-muted hover:text-foreground"
                  aria-label="What happens when I upload a resume?"
                  aria-expanded={showInfo}
                  onClick={() => setShowInfo((v) => !v)}
                >
                  <Info className="size-4" />
                </button>
              </p>
              <p className="text-xs text-muted">
                {resume ? (
                  <button className="text-accent hover:underline" onClick={openResume}>
                    {resume.name}
                  </button>
                ) : (
                  "PDF, up to 5 MB"
                )}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {resume && /\.pdf$/i.test(resume.name) && (
              <Button size="sm" variant="ghost" onPress={() => importFromResume(false)} isDisabled={imp.kind === "working"}>
                Read again
              </Button>
            )}
            <label className={`cursor-pointer ${imp.kind === "working" ? "pointer-events-none opacity-60" : ""}`}>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void uploadResume(f);
                }}
              />
              <span className="inline-flex h-9 items-center gap-2 rounded-full bg-accent px-4 text-sm font-medium text-accent-foreground hover:opacity-90">
                <FileArrowUp className="size-4" />
                {resume ? "Upload new resume" : "Upload resume"}
              </span>
            </label>
          </div>
        </div>

        {showInfo && (
          <div className="flex items-start gap-2 rounded-xl bg-default/60 p-3 text-sm text-muted">
            <p className="flex-1">
              When you upload a PDF, your roles below fill in automatically from it. The Chrome extension also attaches this file to
              &quot;Upload resume&quot; fields on job forms.
            </p>
            <button aria-label="Close" className="text-muted hover:text-foreground" onClick={() => setShowInfo(false)}>
              <X weight="bold" className="size-4" />
            </button>
          </div>
        )}
        {imp.kind === "working" && (
          <p className="flex items-center gap-2 text-sm text-muted">
            <CircleNotch className="size-4 animate-spin" /> {imp.step}
          </p>
        )}
        {imp.kind === "done" && (
          <p className="flex items-center gap-2 text-sm text-success">
            <CheckCircle className="size-4" /> {imp.text}
          </p>
        )}
        {imp.kind === "error" && (
          <p className="flex items-center gap-2 text-sm text-danger">
            <WarningCircle className="size-4" /> {imp.text}
          </p>
        )}
        {imp.kind === "ask-replace" && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-warning/10 p-3 text-sm">
            <span className="flex-1">
              Resume read. You already have {imp.existing} role{imp.existing === 1 ? "" : "s"} here. Replace them with what&apos;s in the
              resume?
            </span>
            <Button size="sm" variant="secondary" onPress={() => setImp({ kind: "done", text: "Kept your roles. The AI still uses the resume text for context." })}>
              Keep mine
            </Button>
            <Button size="sm" onPress={() => importFromResume(true)}>
              Replace
            </Button>
          </div>
        )}
      </Card>

      <div className="flex items-center gap-3 pt-2">
        <h2 className="text-sm font-medium">Your roles{rows?.length ? ` · ${rows.length}` : ""}</h2>
        <div className="h-px flex-1 bg-separator" />
      </div>

      {!rows && <Skeleton className="h-72 rounded-2xl" />}
      {rows?.length === 0 && imp.kind !== "working" && (
        <Card className="items-center gap-1 py-10 text-center">
          <Card.Title>No roles yet</Card.Title>
          <Card.Description>Upload your resume above, or add a role by hand.</Card.Description>
        </Card>
      )}

      {rows && rows.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-separator bg-surface">
          {rows.map((r, i) => {
            const isOpen = openRole === r.id;
            const lines = r.bullets.split("\n").filter((l) => l.trim()).length;
            const dates = [r.start_date, r.end_date].filter(Boolean).join(" – ");
            return (
              <section key={r.id} className={i ? "border-t border-separator" : ""}>
                <div className="flex items-center gap-2 px-4 py-3 sm:px-5">
                  <button className="min-w-0 flex-1 text-left" aria-expanded={isOpen} onClick={() => setOpenRole(isOpen ? null : r.id)}>
                    <p className="truncate text-sm font-medium">
                      {r.title || "Untitled role"}
                      {r.company ? <span className="font-normal text-muted"> · {r.company}</span> : null}
                    </p>
                    <p className="text-xs text-muted">
                      {dates || "No dates"} · {lines} achievement{lines === 1 ? "" : "s"}
                      {saved[r.id] === "saving" && " · Saving…"}
                      {saved[r.id] === "saved" && " · Saved"}
                    </p>
                  </button>
                  <Button size="sm" variant="ghost" onPress={() => setOpenRole(isOpen ? null : r.id)} aria-expanded={isOpen}>
                    {isOpen ? (
                      <>
                        Done <CaretDown className="size-3.5 rotate-180" />
                      </>
                    ) : (
                      <>
                        <PencilSimple className="size-3.5" /> Edit
                      </>
                    )}
                  </Button>
                </div>
                {isOpen && (
                  <div className="grid gap-4 border-t border-separator px-4 py-4 sm:grid-cols-2 sm:px-5 lg:grid-cols-4">
                    <TextField value={r.title} onChange={(v) => update(r.id, { title: v })}>
                      <Label>Title</Label>
                      <Input placeholder="Product Designer" />
                    </TextField>
                    <TextField value={r.company} onChange={(v) => update(r.id, { company: v })}>
                      <Label>Company</Label>
                      <Input placeholder="Acme" />
                    </TextField>
                    <TextField value={r.start_date ?? ""} onChange={(v) => update(r.id, { start_date: v })}>
                      <Label>Start</Label>
                      <Input placeholder="Jan 2023" />
                    </TextField>
                    <TextField value={r.end_date ?? ""} onChange={(v) => update(r.id, { end_date: v })}>
                      <Label>End</Label>
                      <Input placeholder="Present" />
                    </TextField>
                    <TextField className="sm:col-span-2 lg:col-span-4" value={r.bullets} onChange={(v) => update(r.id, { bullets: v })}>
                      <Label>What you did (one achievement per line)</Label>
                      <TextArea rows={6} placeholder={"Redesigned onboarding, lifting activation from 32% to 47%\nLed a team of 3 designers…"} />
                      <Description>Include numbers, tools and scope. The AI can only use what&apos;s written here.</Description>
                    </TextField>
                    <TextField className="sm:col-span-2" value={r.skills ?? ""} onChange={(v) => update(r.id, { skills: v })}>
                      <Label>Skills / tools used</Label>
                      <Input placeholder="Figma, user research, design systems" />
                    </TextField>
                    <TextField className="sm:col-span-2" value={r.location ?? ""} onChange={(v) => update(r.id, { location: v })}>
                      <Label>Location</Label>
                      <Input placeholder="Bengaluru" />
                    </TextField>
                    <div className="flex items-center gap-1 sm:col-span-2 lg:col-span-4">
                      <Button size="sm" variant="ghost" onPress={() => move(i, -1)} isDisabled={i === 0}>
                        <ArrowUp className="size-4" /> Move up
                      </Button>
                      <Button size="sm" variant="ghost" onPress={() => move(i, 1)} isDisabled={i === rows.length - 1}>
                        <ArrowDown className="size-4" /> Move down
                      </Button>
                      <Button size="sm" variant="ghost" className="ml-auto text-danger" onPress={() => remove(r.id)}>
                        <Trash className="size-4" /> Delete role
                      </Button>
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
