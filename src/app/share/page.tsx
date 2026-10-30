"use client";

import { Spinner } from "@heroui/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import AddJobModal from "@/components/AddJobModal";
import { extractUrl } from "@/lib/job-url";

/**
 * Android share target. In the LinkedIn app: Share → Job Tracker.
 * LinkedIn shares text like "Check out this job at Acme: Product Designer https://www.linkedin.com/jobs/view/123…"
 */
function ShareInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(true);

  const initial = useMemo(() => {
    const text = params.get("text") ?? "";
    const title = params.get("title") ?? "";
    const url = params.get("url") || extractUrl(text) || extractUrl(title) || "";
    const m = text.match(/job at (.+?)[:\-–]\s*(.+?)(?:\s+https?:|$)/i);
    return {
      url,
      company: m?.[1]?.trim() ?? "",
      title: m?.[2]?.trim() ?? "",
      status: "applied" as const,
    };
  }, [params]);

  return (
    <AddJobModal
      isOpen={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) router.replace("/");
      }}
      initial={initial}
      autoFetch
      onSaved={() => router.replace("/")}
    />
  );
}

export default function SharePage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ShareInner />
    </Suspense>
  );
}
