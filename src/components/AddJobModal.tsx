"use client";

import { MagicWand, Plus } from "@phosphor-icons/react";
import { Button, Description, Input, Label, Modal, Spinner, TextArea, TextField, toast } from "@heroui/react";
import { useEffect, useState } from "react";
import { canonicalUrl, detectSource } from "@/lib/job-url";
import { api, sb } from "@/lib/supabase";
import type { Job, Status } from "@/lib/types";
import StatusSelect from "./StatusSelect";

export type JobDraft = {
  url: string;
  title: string;
  company: string;
  location: string;
  status: Status;
  description: string;
  notes: string;
  salary: string;
};

const EMPTY: JobDraft = { url: "", title: "", company: "", location: "", status: "applied", description: "", notes: "", salary: "" };

type FetchResult = Partial<JobDraft> & { fetched?: boolean; reason?: string };

export default function AddJobModal({
  isOpen,
  onOpenChange,
  initial,
  autoFetch,
  onSaved,
}: {
  isOpen: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: Partial<JobDraft>;
  autoFetch?: boolean;
  onSaved: (job: Job) => void;
}) {
  const [d, setD] = useState<JobDraft>({ ...EMPTY, ...initial });
  const [fetching, setFetching] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hint, setHint] = useState("");

  const set = (k: keyof JobDraft) => (v: string) => setD((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (isOpen) {
      const next = { ...EMPTY, ...initial };
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the form each time the modal opens
      setD(next);
      setHint("");
      if (autoFetch && next.url) void fetchDetails(next.url, next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  async function fetchDetails(url = d.url, base = d) {
    if (!/^https?:\/\//i.test(url)) return setHint("Paste a full link starting with https://");
    setFetching(true);
    setHint("");
    try {
      const r = await api<FetchResult>("/api/fetch-job", { url });
      setD({
        ...base,
        url: r.url || url,
        title: base.title || r.title || "",
        company: base.company || r.company || "",
        location: base.location || r.location || "",
        description: base.description || r.description || "",
        salary: base.salary || r.salary || "",
      });
      if (!r.fetched) setHint(`Couldn't read the page (${r.reason}). Fill the fields or paste the job text below and tap "Extract".`);
    } catch (e) {
      setHint((e as Error).message);
    } finally {
      setFetching(false);
    }
  }

  async function extract() {
    setExtracting(true);
    try {
      const r = await api<Partial<JobDraft>>("/api/ai/extract", { text: d.description });
      setD((p) => ({
        ...p,
        title: p.title || r.title || "",
        company: p.company || r.company || "",
        location: p.location || r.location || "",
        salary: p.salary || r.salary || "",
        description: r.description || p.description,
      }));
    } catch (e) {
      toast(`AI extract failed`, { description: (e as Error).message, variant: "danger" });
    } finally {
      setExtracting(false);
    }
  }

  async function save() {
    if (!d.url && !d.title) return setHint("Add at least a link or a title.");
    setSaving(true);
    const { data: u } = await sb().auth.getUser();
    const url = d.url ? canonicalUrl(d.url) : `manual:${crypto.randomUUID()}`;
    const row = {
      user_id: u.user!.id,
      url,
      title: d.title.trim(),
      company: d.company.trim(),
      location: d.location.trim(),
      source: d.url ? detectSource(url) : "other",
      status: d.status,
      description: d.description,
      notes: d.notes,
      salary: d.salary,
      ...(d.status !== "saved" ? { applied_at: new Date().toISOString() } : {}),
    };
    const { data, error } = await sb().from("jobs").upsert(row, { onConflict: "user_id,url" }).select().single();
    setSaving(false);
    if (error) return setHint(error.message);
    toast(`Saved ${row.title || "job"}`, { variant: "success" });
    onSaved(data as Job);
    onOpenChange(false);
  }

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container placement="auto" scroll="inside" size="lg">
        <Modal.Dialog>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Add a job</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4">
            <div className="flex items-end gap-2">
              <TextField className="min-w-0 flex-1" value={d.url} onChange={set("url")} type="url">
                <Label>Posting link</Label>
                <Input placeholder="https://www.linkedin.com/jobs/view/…" />
              </TextField>
              <Button className="shrink-0" variant="secondary" onPress={() => fetchDetails()} isPending={fetching}>
                {fetching ? <Spinner color="current" size="sm" /> : null}
                Fetch
              </Button>
            </div>
            {hint && <p className="text-sm text-warning">{hint}</p>}

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField value={d.title} onChange={set("title")}>
                <Label>Role</Label>
                <Input placeholder="e.g. Product Designer" />
              </TextField>
              <TextField value={d.company} onChange={set("company")}>
                <Label>Company</Label>
                <Input placeholder="e.g. Acme" />
              </TextField>
              <TextField value={d.location} onChange={set("location")}>
                <Label>Location</Label>
                <Input placeholder="e.g. Bengaluru · Hybrid" />
              </TextField>
              <StatusSelect label="Status" value={d.status} onChange={(s) => setD((p) => ({ ...p, status: s }))} />
            </div>

            <TextField value={d.description} onChange={set("description")}>
              <Label>Job description</Label>
              <TextArea rows={6} placeholder="Paste the full job description (needed for AI tailoring)" />
              <Description>Saved with the card in case the posting is taken down.</Description>
            </TextField>
            {d.description.length > 80 && (!d.title || !d.company) && (
              <Button size="sm" variant="tertiary" onPress={extract} isPending={extracting} className="self-start">
                {extracting ? <Spinner color="current" size="sm" /> : <MagicWand className="size-4" />}
                Extract role & company with AI
              </Button>
            )}

            <TextField value={d.notes} onChange={set("notes")}>
              <Label>Notes</Label>
              <TextArea rows={2} placeholder="Recruiter name, referral, salary discussed…" />
            </TextField>
          </Modal.Body>
          <Modal.Footer>
            <Button slot="close" variant="secondary">
              Cancel
            </Button>
            <Button onPress={save} isPending={saving}>
              {saving ? <Spinner color="current" size="sm" /> : <Plus className="size-4" />}
              Save job
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
