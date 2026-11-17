"use client";

import { CaretDown } from "@phosphor-icons/react";
import { Label, ListBox, Select, toast } from "@heroui/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAIPrefs } from "@/lib/ai-prefs";
import ProviderLogo from "./ProviderLogo";

/**
 * Picks which AI model writes tailored bullets and form answers.
 * Shown only where AI runs (job page, AI settings); shares one store so
 * every copy, the phone and the Chrome extension stay in sync.
 */
export default function ModelSwitcher({ className, label = "AI model" }: { className?: string; label?: string }) {
  const { state, setProvider } = useAIPrefs();
  const router = useRouter();
  if (!state) return null;
  const usable = state.providers.filter((p) => p.configured);
  const active = usable.find((p) => p.id === state.active);
  if (!usable.length) {
    return (
      <Link href="/settings" className="text-sm whitespace-nowrap text-accent hover:underline">
        Add an AI key
      </Link>
    );
  }
  return (
    <Select
      className={className}
      aria-label={label}
      value={state.active}
      onChange={async (k) => {
        if (!k) return;
        if (k === "__settings") return router.push("/settings");
        try {
          await setProvider(String(k));
          const p = usable.find((x) => x.id === k);
          toast(`${p?.label} will write your AI drafts`, { description: p?.model, variant: "success" });
        } catch (e) {
          toast("Couldn't switch model", { description: (e as Error).message, variant: "danger" });
        }
      }}
    >
      <Label className="sr-only">{label}</Label>
      <Select.Trigger className="h-9 gap-2 pr-2.5 pl-2.5">
        {active && <ProviderLogo id={active.id} label={active.label} size={18} />}
        <span className="min-w-0 flex-1 truncate text-left text-sm">{active?.label ?? "Choose a model"}</span>
        <CaretDown className="size-3.5 shrink-0 text-muted" />
      </Select.Trigger>
      <Select.Popover className="min-w-64">
        <ListBox>
          {usable.map((p) => (
            <ListBox.Item key={p.id} id={p.id} textValue={p.label}>
              <span className="flex min-w-0 items-center gap-2.5">
                <ProviderLogo id={p.id} label={p.label} size={20} />
                <span className="flex min-w-0 flex-col">
                  <span>{p.label}</span>
                  <span className="truncate text-xs text-muted">{p.model || "choose a model in AI settings"}</span>
                </span>
              </span>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
          <ListBox.Item id="__settings" textValue="AI settings">
            <span className="text-sm text-accent">Manage models in AI settings</span>
          </ListBox.Item>
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
