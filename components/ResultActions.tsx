"use client";

import { useState } from "react";

import { SyncButton } from "@/components/SyncButton";
import { Button } from "@/components/ui";

/** Copy, download and Notion sync for a finished result. */
export function ResultActions({
  kind,
  payload,
  markdown,
  filename,
  onReset,
}: {
  kind: "plan" | "digest";
  payload: unknown;
  markdown: string;
  filename: string;
  onReset: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is blocked in some embedded browsers; the download still works.
      setCopied(false);
    }
  }

  function download() {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="no-print flex flex-wrap items-start gap-2">
      <Button variant="secondary" onClick={copy}>
        {copied ? "Copied ✓" : "Copy as Markdown"}
      </Button>
      <Button variant="secondary" onClick={download}>
        Download .md
      </Button>
      <SyncButton kind={kind} payload={payload} markdown={markdown} />
      <Button variant="ghost" onClick={onReset} className="ml-auto">
        Start over
      </Button>
    </div>
  );
}
