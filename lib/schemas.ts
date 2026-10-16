import { z } from "zod";

/* ------------------------------------------------------------------ *
 * Shared enums
 * ------------------------------------------------------------------ */

export const TASK_KINDS = ["read", "practice", "revise", "test", "project"] as const;
export const PRIORITIES = ["high", "medium", "low"] as const;
export const LEVELS = ["beginner", "intermediate", "advanced"] as const;

export type TaskKind = (typeof TASK_KINDS)[number];
export type Priority = (typeof PRIORITIES)[number];
export type Level = (typeof LEVELS)[number];

/* ------------------------------------------------------------------ *
 * Study plan — what the model returns
 *
 * The model never emits calendar dates. It works in day numbers and the
 * server maps those onto real dates (see lib/schedule.ts), because date
 * arithmetic is the one part of this an LLM reliably gets wrong.
 * ------------------------------------------------------------------ */

export const StudyTaskSchema = z.object({
  title: z
    .string()
    .describe("One concrete action, e.g. 'Work 15 integration-by-parts problems from ch.7'"),
  kind: z.enum(TASK_KINDS).describe("The kind of work this task is"),
  minutes: z.number().int().describe("Realistic minutes this task takes"),
  resource: z
    .string()
    .nullable()
    .describe("Specific chapter, section or resource to use, or null if none applies"),
});

export const StudyDaySchema = z.object({
  dayNumber: z.number().int().describe("1-based index of this study session"),
  focus: z.string().describe("The single theme for this session, under 8 words"),
  tasks: z.array(StudyTaskSchema).describe("2 to 5 tasks that fit the available time"),
  checkpoint: z
    .string()
    .nullable()
    .describe("A quick self-check proving the material stuck, or null"),
});

export const MilestoneSchema = z.object({
  title: z.string(),
  afterDay: z.number().int().describe("The dayNumber this milestone falls on"),
  description: z.string(),
});

export const StudyPlanSchema = z.object({
  subject: z.string().describe("The subject inferred from the syllabus"),
  summary: z.string().describe("2-3 sentences on how this plan is structured and why"),
  milestones: z.array(MilestoneSchema).describe("3 to 6 checkpoints across the plan"),
  days: z.array(StudyDaySchema).describe("One entry per study session, in order"),
  riskAreas: z
    .array(z.string())
    .describe("Topics students most often underestimate in this syllabus"),
  tips: z.array(z.string()).describe("3 to 5 tactics specific to this material"),
});

/* ------------------------------------------------------------------ *
 * Group notes digest — what the model returns
 * ------------------------------------------------------------------ */

export const OpenDoubtSchema = z.object({
  question: z.string().describe("The unresolved question, phrased clearly"),
  context: z.string().describe("One sentence on where this came up"),
  priority: z.enum(PRIORITIES),
  suggestedOwner: z
    .string()
    .nullable()
    .describe("Member best placed to resolve it, or null if unclear"),
});

export const ActionItemSchema = z.object({
  member: z.string().describe("Exact member name from the roster, or 'Unassigned'"),
  task: z.string().describe("One concrete, finishable action"),
  priority: z.enum(PRIORITIES),
  dueHint: z
    .string()
    .nullable()
    .describe("Timing mentioned in the notes, e.g. 'before Friday', or null"),
});

export const NotesDigestSchema = z.object({
  sessionTitle: z.string().describe("A short title for this session"),
  summary: z.string().describe("3-5 sentences covering what the group actually got through"),
  keyPoints: z.array(z.string()).describe("The substantive points worth keeping"),
  decisions: z.array(z.string()).describe("Things the group settled on"),
  openDoubts: z.array(OpenDoubtSchema),
  actionItems: z.array(ActionItemSchema),
  nextAgenda: z.array(z.string()).describe("What the next session should cover"),
});

/**
 * Models are asked for `null` when nobody obviously owns something, but they
 * often write the literal string "Unassigned" instead. Both mean the same
 * thing, and rendering "Ask Unassigned" reads as a bug, so normalise here.
 */
export function namedOwner(owner: string | null): string | null {
  const trimmed = owner?.trim();
  if (!trimmed || trimmed.toLowerCase() === "unassigned") return null;
  return trimmed;
}

/* ------------------------------------------------------------------ *
 * Server-side enrichment (dates + totals added after generation)
 * ------------------------------------------------------------------ */

export type StudyTask = z.infer<typeof StudyTaskSchema>;
export type Milestone = z.infer<typeof MilestoneSchema>;
export type RawStudyDay = z.infer<typeof StudyDaySchema>;
export type RawStudyPlan = z.infer<typeof StudyPlanSchema>;
export type NotesDigest = z.infer<typeof NotesDigestSchema>;
export type OpenDoubt = z.infer<typeof OpenDoubtSchema>;
export type ActionItem = z.infer<typeof ActionItemSchema>;

export type StudyDay = RawStudyDay & {
  /** ISO date (YYYY-MM-DD) assigned by the server. */
  date: string;
  /** Sum of task minutes, computed by the server. */
  totalMinutes: number;
};

export type DatedMilestone = Milestone & { date: string };

export type StudyPlan = Omit<RawStudyPlan, "days" | "milestones"> & {
  days: StudyDay[];
  milestones: DatedMilestone[];
  meta: {
    startDate: string;
    examDate: string;
    hoursPerDay: number;
    daysPerWeek: number;
    level: Level;
    totalSessions: number;
    totalMinutes: number;
    /** Set when the date range was longer than the plan cap. */
    truncatedTo: number | null;
  };
};

/* ------------------------------------------------------------------ *
 * Request payloads
 * ------------------------------------------------------------------ */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a date in YYYY-MM-DD format");

export const PlanRequestSchema = z
  .object({
    syllabus: z
      .string()
      .trim()
      .min(20, "Paste a bit more of your syllabus — at least 20 characters.")
      .max(20_000, "That syllabus is too long. Trim it to 20,000 characters or fewer."),
    startDate: isoDate,
    examDate: isoDate,
    hoursPerDay: z.number().min(0.5).max(16),
    daysPerWeek: z.number().int().min(1).max(7),
    level: z.enum(LEVELS),
  })
  .refine((v) => v.examDate > v.startDate, {
    message: "The exam date has to be after the start date.",
    path: ["examDate"],
  });

export const NotesRequestSchema = z.object({
  rawNotes: z
    .string()
    .trim()
    .min(20, "Paste a bit more of your notes — at least 20 characters.")
    .max(20_000, "Those notes are too long. Trim them to 20,000 characters or fewer."),
  members: z.array(z.string().trim().min(1).max(60)).max(20),
  sessionTitle: z.string().trim().max(120),
});

export const SyncRequestSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("plan"), payload: z.unknown() }),
  z.object({ kind: z.literal("digest"), payload: z.unknown() }),
]);

export type PlanRequest = z.infer<typeof PlanRequestSchema>;
export type NotesRequest = z.infer<typeof NotesRequestSchema>;
