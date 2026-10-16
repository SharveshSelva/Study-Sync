import { createGoogle } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import type { LanguageModel } from "ai";
import { createOllama } from "ai-sdk-ollama";

import { AppError } from "./errors";

/**
 * Which LLM backs the app.
 *
 * Everything goes through the Vercel AI SDK, so the Zod schemas in
 * schemas.ts and the prompts in prompts.ts are provider-independent —
 * switching provider is an environment variable, not a code change.
 */

export type ProviderName = "google" | "groq" | "ollama";

/** The two jobs have different difficulty, so they get different defaults. */
export type Task = "plan" | "notes";

type ProviderSpec = {
  label: string;
  /** Where to get a key, shown when one is missing. */
  keyVar: string | null;
  keyUrl: string | null;
  /** Planning is the harder task: vague syllabus to well-sequenced work. */
  planModel: string;
  /** The digest is mostly extraction and attribution — a smaller model copes. */
  notesModel: string;
  /** Used when the primary model returns a transient failure (see generate.ts). */
  planFallback: string;
  notesFallback: string;
  build: (modelId: string) => LanguageModel;
};

const PROVIDERS: Record<ProviderName, ProviderSpec> = {
  google: {
    label: "Google Gemini",
    keyVar: "GOOGLE_GENERATIVE_AI_API_KEY",
    keyUrl: "https://aistudio.google.com/apikey",
    // The 2.5 line is still listed by the models endpoint but is closed to
    // newly created API keys, so the defaults track the 3.x line.
    // 3.8 and 3.7 were both returning 503 "high demand" in testing while 3.6
    // and below were healthy, so the default sits on 3.6.
    planModel: "gemini-3.6-flash",
    notesModel: "gemini-3.5-flash-lite",
    planFallback: "gemini-3.5-flash",
    notesFallback: "gemini-3.5-flash",
    build: (modelId) => createGoogle()(modelId),
  },
  groq: {
    label: "Groq",
    keyVar: "GROQ_API_KEY",
    keyUrl: "https://console.groq.com/keys",
    planModel: "llama-3.3-70b-versatile",
    notesModel: "llama-3.1-8b-instant",
    planFallback: "llama-3.1-8b-instant",
    notesFallback: "llama-3.3-70b-versatile",
    build: (modelId) => createGroq()(modelId),
  },
  ollama: {
    label: "Ollama (local)",
    // Local models need no key; the server just has to be running.
    keyVar: null,
    keyUrl: null,
    planModel: "llama3.1:8b",
    notesModel: "llama3.1:8b",
    planFallback: "llama3.1:8b",
    notesFallback: "llama3.1:8b",
    build: (modelId) =>
      createOllama({
        baseURL: process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434/api",
      })(modelId),
  },
};

function resolveProvider(): { name: ProviderName; spec: ProviderSpec } {
  const raw = (process.env.LLM_PROVIDER || "google").trim().toLowerCase();

  if (!(raw in PROVIDERS)) {
    throw new AppError(
      `LLM_PROVIDER is "${raw}", which is not one of: ${Object.keys(PROVIDERS).join(", ")}.`,
      500,
    );
  }

  const name = raw as ProviderName;
  return { name, spec: PROVIDERS[name] };
}

/** The model for a given task. Pass `fallback` for the secondary model. */
export function getModel(
  task: Task,
  opts: { fallback?: boolean } = {},
): { model: LanguageModel; modelId: string; provider: string } {
  const { spec } = resolveProvider();

  if (spec.keyVar && !process.env[spec.keyVar]) {
    throw new AppError(
      `${spec.keyVar} is not set. Get a key from ${spec.keyUrl} and add it to .env.local.`,
      500,
    );
  }

  const override = opts.fallback
    ? task === "plan"
      ? process.env.LLM_PLAN_FALLBACK_MODEL
      : process.env.LLM_NOTES_FALLBACK_MODEL
    : task === "plan"
      ? process.env.LLM_PLAN_MODEL
      : process.env.LLM_NOTES_MODEL;

  const fallbackDefault = task === "plan" ? spec.planFallback : spec.notesFallback;
  const primaryDefault = task === "plan" ? spec.planModel : spec.notesModel;
  const modelId = (override || (opts.fallback ? fallbackDefault : primaryDefault)).trim();

  return { model: spec.build(modelId), modelId, provider: spec.label };
}
