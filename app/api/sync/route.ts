import { NextResponse, type NextRequest } from "next/server";

import { AppError, toErrorResponse } from "@/lib/errors";
import { forwardToN8n, isSyncConfigured } from "@/lib/n8n";
import { SyncRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Lets the UI hide the sync button when no webhook is configured. */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ configured: isSyncConfigured() });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json().catch(() => {
      throw new AppError("Expected a JSON body.", 400);
    });

    const parsed = SyncRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("Expected { kind: 'plan' | 'digest', payload }.", 422);
    }

    await forwardToN8n(parsed.data.kind, parsed.data.payload);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
