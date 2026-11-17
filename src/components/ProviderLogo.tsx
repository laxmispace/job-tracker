"use client";

import { useState } from "react";

// Each provider's own site icon, loaded from its official domain via
// Google's favicon service. Nothing is redrawn or bundled.
const DOMAIN: Record<string, string> = {
  gemini: "gemini.google.com",
  deepseek: "deepseek.com",
  qwen: "qwen.ai",
  openrouter: "openrouter.ai",
  groq: "groq.com",
  xai: "x.ai",
  ollama: "ollama.com",
};

export default function ProviderLogo({ id, label, size = 20 }: { id: string; label?: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const domain = DOMAIN[id];
  const box = { width: size, height: size };
  if (!domain || failed) {
    return (
      <span
        style={box}
        className="grid shrink-0 place-items-center rounded-md bg-default text-[10px] font-semibold uppercase text-muted"
        aria-hidden
      >
        {(label ?? id).slice(0, 1)}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny external favicon, no optimisation needed
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
      alt=""
      aria-hidden
      style={box}
      className="shrink-0 rounded-md bg-white object-contain p-px"
      onError={() => setFailed(true)}
    />
  );
}
