"use client";

import { useEffect, useState } from "react";

import { Button, Spinner } from "@/components/ui";
import { apiFetch } from "@/lib/client";

type Status = "idle" | "sending" | "sent" | "error";

/**
 * Pushes a finished plan or digest to n8n, which writes it into Notion.
 * Renders nothing at all when no webhook is configured, so a local setup
 * without n8n does not show a button that can only fail.
 */
export function SyncButton({
  kind,
  payload,
  markdown,
}: {
  kind: "plan" | "digest";
  payload: unknown;
  markdown: string;
}) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch("/api/sync")
      .then((response) => response.json())
      .then((data: { configured?: boolean }) => {
        if (active) setConfigured(Boolean(data.configured));
      })
      .catch(() => {
        if (active) setConfigured(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Any new result should be sendable again.
  useEffect(() => {
    setStatus("idle");
    setError(null);
  }, [payload]);

  if (configured !== true) return null;

  async function send() {
    setStatus("sending");
    setError(null);
    try {
      const response = await apiFetch("/api/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, payload: { ...(payload as object), markdown } }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Sync failed (HTTP ${response.status}).`);
      }
      setStatus("sent");
    } catch (cause) {
      setStatus("error");
      setError(cause instanceof Error ? cause.message : "Sync failed.");
    }
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <Button variant="secondary" onClick={send} disabled={status === "sending"}>
        {status === "sending" ? (
          <Spinner label="Sending…" />
        ) : status === "sent" ? (
          "Sent to Notion ✓"
        ) : (
          "Send to Notion"
        )}
      </Button>
      {error ? <p className="text-xs text-critical">{error}</p> : null}
    </div>
  );
}
