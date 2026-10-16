import { NextResponse, type NextRequest } from "next/server";

import { AppError, toErrorResponse } from "@/lib/errors";
import { generateStructured } from "@/lib/generate";
import { guard } from "@/lib/guard";
import { PLANNER_SYSTEM, plannerUserMessage } from "@/lib/prompts";
import {
  PlanRequestSchema,
  StudyPlanSchema,
  type DatedMilestone,
  type StudyDay,
  type StudyPlan,
} from "@/lib/schemas";
import { MAX_SESSIONS, buildSchedule, countAvailableSessions } from "@/lib/schedule";

export const runtime = "nodejs";
// Vercel's Hobby plan caps functions at 60s and rejects a higher value at
// deploy time. Generation measured ~49s for a 20-session plan, so this is
// tight: on Pro, raise this to 300.
export const maxDuration = 60;

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    guard(request);

    const body = await request.json().catch(() => {
      throw new AppError("Expected a JSON body.", 400);
    });

    const parsed = PlanRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? "Invalid request.", 422);
    }
    const input = parsed.data;

    const schedule = buildSchedule(input.startDate, input.examDate, input.daysPerWeek);
    if (schedule.length === 0) {
      throw new AppError(
        "That date range has no study days in it. Move the dates apart or raise days per week.",
        422,
      );
    }

    const available = countAvailableSessions(input.startDate, input.examDate, input.daysPerWeek);
    const truncatedTo = available > MAX_SESSIONS ? MAX_SESSIONS : null;

    const { output, finishReason } = await generateStructured({
      task: "plan",
      system: PLANNER_SYSTEM,
      prompt: plannerUserMessage(input, schedule.length),
      schema: StudyPlanSchema,
      maxOutputTokens: 32_000,
    });

    if (finishReason === "length") {
      throw new AppError(
        "The plan was cut off before it finished. Shorten the syllabus or pick a closer exam date.",
        422,
      );
    }
    if (finishReason === "content-filter") {
      throw new AppError("The provider blocked this syllabus. Try rephrasing or trimming it.", 422);
    }

    return NextResponse.json(enrich(output, input, schedule, truncatedTo));
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * Attaches real dates and computed totals to the model's output. The model
 * works purely in session numbers, so this is where a plan becomes a calendar.
 */
function enrich(
  raw: typeof StudyPlanSchema._output,
  input: typeof PlanRequestSchema._output,
  schedule: string[],
  truncatedTo: number | null,
): StudyPlan {
  const ordered = [...raw.days].sort((a, b) => a.dayNumber - b.dayNumber);

  // Pair sessions with dates by position, so a model that mis-numbers a day
  // still produces a plan in the right order on the right dates.
  const days: StudyDay[] = ordered.slice(0, schedule.length).map((day, index) => ({
    ...day,
    dayNumber: index + 1,
    date: schedule[index]!,
    totalMinutes: day.tasks.reduce((sum, task) => sum + task.minutes, 0),
  }));

  const milestones: DatedMilestone[] = raw.milestones.map((milestone) => {
    const clamped = Math.min(Math.max(milestone.afterDay, 1), days.length);
    return { ...milestone, afterDay: clamped, date: schedule[clamped - 1]! };
  });

  return {
    subject: raw.subject,
    summary: raw.summary,
    riskAreas: raw.riskAreas,
    tips: raw.tips,
    days,
    milestones,
    meta: {
      startDate: input.startDate,
      examDate: input.examDate,
      hoursPerDay: input.hoursPerDay,
      daysPerWeek: input.daysPerWeek,
      level: input.level,
      totalSessions: days.length,
      totalMinutes: days.reduce((sum, day) => sum + day.totalMinutes, 0),
      truncatedTo,
    },
  };
}
