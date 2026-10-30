"use client";

import { ArrowUpRightFromSquare, Sparkles } from "@gravity-ui/icons";
import { Card } from "@heroui/react";
import Link from "next/link";
import type { Job, Status } from "@/lib/types";
import StatusSelect from "./StatusSelect";

const SOURCE_LABEL: Record<string, string> = {
  linkedin: "LinkedIn",
  greenhouse: "Greenhouse",
  lever: "Lever",
  workday: "Workday",
  ashby: "Ashby",
  naukri: "Naukri",
  instahyre: "Instahyre",
  wellfound: "Wellfound",
  smartrecruiters: "SmartRecruiters",
  indeed: "Indeed",
};

export function timeAgo(iso: string | null) {
  if (!iso) return "";
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  if (d < 86400 * 30) return `${Math.floor(d / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function JobCard({ job, onStatus }: { job: Job; onStatus: (s: Status) => void }) {
  const when = job.status === "saved" ? job.created_at : job.applied_at ?? job.created_at;
  return (
    <Card className="h-full gap-3">
      <Card.Header className="gap-1.5">
        <Link href={`/jobs/${job.id}`} className="min-w-0 hover:underline">
          <Card.Title className="line-clamp-2 text-base leading-snug">{job.title || "Untitled role"}</Card.Title>
        </Link>
        <Card.Description className="line-clamp-1">
          <span className="font-medium text-foreground">{job.company || "Unknown company"}</span>
          {job.location ? <span> · {job.location}</span> : null}
        </Card.Description>
      </Card.Header>

      <div className="flex flex-row flex-wrap items-center justify-start gap-x-3 gap-y-1 text-left text-xs text-muted">
        <span>{SOURCE_LABEL[job.source ?? ""] ?? "Other"}</span>
        <span>{job.status === "saved" ? "Saved" : "Applied"} {timeAgo(when)}</span>
        {job.tailored && (
          <span className="inline-flex items-center gap-1 text-accent">
            <Sparkles className="size-3" /> Tailored
          </span>
        )}
      </div>

      <Card.Footer className="mt-auto flex items-center justify-between gap-2">
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
        >
          Posting <ArrowUpRightFromSquare className="size-3.5" />
        </a>
        <StatusSelect className="w-36" value={job.status} onChange={onStatus} />
      </Card.Footer>
    </Card>
  );
}
