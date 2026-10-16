import { AppError } from "./errors";

/**
 * Forwards a finished plan or digest to an n8n webhook, which is where the
 * Notion write actually happens. Keeping Notion behind n8n means the group
 * can re-point the workflow (different database, extra Slack step, whatever)
 * without this app being redeployed.
 *
 * See n8n/studysync-notion-workflow.json for an importable workflow.
 */

export function isSyncConfigured(): boolean {
  return Boolean(process.env.N8N_WEBHOOK_URL);
}

export type SyncKind = "plan" | "digest";

export async function forwardToN8n(kind: SyncKind, payload: unknown): Promise<void> {
  const url = process.env.N8N_WEBHOOK_URL;

  if (!url) {
    throw new AppError(
      "Notion sync is not configured. Set N8N_WEBHOOK_URL in your environment to enable it.",
      501,
    );
  }

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (process.env.N8N_WEBHOOK_SECRET) {
    headers["x-studysync-secret"] = process.env.N8N_WEBHOOK_SECRET;
  }

  // n8n workflows that hit the Notion API can be slow; give it room but do
  // not let a hung webhook hold the request open indefinitely.
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ kind, sentAt: new Date().toISOString(), payload }),
    signal: AbortSignal.timeout(30_000),
  }).catch((cause: unknown) => {
    if (cause instanceof DOMException && cause.name === "TimeoutError") {
      throw new AppError("The n8n webhook did not respond within 30 seconds.", 504);
    }
    throw new AppError("Could not reach the n8n webhook. Check N8N_WEBHOOK_URL.", 502);
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new AppError(
      `n8n rejected the request (HTTP ${response.status}).${detail ? ` ${detail.slice(0, 200)}` : ""}`,
      502,
    );
  }
}
