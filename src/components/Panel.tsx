"use client";

import { CaretDown, type Icon } from "@phosphor-icons/react";
import type { ReactNode } from "react";

/**
 * The one container style used across the app: 1px edge, surface fill, and a
 * header with an icon, a sentence-case title and a soft left-to-right accent
 * gradient. Optional collapse.
 */
export default function Panel({
  icon: IconCmp,
  title,
  description,
  meta,
  actions,
  open,
  onToggle,
  children,
  bodyClassName = "p-4 sm:p-5",
  className = "",
}: {
  icon: Icon;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  /** Pass open + onToggle to make the panel collapsible. */
  open?: boolean;
  onToggle?: () => void;
  children?: ReactNode;
  bodyClassName?: string;
  className?: string;
}) {
  const collapsible = typeof onToggle === "function";
  const isOpen = collapsible ? Boolean(open) : true;

  const head = (
    <>
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent">
        <IconCmp className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
      </span>
      {meta && <span className="shrink-0 text-xs text-muted tabular-nums">{meta}</span>}
    </>
  );

  return (
    <section className={`overflow-hidden rounded-2xl border border-separator bg-surface ${className}`}>
      <div className="flex items-center gap-3 bg-linear-to-r from-accent/12 via-accent/4 to-transparent px-4 py-3 sm:px-5">
        {collapsible ? (
          <button className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-expanded={isOpen} onClick={onToggle}>
            {head}
            <CaretDown className={`size-4 shrink-0 text-muted transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </button>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-3">{head}</div>
        )}
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {isOpen && children !== undefined && <div className={`border-t border-separator ${bodyClassName}`}>{children}</div>}
    </section>
  );
}
