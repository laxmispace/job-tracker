"use client";

import { Label, ListBox, Select } from "@heroui/react";
import { STATUSES, type Status } from "@/lib/types";

const DOT: Record<Status, string> = {
  saved: "bg-default-foreground/40",
  applied: "bg-accent",
  interview: "bg-warning",
  offer: "bg-success",
  rejected: "bg-danger",
  ghosted: "bg-muted",
};

export function StatusDot({ status }: { status: Status }) {
  return <span className={`inline-block size-2 shrink-0 rounded-full ${DOT[status] ?? "bg-muted"}`} />;
}

export default function StatusSelect({
  value,
  onChange,
  label,
  className,
}: {
  value: Status;
  onChange: (s: Status) => void;
  label?: string;
  className?: string;
}) {
  return (
    <Select
      className={className}
      aria-label={label ?? "Status"}
      value={value}
      onChange={(k) => k && onChange(k as Status)}
    >
      {label && <Label>{label}</Label>}
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {STATUSES.map((s) => (
            <ListBox.Item key={s.id} id={s.id} textValue={s.label}>
              <span className="flex items-center gap-2">
                <StatusDot status={s.id} />
                {s.label}
              </span>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
