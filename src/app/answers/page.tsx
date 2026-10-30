"use client";

import { Check, Plus, TrashBin } from "@gravity-ui/icons";
import { Button, Card, Chip, Input, Label, ProgressBar, Skeleton, TextArea, TextField, toast } from "@heroui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES, SEED_QUESTIONS } from "@/lib/seed-questions";
import { sb } from "@/lib/supabase";
import type { Answer } from "@/lib/types";

const HINTS = Object.fromEntries(SEED_QUESTIONS.map((q) => [q.key, q.hint ?? ""]));

export default function AnswersPage() {
  const [rows, setRows] = useState<Answer[] | null>(null);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [newQ, setNewQ] = useState("");

  useEffect(() => {
    (async () => {
      const db = sb();
      const { data: u } = await db.auth.getUser();
      const { data } = await db.from("answers").select("*").order("sort");
      const have = new Set((data ?? []).map((a) => a.key));
      const missing = SEED_QUESTIONS.filter((q) => !have.has(q.key));
      if (missing.length) {
        await db.from("answers").upsert(
          missing.map((q) => ({
            user_id: u.user!.id,
            key: q.key,
            category: q.category,
            question: q.question,
            aliases: q.aliases,
            long_form: Boolean(q.long_form),
            sort: SEED_QUESTIONS.indexOf(q),
          })),
          { onConflict: "user_id,key", ignoreDuplicates: true },
        );
        const again = await db.from("answers").select("*").order("sort");
        setRows((again.data as Answer[]) ?? []);
      } else {
        setRows((data as Answer[]) ?? []);
      }
    })();
  }, []);

  function update(id: string, patch: Partial<Answer>) {
    setRows((rs) => rs?.map((r) => (r.id === id ? { ...r, ...patch } : r)) ?? null);
    setSaved((s) => ({ ...s, [id]: false }));
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(async () => {
      const { error } = await sb().from("answers").update(patch).eq("id", id);
      if (error) toast("Couldn't save", { description: error.message, variant: "danger" });
      else setSaved((s) => ({ ...s, [id]: true }));
    }, 600);
  }

  async function addCustom() {
    const question = newQ.trim();
    if (!question) return;
    const { data: u } = await sb().auth.getUser();
    const key = `custom_${question.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40)}_${Date.now().toString(36)}`;
    const words = question.toLowerCase().replace(/[?*:]/g, "").trim();
    const { data, error } = await sb()
      .from("answers")
      .insert({ user_id: u.user!.id, key, category: "other", question, aliases: [words], sort: 1000 + (rows?.length ?? 0) })
      .select()
      .single();
    if (error) return toast("Couldn't add", { description: error.message, variant: "danger" });
    setRows((rs) => [...(rs ?? []), data as Answer]);
    setNewQ("");
  }

  async function remove(id: string) {
    setRows((rs) => rs?.filter((r) => r.id !== id) ?? null);
    await sb().from("answers").delete().eq("id", id);
  }

  const answered = rows?.filter((r) => r.answer.trim()).length ?? 0;
  const total = rows?.length ?? 0;
  const grouped = useMemo(() => {
    const g: Record<string, Answer[]> = {};
    rows?.forEach((r) => (g[r.category] ??= []).push(r));
    return g;
  }, [rows]);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Answers bank</h1>
        <p className="max-w-2xl text-sm text-muted">
          The Chrome extension fills application forms from these. Answers save as you type. &quot;Also matches&quot; lists the
          phrases used to recognise each question — add your own if a site words it differently.
        </p>
        {rows && (
          <ProgressBar aria-label="Answered" value={answered} maxValue={total} className="max-w-sm">
            <Label className="text-xs text-muted">
              {answered} of {total} answered
            </Label>
            <ProgressBar.Track>
              <ProgressBar.Fill />
            </ProgressBar.Track>
          </ProgressBar>
        )}
      </div>

      {!rows && <Skeleton className="h-96 rounded-2xl" />}

      {rows &&
        CATEGORIES.filter((c) => grouped[c.id]?.length || c.id === "other").map((c) => (
          <Card key={c.id} className="gap-4">
            <Card.Header className="flex-row items-center justify-between">
              <Card.Title>{c.label}</Card.Title>
              <Chip size="sm" variant="soft">
                {(grouped[c.id] ?? []).filter((r) => r.answer.trim()).length}/{(grouped[c.id] ?? []).length}
              </Chip>
            </Card.Header>
            <Card.Content className="grid gap-x-6 gap-y-5 md:grid-cols-2">
              {(grouped[c.id] ?? []).map((r) => (
                <div key={r.id} className={r.long_form ? "md:col-span-2" : ""}>
                  <TextField value={r.answer} onChange={(v) => update(r.id, { answer: v })}>
                    <Label className="flex items-center gap-2">
                      {r.question}
                      {saved[r.id] && <Check className="size-3.5 text-success" />}
                    </Label>
                    {r.long_form ? (
                      <TextArea rows={4} placeholder={HINTS[r.key] || "Your answer"} />
                    ) : (
                      <Input placeholder={HINTS[r.key] || "Your answer"} />
                    )}
                  </TextField>
                  <div className="mt-1.5 flex items-center gap-2">
                    <input
                      className="min-w-0 flex-1 truncate bg-transparent text-xs text-muted outline-none focus:text-foreground"
                      aria-label={`Matching phrases for ${r.question}`}
                      defaultValue={`Also matches: ${r.aliases.join(", ")}`}
                      onFocus={(e) => (e.target.value = r.aliases.join(", "))}
                      onBlur={(e) => {
                        const aliases = e.target.value
                          .split(",")
                          .map((s) => s.trim().toLowerCase())
                          .filter(Boolean);
                        e.target.value = `Also matches: ${aliases.join(", ")}`;
                        if (aliases.join() !== r.aliases.join()) update(r.id, { aliases });
                      }}
                    />
                    {r.key.startsWith("custom_") && (
                      <Button size="sm" variant="ghost" isIconOnly aria-label="Delete question" onPress={() => remove(r.id)}>
                        <TrashBin className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {c.id === "other" && (
                <div className="flex items-end gap-2 md:col-span-2">
                  <TextField className="flex-1" value={newQ} onChange={setNewQ}>
                    <Label>Add a question you keep seeing</Label>
                    <Input
                      placeholder="e.g. Do you have experience with Figma?"
                      onKeyDown={(e) => e.key === "Enter" && addCustom()}
                    />
                  </TextField>
                  <Button variant="secondary" onPress={addCustom}>
                    <Plus className="size-4" /> Add
                  </Button>
                </div>
              )}
            </Card.Content>
          </Card>
        ))}
    </div>
  );
}
