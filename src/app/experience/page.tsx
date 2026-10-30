"use client";

import { ArrowDown, ArrowUp, Check, FileArrowUp, MagicWand, Plus, TrashBin } from "@gravity-ui/icons";
import {
  Button,
  Card,
  Description,
  Input,
  Label,
  Modal,
  Skeleton,
  Spinner,
  TextArea,
  TextField,
  toast,
} from "@heroui/react";
import { useEffect, useRef, useState } from "react";
import { api, sb } from "@/lib/supabase";
import type { Experience } from "@/lib/types";

type ResumeFile = { name: string; updated_at: string | null };

export default function ExperiencePage() {
  const [rows, setRows] = useState<Experience[] | null>(null);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [resume, setResume] = useState<ResumeFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uid, setUid] = useState("");

  useEffect(() => {
    (async () => {
      const { data: u } = await sb().auth.getUser();
      setUid(u.user!.id);
      const { data } = await sb().from("experiences").select("*").order("sort");
      setRows((data as Experience[]) ?? []);
      const files = await sb().storage.from("resumes").list(u.user!.id, { limit: 10 });
      const pdf = files.data?.find((f) => f.name !== ".emptyFolderPlaceholder");
      if (pdf) setResume({ name: pdf.name, updated_at: pdf.updated_at });
    })();
  }, []);

  function update(id: string, patch: Partial<Experience>) {
    setRows((rs) => rs?.map((r) => (r.id === id ? { ...r, ...patch } : r)) ?? null);
    setSaved((s) => ({ ...s, [id]: false }));
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(async () => {
      const { error } = await sb().from("experiences").update(patch).eq("id", id);
      if (error) toast("Couldn't save", { description: error.message, variant: "danger" });
      else setSaved((s) => ({ ...s, [id]: true }));
    }, 600);
  }

  async function add(prefill: Partial<Experience> = {}, at = rows?.length ?? 0) {
    const { data, error } = await sb()
      .from("experiences")
      .insert({ user_id: uid, sort: at, ...prefill })
      .select()
      .single();
    if (error) {
      toast("Couldn't add", { description: error.message, variant: "danger" });
      return null;
    }
    return data as Experience;
  }

  async function remove(id: string) {
    if (!confirm("Delete this role?")) return;
    setRows((rs) => rs?.filter((r) => r.id !== id) ?? null);
    await sb().from("experiences").delete().eq("id", id);
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

  async function runImport() {
    setImporting(true);
    try {
      const { experiences } = await api<{
        experiences: (Omit<Partial<Experience>, "bullets"> & { bullets: string[] })[];
      }>("/api/ai/import-experience", { text: importText });
      const base = rows?.length ?? 0;
      const created: Experience[] = [];
      for (const [i, e] of experiences.entries()) {
        const row = await add(
          {
            company: e.company ?? "",
            title: e.title ?? "",
            location: e.location ?? "",
            start_date: e.start_date ?? "",
            end_date: e.end_date ?? "",
            skills: e.skills ?? "",
            bullets: (e.bullets ?? []).join("\n"),
          },
          base + i,
        );
        if (row) created.push(row);
      }
      setRows((rs) => [...(rs ?? []), ...created]);
      setImportOpen(false);
      setImportText("");
      toast(`Imported ${created.length} roles — check them below`, { variant: "success" });
    } catch (e) {
      toast("Import failed", { description: (e as Error).message, variant: "danger" });
    } finally {
      setImporting(false);
    }
  }

  async function uploadResume(file: File) {
    if (file.size > 5 * 1024 * 1024) return toast("Keep the resume under 5 MB", { variant: "danger" });
    setUploading(true);
    const old = await sb().storage.from("resumes").list(uid);
    const stale = (old.data ?? []).map((f) => `${uid}/${f.name}`);
    if (stale.length) await sb().storage.from("resumes").remove(stale);
    const clean = file.name.replace(/[^\w.\- ]+/g, "_");
    const { error } = await sb().storage.from("resumes").upload(`${uid}/${clean}`, file, { upsert: true, contentType: file.type });
    setUploading(false);
    if (error) return toast("Upload failed", { description: error.message, variant: "danger" });
    setResume({ name: clean, updated_at: new Date().toISOString() });
    toast("Resume uploaded — the extension will attach it to forms", { variant: "success" });
  }

  async function openResume() {
    if (!resume) return;
    const { data } = await sb().storage.from("resumes").createSignedUrl(`${uid}/${resume.name}`, 60);
    if (data) window.open(data.signedUrl, "_blank");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Experience</h1>
          <p className="max-w-2xl text-sm text-muted">
            Your master copy. AI tailoring rephrases these bullets per job — it never adds things that aren&apos;t here, so be
            complete. One achievement per line.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onPress={() => setImportOpen(true)}>
            <MagicWand className="size-4" /> Import from resume
          </Button>
          <Button
            onPress={async () => {
              const r = await add();
              if (r) setRows((rs) => [...(rs ?? []), r]);
            }}
          >
            <Plus className="size-4" /> Add role
          </Button>
        </div>
      </div>

      <Card className="flex-row flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent-soft-foreground">
            <FileArrowUp className="size-5" />
          </span>
          <div>
            <p className="text-sm font-medium">Resume file</p>
            <p className="text-xs text-muted">
              {resume ? (
                <button className="text-accent hover:underline" onClick={openResume}>
                  {resume.name}
                </button>
              ) : (
                "PDF the extension attaches to “Upload resume” fields"
              )}
            </p>
          </div>
        </div>
        <label className="cursor-pointer">
          <input
            type="file"
            accept=".pdf,.doc,.docx"
            className="sr-only"
            onChange={(e) => e.target.files?.[0] && uploadResume(e.target.files[0])}
          />
          <span className="inline-flex h-9 items-center gap-2 rounded-full bg-default px-4 text-sm font-medium hover:bg-default-hover">
            {uploading && <Spinner size="sm" />}
            {resume ? "Replace" : "Upload"}
          </span>
        </label>
      </Card>

      {!rows && <Skeleton className="h-72 rounded-2xl" />}
      {rows?.length === 0 && (
        <Card className="items-center py-10 text-center">
          <Card.Title>No roles yet</Card.Title>
          <Card.Description>Import from your resume text or add roles one by one.</Card.Description>
        </Card>
      )}

      {rows?.map((r, i) => (
        <Card key={r.id} className="gap-4">
          <Card.Header className="flex-row items-center justify-between">
            <Card.Title className="flex items-center gap-2">
              {r.title || "New role"}
              {r.company ? <span className="font-normal text-muted">· {r.company}</span> : null}
              {saved[r.id] && <Check className="size-4 text-success" />}
            </Card.Title>
            <div className="flex">
              <Button size="sm" variant="ghost" isIconOnly aria-label="Move up" onPress={() => move(i, -1)} isDisabled={i === 0}>
                <ArrowUp className="size-4" />
              </Button>
              <Button size="sm" variant="ghost" isIconOnly aria-label="Move down" onPress={() => move(i, 1)} isDisabled={i === rows.length - 1}>
                <ArrowDown className="size-4" />
              </Button>
              <Button size="sm" variant="ghost" isIconOnly aria-label="Delete role" onPress={() => remove(r.id)}>
                <TrashBin className="size-4" />
              </Button>
            </div>
          </Card.Header>
          <Card.Content className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
              <TextArea rows={6} placeholder={"Redesigned onboarding flow, lifting activation from 32% to 47%\nLed a team of 3 designers…"} />
              <Description>Include numbers, tools and scope — the AI can only use what&apos;s written here.</Description>
            </TextField>
            <TextField className="sm:col-span-2" value={r.skills ?? ""} onChange={(v) => update(r.id, { skills: v })}>
              <Label>Skills / tools used</Label>
              <Input placeholder="Figma, user research, SQL" />
            </TextField>
            <TextField className="sm:col-span-2" value={r.location ?? ""} onChange={(v) => update(r.id, { location: v })}>
              <Label>Location</Label>
              <Input placeholder="Bengaluru" />
            </TextField>
          </Card.Content>
        </Card>
      ))}

      <Modal.Backdrop isOpen={importOpen} onOpenChange={setImportOpen}>
        <Modal.Container size="lg" scroll="inside">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Import from resume</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <TextField value={importText} onChange={setImportText}>
                <Label>Paste your resume&apos;s experience section</Label>
                <TextArea rows={12} placeholder="Copy from your resume PDF or LinkedIn profile and paste here" />
                <Description>AI splits it into roles using your exact wording. Review afterwards.</Description>
              </TextField>
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close" variant="secondary">
                Cancel
              </Button>
              <Button onPress={runImport} isPending={importing} isDisabled={importText.trim().length < 80}>
                {importing ? <Spinner color="current" size="sm" /> : <MagicWand className="size-4" />}
                Import
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
}
