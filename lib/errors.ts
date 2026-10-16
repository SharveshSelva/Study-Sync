import {
  APICallError,
  LoadAPIKeyError,
  NoOutputGeneratedError,
  TypeValidationError,
} from "ai";
import { NextResponse } from "next/server";

/** An error whose message is safe to show the user verbatim. */
export class AppError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export type ApiErrorBody = { error: string };

/**
 * Maps anything thrown inside a route handler onto a response with a message
 * a student can act on. Unexpected errors are logged in full but reported
 * generically, so internal details never reach the browser.
 *
 * The AI SDK's `isInstance` helpers are used instead of `instanceof` because
 * a duplicated copy of the package in the dependency tree breaks `instanceof`.
 */
export function toErrorResponse(error: unknown): NextResponse<ApiErrorBody> {
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (LoadAPIKeyError.isInstance(error)) {
    return NextResponse.json(
      { error: "No API key was found for the configured provider. Check your .env.local." },
      { status: 500 },
    );
  }

  // The model replied, but not with something matching the schema. Small and
  // local models do this; it is usually worth one more attempt.
  if (NoOutputGeneratedError.isInstance(error) || TypeValidationError.isInstance(error)) {
    console.error("Model output did not match the schema:", error);
    return NextResponse.json(
      {
        error:
          "The model returned something that did not fit the expected format. Try again, or switch to a stronger model with LLM_PLAN_MODEL / LLM_NOTES_MODEL.",
      },
      { status: 502 },
    );
  }

  if (APICallError.isInstance(error)) {
    const status = error.statusCode ?? 0;
    console.error(`Provider API error ${status}:`, error.message);

    if (status === 401 || status === 403) {
      return NextResponse.json(
        { error: "The provider rejected your API key. Check it is correct and still active." },
        { status: 500 },
      );
    }
    if (status === 429) {
      return NextResponse.json(
        {
          error:
            "You have hit the provider's rate limit. Wait a moment and try again — free tiers cap requests per minute.",
        },
        { status: 429 },
      );
    }
    if (status === 404) {
      return NextResponse.json(
        {
          error:
            "The configured model name was not found. Providers retire models; set LLM_PLAN_MODEL or LLM_NOTES_MODEL to a current one.",
        },
        { status: 500 },
      );
    }
    if (error.isRetryable) {
      return NextResponse.json(
        { error: "The provider is having trouble right now. Try again in a moment." },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: "The provider returned an error. Check the server logs for details." },
      { status: 502 },
    );
  }

  // Ollama refusing connections is the common local-setup failure.
  if (error instanceof Error && /ECONNREFUSED|fetch failed/i.test(error.message)) {
    return NextResponse.json(
      {
        error:
          "Could not reach the model provider. If you are using Ollama, check that `ollama serve` is running.",
      },
      { status: 503 },
    );
  }

  console.error("Unhandled error in route handler:", error);
  return NextResponse.json({ error: "Something went wrong on our end." }, { status: 500 });
}
