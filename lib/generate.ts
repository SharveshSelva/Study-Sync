import { Output, generateText } from "ai";
import type { z } from "zod";

import { AppError } from "./errors";
import { getModel, type Task } from "./model";

/**
 * Structured generation with an automatic second attempt on a different model.
 *
 * Gemini returns `503 UNAVAILABLE — this model is currently experiencing high
 * demand` for individual models fairly often, and it is per-model: one can be
 * saturated while its neighbours are fine. The AI SDK already retries the same
 * model and gives up, which during a live demo means a dead end. So when the
 * primary fails in a way that looks transient, we try the fallback model once
 * before surfacing an error.
 */

/** Errors worth retrying on a different model rather than reporting. */
function isTransient(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const text = `${error.name} ${error.message}`;
  return (
    /AI_RetryError|maxRetriesExceeded/i.test(text) ||
    /\b(429|500|502|503|504)\b/.test(text) ||
    /high demand|unavailable|overloaded|rate.?limit/i.test(text)
  );
}

export type GenerateResult<T> = {
  output: T;
  finishReason: string;
  /** Which model actually produced this, useful in logs. */
  modelId: string;
  /** True when the primary model failed and the fallback was used. */
  usedFallback: boolean;
};

export async function generateStructured<S extends z.ZodType>({
  task,
  system,
  prompt,
  schema,
  maxOutputTokens,
}: {
  task: Task;
  system: string;
  prompt: string;
  schema: S;
  maxOutputTokens: number;
}): Promise<GenerateResult<z.infer<S>>> {
  const primary = getModel(task);

  async function run(
    model: typeof primary,
  ): Promise<{ output: z.infer<S>; finishReason: string; modelId: string }> {
    const { output, finishReason } = await generateText({
      model: model.model,
      system,
      prompt,
      maxOutputTokens,
      output: Output.object({ schema }),
    });
    // Output.object validates against the schema, but the generic parameter
    // does not survive the SDK's inference, so narrow it here.
    return { output: output as z.infer<S>, finishReason, modelId: model.modelId };
  }

  try {
    return { ...(await run(primary)), usedFallback: false };
  } catch (error) {
    if (!isTransient(error)) throw error;

    const fallback = getModel(task, { fallback: true });
    if (fallback.modelId === primary.modelId) {
      throw new AppError(
        `${primary.modelId} is busy right now and there is no fallback configured. Try again shortly.`,
        503,
      );
    }

    console.warn(
      `${primary.modelId} failed transiently; retrying on ${fallback.modelId}.`,
      error instanceof Error ? error.message : error,
    );

    try {
      return { ...(await run(fallback)), usedFallback: true };
    } catch (fallbackError) {
      if (isTransient(fallbackError)) {
        throw new AppError(
          `Both ${primary.modelId} and ${fallback.modelId} are busy right now. This is upstream capacity, not your request — try again in a minute.`,
          503,
        );
      }
      throw fallbackError;
    }
  }
}
