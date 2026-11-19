"use client";

import { Check, Plus } from "@phosphor-icons/react";
import { ComboBox, Input, InputGroup, Label, ListBox, Select, TextArea, TextField } from "@heroui/react";
import { labelVariants } from "@heroui/styles";
import { useId, useState, type ReactNode } from "react";
import type { Field, Option } from "@/lib/seed-questions";

/** Answers are stored as text; multi-select answers are comma-separated. */
export const splitList = (v: string) =>
  v
    .split(/\s*,\s*/)
    .map((x) => x.trim())
    .filter(Boolean);

/** Layout order inside a section: short fields, then pick-several chips, then long answers. */
export const fieldRank = (field?: Field, long?: boolean) => (long ? 2 : field?.kind === "multi" ? 1 : 0);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const opt = (o: Option) => (Array.isArray(o) ? { value: o[0], label: o[1] } : { value: o, label: o });

/** Whether a stored answer fits the control, so an older free-text answer is never silently hidden. */
function fits(field: Field, value: string) {
  if (!value.trim()) return true;
  if (field.kind === "date") return ISO_DATE.test(value);
  if (field.kind === "number") return value.trim() !== "" && !Number.isNaN(Number(value));
  return true;
}

export default function ProfileField({
  field,
  long,
  label,
  value,
  placeholder,
  mark,
  action,
  onChange,
}: {
  field?: Field;
  long?: boolean;
  label: string;
  value: string;
  placeholder: string;
  /** Save state icon */
  mark: ReactNode;
  /** Optional button shown at the end of the label row (e.g. delete) */
  action?: ReactNode;
  onChange: (v: string) => void;
}) {
  const id = useId();
  const head = (
    <span className="flex w-full items-center justify-between gap-2">
      <span>{label}</span>
      {action}
    </span>
  );
  const inside = mark && <span className={`pointer-events-none absolute right-3 ${long ? "top-3" : "top-1/2 -translate-y-1/2"}`}>{mark}</span>;
  const legacy = field && !fits(field, value) && (
    <p className="mt-1.5 text-xs text-muted">
      Earlier answer: <span className="text-foreground">“{value}”</span>. Enter it again in the new format to replace it.
    </p>
  );

  // Long free text
  if (long || !field) {
    return (
      <TextField value={value} onChange={onChange}>
        <Label className="flex">{head}</Label>
        <div className="relative">
          {long ? <TextArea rows={4} placeholder={placeholder} className="w-full pr-9" /> : <Input placeholder={placeholder} className="w-full pr-9" />}
          {inside}
        </div>
      </TextField>
    );
  }

  switch (field.kind) {
    case "text":
      return (
        <TextField value={value} onChange={onChange} type={field.type ?? "text"}>
          <Label className="flex">{head}</Label>
          <div className="relative">
            <Input
              placeholder={placeholder}
              className="w-full pr-9"
              inputMode={field.numeric ? "numeric" : field.type === "tel" ? "tel" : field.type === "url" ? "url" : field.type === "email" ? "email" : undefined}
              autoCapitalize={field.type ? "off" : undefined}
            />
            {inside}
          </div>
        </TextField>
      );

    case "number":
      return (
        <div>
          <TextField value={fits(field, value) ? value : ""} onChange={onChange} type="number">
            <Label className="flex">{head}</Label>
            <InputGroup>
              <InputGroup.Input placeholder={placeholder} inputMode="decimal" step={field.step} min={field.min} max={field.max} />
              <InputGroup.Suffix className="gap-2 text-sm text-muted">
                {mark}
                {field.unit}
              </InputGroup.Suffix>
            </InputGroup>
          </TextField>
          {legacy}
        </div>
      );

    case "date":
      return (
        <div>
          <TextField value={fits(field, value) ? value : ""} onChange={onChange} type="date">
            <Label className="flex">{head}</Label>
            <div className="relative">
              <Input className="w-full pr-16" />
              {mark && <span className="pointer-events-none absolute top-1/2 right-10 -translate-y-1/2">{mark}</span>}
            </div>
          </TextField>
          {legacy}
        </div>
      );

    case "select": {
      const options = field.options.map(opt);
      // Keep an older answer selectable instead of dropping it.
      if (value && !options.some((o) => o.value === value)) options.unshift({ value, label: value });
      return (
        <Select aria-label={label} placeholder="Choose…" value={value || null} onChange={(k) => onChange(k == null ? "" : String(k))}>
          <Label className="flex">{head}</Label>
          <Select.Trigger>
            <Select.Value className="truncate" />
            <span className="ml-auto flex items-center gap-2">
              {mark}
              <Select.Indicator />
            </span>
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {options.map((o) => (
                <ListBox.Item key={o.value} id={o.value} textValue={o.label}>
                  {o.label}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      );
    }

    case "combo":
      return (
        <ComboBox
          allowsCustomValue
          inputValue={value}
          onInputChange={onChange}
          onSelectionChange={(k) => k != null && onChange(String(k))}
          menuTrigger="focus"
          aria-label={label}
        >
          <Label className="flex">{head}</Label>
          <ComboBox.InputGroup>
            <Input placeholder={placeholder} />
            {mark && <span className="flex items-center pr-1">{mark}</span>}
            <ComboBox.Trigger />
          </ComboBox.InputGroup>
          <ComboBox.Popover>
            <ListBox>
              {field.options.map((o) => (
                <ListBox.Item key={o} id={o} textValue={o}>
                  {o}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </ComboBox.Popover>
        </ComboBox>
      );

    case "choice": {
      const options = [...field.options];
      if (value && !options.includes(value)) options.push(value);
      return (
        <div>
          <span id={id} className={`${labelVariants()} flex`}>
            {head}
          </span>
          <div role="radiogroup" aria-labelledby={id} className="mt-1 flex items-center gap-2">
            <div className="flex flex-wrap gap-1.5">
              {options.map((o) => {
                const on = value === o;
                return (
                  <button
                    key={o}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => onChange(on ? "" : o)}
                    className="chip-toggle chip-toggle--field"
                    data-selected={on || undefined}
                  >
                    {o}
                  </button>
                );
              })}
            </div>
            {mark}
          </div>
        </div>
      );
    }

    case "multi":
      return <MultiField field={field} id={id} head={head} value={value} mark={mark} onChange={onChange} />;
  }
}

function MultiField({
  field,
  id,
  head,
  value,
  mark,
  onChange,
}: {
  field: Extract<Field, { kind: "multi" }>;
  id: string;
  head: ReactNode;
  value: string;
  mark: ReactNode;
  onChange: (v: string) => void;
}) {
  const selected = splitList(value);
  const lower = new Set(selected.map((s) => s.toLowerCase()));
  // Your own additions (or older free text) show up as chips too.
  const extra = selected.filter((s) => !field.options.some((o) => o.toLowerCase() === s.toLowerCase()));
  const all = [...field.options, ...extra];
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const toggle = (o: string) => {
    const next = lower.has(o.toLowerCase()) ? selected.filter((s) => s.toLowerCase() !== o.toLowerCase()) : [...selected, o];
    onChange(next.join(", "));
  };
  const add = () => {
    const items = splitList(draft).filter((d) => !lower.has(d.toLowerCase()));
    if (items.length) onChange([...selected, ...items].join(", "));
    setDraft("");
    setAdding(false);
  };

  return (
    <div>
      <span id={id} className={`${labelVariants()} flex`}>
        {head}
      </span>
      <div role="group" aria-labelledby={id} className="mt-1 flex flex-wrap items-center gap-1.5">
        {all.map((o) => {
          const on = lower.has(o.toLowerCase());
          return (
            <button key={o} type="button" aria-pressed={on} onClick={() => toggle(o)} className="chip-toggle" data-selected={on || undefined}>
              {on && <Check weight="bold" className="size-3.5" />}
              {o}
            </button>
          );
        })}
        {field.custom &&
          (adding ? (
            <input
              autoFocus
              className="field-native h-8 w-44 px-2.5 text-sm"
              placeholder="Type and press Enter"
              aria-label="Add your own"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
                if (e.key === "Escape") setAdding(false);
              }}
              onBlur={add}
            />
          ) : (
            <button type="button" className="chip-toggle chip-toggle--add" onClick={() => setAdding(true)}>
              <Plus weight="bold" className="size-3.5" /> Other
            </button>
          ))}
        {mark}
      </div>
    </div>
  );
}
