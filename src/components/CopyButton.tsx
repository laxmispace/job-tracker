"use client";

import { Check, Copy } from "@phosphor-icons/react";
import { Button } from "@heroui/react";
import { useState } from "react";

export default function CopyButton({ text, label }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      isIconOnly={!label}
      aria-label={label ?? "Copy"}
      onPress={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
    >
      {done ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
      {label}
    </Button>
  );
}
