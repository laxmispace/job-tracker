"use client";

import { ArrowLeft, ArrowUpRightFromSquare, MagicWand, Sparkles, TrashBin } from "@gravity-ui/icons";
import {
  Button,
  Card,
  Chip,
  Description,
  Input,
  Label,
  Skeleton,
  Spinner,
  TextArea,
  TextField,
  toast,
} from "@heroui/react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import CopyButton from "@/components/CopyButton";
import ModelSwitcher from "@/components/ModelSwitcher";
import { timeAgo } from "@/components/JobCard";
import StatusSelect from "@/components/StatusSelect";
import { api, sb } from "@/lib/supabase";
import type { Job, Status, Tailored } from "@/lib/types";

export default function JobPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [missing, setMissing] = useState(false);
  const [draft, setDraft] = useState({ title: "", company: "", location: "", description: "", notes: "", salary: "" });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tailoring, setTailoring] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [answering, setAnswering] = useState(false);

  useEffect(() => {
    sb()
      .from("jobs")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return setMissing(true);
        const j = data as Job;
        setJob(j);
        setDraft({
          title: j.title,
          company: j.company,
          location: j.location ?? "",
          description: j.description ?? "",
          notes: j.notes ?? "",
          salary: j.salary ?? "",
        });
      });
  }, [id]);

  const edit = (k: keyof typeof draft) => (v: string) => {
    setDraft((d) => ({ ...d, [k]: v }));
    setDirty(true);
  };

  async function saveDetails() {
    setSaving(true);
    const { error } = await sb().from("jobs").update(draft).eq("id", id);
    setSaving(false);
    if (error) return toast("Save failed", { description: error.message, variant: "danger" });
    setJob((j) => (j ? { ...j, ...draft } : j));
    setDirty(false);
    toast("Saved", { variant: "success" });
  }

  async function setStatus(status: Status) {
    if (!job) return;
    const patch: Partial<Job> = { status };
    if (status !== "saved" && !job.applied_at) patch.applied_at = new Date().toISOString();
    setJob({ ...job, ...patch });
    await sb().from("jobs").update(patch).eq("id", id);
  }

  async function remove() {
    if (!confirm("Delete this job card?")) return;
    await sb().from("jobs").delete().eq("id", id);
    router.push("/");
  }

  async function tailor() {
    if (dirty) await saveDetails();
    setTailoring(true);
    try {
      const { tailored } = await api<{ tailored: Tailored }>("/api/ai/tailor", { jobId: id });
      setJob((j) => (j ? { ...j, tailored } : j));
    } catch (e) {
      toast("Tailoring failed", { description: (e as Error).message, variant: "danger" });
    } finally {
      setTailoring(false);
    }
  }

  async function draftAnswer() {
    setAnswering(true);
    try {
      const r = await api<{ answer: string }>("/api/ai/answer", { question, jobId: id });
      setAnswer(r.answer);
    } catch (e) {
      toast("Couldn't draft an answer", { description: (e as Error).message, variant: "danger" });
    } finally {
      setAnswering(false);
    }
  }

  if (missing)
    return (
      <div className="py-16 text-center text-muted">
        This job doesn&apos;t exist anymore. <Link href="/" className="text-accent">Back to jobs</Link>
      </div>
    );
  if (!job) return <Skeleton className="h-96 rounded-2xl" />;

  const t = job.tailored;
  const allBullets = t
    ? [t.summary, ...t.experiences.map((e) => `${e.title} — ${e.company}\n${e.bullets.map((b) => `• ${b}`).join("\n")}`)].join("\n\n")
    : "";

  return (
    <div className="space-y-5">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> All jobs
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{job.title || "Untitled role"}</h1>
          <p className="text-muted">
            {job.company}
            {job.location ? ` · ${job.location}` : ""} · {job.status === "saved" ? "saved" : "applied"}{" "}
            {timeAgo(job.applied_at ?? job.created_at)}
          </p>
          {!job.url.startsWith("manual:") && (
            <a href={job.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-sm text-accent hover:underline">
              Open posting <ArrowUpRightFromSquare className="size-3.5" />
            </a>
          )}
        </div>
        <div className="flex items-center gap-2">
          <StatusSelect className="w-40" value={job.status} onChange={setStatus} />
          <Button variant="danger-soft" isIconOnly aria-label="Delete job" onPress={remove}>
            <TrashBin className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        {/* ── Details */}
        <Card className="gap-4">
          <Card.Header>
            <Card.Title>Details</Card.Title>
          </Card.Header>
          <Card.Content className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField value={draft.title} onChange={edit("title")}>
                <Label>Role</Label>
                <Input />
              </TextField>
              <TextField value={draft.company} onChange={edit("company")}>
                <Label>Company</Label>
                <Input />
              </TextField>
              <TextField value={draft.location} onChange={edit("location")}>
                <Label>Location</Label>
                <Input />
              </TextField>
              <TextField value={draft.salary} onChange={edit("salary")}>
                <Label>Salary / CTC</Label>
                <Input />
              </TextField>
            </div>
            <TextField value={draft.description} onChange={edit("description")}>
              <Label>Job description</Label>
              <TextArea rows={10} placeholder="Paste the job description here — AI tailoring uses it." />
              <Description>{draft.description.length.toLocaleString()} characters</Description>
            </TextField>
            <TextField value={draft.notes} onChange={edit("notes")}>
              <Label>Notes</Label>
              <TextArea rows={3} />
            </TextField>
          </Card.Content>
          <Card.Footer>
            <Button onPress={saveDetails} isDisabled={!dirty} isPending={saving}>
              {saving && <Spinner color="current" size="sm" />}
              Save changes
            </Button>
          </Card.Footer>
        </Card>

        {/* ── AI */}
        <div className="space-y-5">
          <Card className="gap-4">
            <Card.Header className="flex-row items-start justify-between gap-3">
              <div>
                <Card.Title className="flex items-center gap-2">
                  <Sparkles className="size-4 text-accent" /> Tailored experience
                </Card.Title>
                <Card.Description>
                  Your real experience, rephrased with this posting&apos;s keywords. Nothing is invented.
                </Card.Description>
              </div>
              {t && <CopyButton text={allBullets} label="Copy all" />}
            </Card.Header>
            <Card.Content className="flex flex-col gap-4">
              {!t && !tailoring && (
                <p className="text-sm text-muted">
                  Needs the job description (left) and your experience on the Experience page.
                </p>
              )}
              {tailoring && (
                <div className="flex items-center gap-2 text-sm text-muted">
                  <Spinner size="sm" /> Reading the posting and rewriting your bullets…
                </div>
              )}
              {t && !tailoring && (
                <>
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">Keywords from the posting</p>
                    <div className="flex flex-wrap gap-1.5">
                      {t.keywords.map((k) => (
                        <Chip key={k} size="sm" variant="soft" color={t.missing_keywords.includes(k) ? "default" : "success"}>
                          {k}
                        </Chip>
                      ))}
                    </div>
                    {t.missing_keywords.length > 0 && (
                      <p className="text-xs text-muted">
                        Not backed by your experience: {t.missing_keywords.join(", ")}. Add them only if they&apos;re true.
                      </p>
                    )}
                  </div>

                  {t.summary && (
                    <div className="rounded-xl bg-surface-secondary p-3">
                      <div className="mb-1 flex items-center justify-between">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted">Summary</p>
                        <CopyButton text={t.summary} />
                      </div>
                      <p className="text-sm leading-relaxed">{t.summary}</p>
                    </div>
                  )}

                  {t.experiences.map((e) => (
                    <div key={e.experience_id} className="rounded-xl border border-separator p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">
                          {e.title} <span className="text-muted">· {e.company}</span>
                        </p>
                        <CopyButton text={e.bullets.map((b) => `• ${b}`).join("\n")} />
                      </div>
                      <ul className="space-y-1.5">
                        {e.bullets.map((b, i) => (
                          <li key={i} className="group flex items-start gap-2 text-sm leading-relaxed">
                            <span className="mt-2 size-1 shrink-0 rounded-full bg-muted" />
                            <span className="flex-1">{b}</span>
                            <span className="opacity-60 group-hover:opacity-100">
                              <CopyButton text={b} />
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  <p className="text-xs text-muted">
                    Generated {timeAgo(t.generated_at)}
                    {t.provider ? ` with ${t.provider}${t.model ? ` · ${t.model}` : ""}` : ""}
                  </p>
                </>
              )}
            </Card.Content>
            <Card.Footer className="flex-wrap gap-2">
              <Button onPress={tailor} isPending={tailoring} variant={t ? "secondary" : "primary"}>
                {tailoring ? <Spinner color="current" size="sm" /> : <MagicWand className="size-4" />}
                {t ? "Regenerate" : "Tailor my experience"}
              </Button>
              <ModelSwitcher className="w-52" />
            </Card.Footer>
          </Card>

          <Card className="gap-4">
            <Card.Header>
              <Card.Title>Answer a form question</Card.Title>
              <Card.Description>
                For &quot;Why do you want to join us?&quot;-type questions. Uses this posting + your answers bank.
              </Card.Description>
            </Card.Header>
            <Card.Content className="flex flex-col gap-3">
              <TextField value={question} onChange={setQuestion}>
                <Label>Question</Label>
                <Input placeholder="Why are you interested in this role?" />
              </TextField>
              {answer && (
                <div className="rounded-xl bg-surface-secondary p-3">
                  <div className="mb-1 flex justify-end">
                    <CopyButton text={answer} label="Copy" />
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{answer}</p>
                </div>
              )}
            </Card.Content>
            <Card.Footer>
              <Button variant="secondary" onPress={draftAnswer} isPending={answering} isDisabled={!question.trim()}>
                {answering ? <Spinner color="current" size="sm" /> : <Sparkles className="size-4" />}
                Draft answer
              </Button>
            </Card.Footer>
          </Card>
        </div>
      </div>
    </div>
  );
}
