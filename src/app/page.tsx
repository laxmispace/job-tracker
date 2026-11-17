"use client";

import { Briefcase, Plus } from "@phosphor-icons/react";
import { Button, Card, SearchField, Skeleton, Tabs, toast } from "@heroui/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import AddJobModal from "@/components/AddJobModal";
import JobCard from "@/components/JobCard";
import { sb } from "@/lib/supabase";
import { STATUSES, type Job, type Status } from "@/lib/types";

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await sb().from("jobs").select("*").order("created_at", { ascending: false });
    if (error) toast("Couldn't load jobs", { description: error.message, variant: "danger" });
    setJobs((data as Job[]) ?? []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch from Supabase
    void load();
    // Pick up jobs the extension saved while this tab was in the background.
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  async function setStatus(job: Job, status: Status) {
    const patch: Partial<Job> = { status };
    if (status !== "saved" && !job.applied_at) patch.applied_at = new Date().toISOString();
    setJobs((js) => js?.map((j) => (j.id === job.id ? { ...j, ...patch } : j)) ?? null);
    const { error } = await sb().from("jobs").update(patch).eq("id", job.id);
    if (error) toast("Update failed", { description: error.message, variant: "danger" });
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: jobs?.length ?? 0 };
    jobs?.forEach((j) => (c[j.status] = (c[j.status] ?? 0) + 1));
    return c;
  }, [jobs]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (jobs ?? []).filter(
      (j) =>
        (filter === "all" || j.status === filter) &&
        (!needle || `${j.title} ${j.company} ${j.location}`.toLowerCase().includes(needle)),
    );
  }, [jobs, filter, q]);

  const active = (counts.applied ?? 0) + (counts.interview ?? 0);
  const responseRate = counts.all
    ? Math.round((((counts.interview ?? 0) + (counts.offer ?? 0)) / Math.max(1, counts.all - (counts.saved ?? 0))) * 100)
    : 0;

  const grid = (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {jobs === null &&
        Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
      {visible.map((j) => (
        <JobCard key={j.id} job={j} onStatus={(s) => setStatus(j, s)} />
      ))}
      {jobs !== null && visible.length === 0 && (
        <Card className="col-span-full items-center gap-2 py-12 text-center">
          <Briefcase className="size-6 text-muted" />
          <Card.Title>{jobs.length ? "Nothing here" : "No applications yet"}</Card.Title>
          <Card.Description className="max-w-sm">
            {jobs.length
              ? "Try another filter or search."
              : "Add one with the button, share a job from the LinkedIn app, or apply with the Chrome extension installed."}
          </Card.Description>
        </Card>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Applications</h1>
          <p className="text-sm text-muted">
            {counts.all} tracked · {active} in progress · {responseRate}% response rate
          </p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <SearchField value={q} onChange={setQ} aria-label="Search jobs" className="min-w-0 flex-1 sm:w-72 sm:flex-none">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Search role, company, city" />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <Button className="shrink-0" onPress={() => setAdding(true)}>
            <Plus className="size-4" /> Add job
          </Button>
        </div>
      </div>

      <Tabs selectedKey={filter} onSelectionChange={(k) => setFilter(String(k))} className="w-full">
        <Tabs.ListContainer className="overflow-x-auto">
          <Tabs.List aria-label="Filter by status" className="w-max">
            {[{ id: "all", label: "All" }, ...STATUSES].map((s) => (
              <Tabs.Tab key={s.id} id={s.id}>
                {s.label}
                <span className="ml-1.5 text-xs text-muted">{counts[s.id] ?? 0}</span>
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
        {[{ id: "all" }, ...STATUSES].map((s) => (
          <Tabs.Panel key={s.id} id={s.id} className="pt-4">
            {filter === s.id ? grid : null}
          </Tabs.Panel>
        ))}
      </Tabs>

      <AddJobModal
        isOpen={adding}
        onOpenChange={setAdding}
        onSaved={(job) => setJobs((js) => [job, ...(js ?? []).filter((j) => j.id !== job.id)])}
      />
    </div>
  );
}
