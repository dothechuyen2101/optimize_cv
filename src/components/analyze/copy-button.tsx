"use client";

import { useState } from "react";

export function CopyButton({ text, label, copiedLabel }: { text: string; label: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied (insecure context, permissions); nothing else to do.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-subtle hover:bg-soft hover:text-foreground"
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
