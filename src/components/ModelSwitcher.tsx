"use client";

import { Sparkles } from "@gravity-ui/icons";
import { Label, ListBox, Select, toast } from "@heroui/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAIPrefs } from "@/lib/ai-prefs";

/**
 * "✨ Gemini ▾" dropdown. Shown in the header on every page (and on the job page).
 * Every copy shares one store, so switching here updates them all, the phone
 * and the Chrome extension.
 */
export default function ModelSwitcher({ className, compact }: { className?: string; compact?: boolean }) {
  const { state, setProvider } = useAIPrefs();
  const router = useRouter();
  if (!state) return null;
  const usable = state.providers.filter((p) => p.configured);
  const active = usable.find((p) => p.id === state.active);
  if (!usable.length) {
    return (
      <Link href="/settings" className="text-sm whitespace-nowrap text-accent hover:underline">
        Add AI key
      </Link>
    );
  }
  return (
    <Select
      className={className}
      aria-label="AI model"
      value={state.active}
      onChange={async (k) => {
        if (!k) return;
        if (k === "__settings") return router.push("/settings");
        try {
          await setProvider(String(k));
          const p = usable.find((x) => x.id === k);
          toast(`Now using ${p?.label}`, { description: p?.model, variant: "success" });
        } catch (e) {
          toast("Couldn't switch model", { description: (e as Error).message, variant: "danger" });
        }
      }}
    >
      <Label className="sr-only">AI model</Label>
      <Select.Trigger className={compact ? "h-8 text-sm" : undefined}>
        <Sparkles className="size-3.5 shrink-0 text-accent" />
        <span className="min-w-0 flex-1 truncate text-left">{active?.label ?? "Choose model"}</span>
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover className="min-w-64">
        <ListBox>
          {usable.map((p) => (
            <ListBox.Item key={p.id} id={p.id} textValue={p.label}>
              <span className="flex min-w-0 flex-col">
                <span>{p.label}</span>
                <span className="truncate text-xs text-muted">{p.model || "pick a model in AI settings"}</span>
              </span>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
          <ListBox.Item id="__settings" textValue="AI settings">
            <span className="text-sm text-accent">AI settings, models &amp; instructions…</span>
          </ListBox.Item>
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
