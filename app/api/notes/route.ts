import { NextResponse, type NextRequest } from "next/server";

import { AppError, toErrorResponse } from "@/lib/errors";
import { generateStructured } from "@/lib/generate";
import { guard } from "@/lib/guard";
import { NOTES_SYSTEM, notesUserMessage } from "@/lib/prompts";
import { NotesDigestSchema, NotesRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    guard(request);

    const body = await request.json().catch(() => {
      throw new AppError("Expected a JSON body.", 400);
    });

    const parsed = NotesRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? "Invalid request.", 422);
    }
    const input = parsed.data;

    const { output, finishReason } = await generateStructured({
      task: "notes",
      system: NOTES_SYSTEM,
      prompt: notesUserMessage(input),
      schema: NotesDigestSchema,
      maxOutputTokens: 16_000,
    });

    if (finishReason === "length") {
      throw new AppError(
        "The digest was cut off before it finished. Try splitting the notes up.",
        422,
      );
    }
    if (finishReason === "content-filter") {
      throw new AppError("The provider blocked these notes.", 422);
    }

    return NextResponse.json(output);
  } catch (error) {
    return toErrorResponse(error);
  }
}
