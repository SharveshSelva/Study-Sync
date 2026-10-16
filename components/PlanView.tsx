import { Card, Pill, SectionTitle, Stat } from "@/components/ui";
import type { StudyDay, StudyPlan, TaskKind } from "@/lib/schemas";
import { formatLong, formatMinutes, formatShort } from "@/lib/schedule";

const KIND_TONE: Record<TaskKind, "accent" | "positive" | "caution" | "critical" | "neutral"> = {
  read: "accent",
  practice: "positive",
  revise: "caution",
  test: "critical",
  project: "neutral",
};

/** Splits sessions into week-sized groups so a 40-day plan stays scannable. */
function intoWeeks(days: StudyDay[], perWeek: number): StudyDay[][] {
  const size = Math.max(1, perWeek);
  const weeks: StudyDay[][] = [];
  for (let i = 0; i < days.length; i += size) weeks.push(days.slice(i, i + size));
  return weeks;
}

export function PlanView({ plan }: { plan: StudyPlan }) {
  const weeks = intoWeeks(plan.days, plan.meta.daysPerWeek);
  const totalHours = Math.round((plan.meta.totalMinutes / 60) * 10) / 10;

  return (
    <div className="flex flex-col gap-8">
      <Card>
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{plan.subject}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{plan.summary}</p>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Sessions" value={String(plan.meta.totalSessions)} />
          <Stat label="Total time" value={`${totalHours}h`} />
          <Stat label="Per session" value={`${plan.meta.hoursPerDay}h`} />
          <Stat label="Exam" value={formatShort(plan.meta.examDate)} />
        </div>

        {plan.meta.truncatedTo ? (
          <p className="mt-4 rounded-xl border border-caution/40 bg-caution/10 px-4 py-3 text-sm text-caution">
            That range held more study days than one plan covers, so this plan is the first{" "}
            {plan.meta.truncatedTo} sessions. Generate again nearer the exam for the rest.
          </p>
        ) : null}
      </Card>

      {plan.milestones.length > 0 ? (
        <section>
          <SectionTitle>Milestones</SectionTitle>
          <ol className="flex flex-col gap-2">
            {plan.milestones.map((milestone) => (
              <li
                key={`${milestone.afterDay}-${milestone.title}`}
                className="flex gap-3 rounded-xl border border-line bg-surface px-4 py-3"
              >
                <span className="mt-0.5 shrink-0 text-xs font-semibold text-accent">
                  Day {milestone.afterDay}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{milestone.title}</p>
                  <p className="mt-0.5 text-sm text-muted">{milestone.description}</p>
                  <p className="mt-1 text-xs text-faint">{formatShort(milestone.date)}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section>
        <SectionTitle hint={`${plan.days.length} ${plan.days.length === 1 ? "session" : "sessions"}`}>
          Schedule
        </SectionTitle>
        <div className="flex flex-col gap-6">
          {weeks.map((week, index) => (
            <div key={index}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">
                Week {index + 1}
              </h3>
              <div className="flex flex-col gap-3">
                {week.map((day) => (
                  <DayCard key={day.dayNumber} day={day} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        {plan.riskAreas.length > 0 ? (
          <section>
            <SectionTitle>Watch out for</SectionTitle>
            <Card>
              <ul className="flex list-disc flex-col gap-2 pl-4 text-sm leading-relaxed text-muted">
                {plan.riskAreas.map((risk) => (
                  <li key={risk}>{risk}</li>
                ))}
              </ul>
            </Card>
          </section>
        ) : null}

        {plan.tips.length > 0 ? (
          <section>
            <SectionTitle>Tips</SectionTitle>
            <Card>
              <ul className="flex list-disc flex-col gap-2 pl-4 text-sm leading-relaxed text-muted">
                {plan.tips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </Card>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function DayCard({ day }: { day: StudyDay }) {
  return (
    <article className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <p className="text-xs font-medium text-accent">
            Day {day.dayNumber} &middot; <time dateTime={day.date}>{formatLong(day.date)}</time>
          </p>
          <h4 className="mt-0.5 font-medium tracking-tight">{day.focus}</h4>
        </div>
        <Pill>{formatMinutes(day.totalMinutes)}</Pill>
      </header>

      <ul className="mt-3 flex flex-col gap-2.5">
        {day.tasks.map((task, index) => (
          <li key={index} className="flex gap-3">
            <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone={KIND_TONE[task.kind]}>{task.kind}</Pill>
                <span className="text-xs text-faint">{formatMinutes(task.minutes)}</span>
              </div>
              <p className="mt-1 text-sm leading-relaxed">{task.title}</p>
              {task.resource ? <p className="mt-0.5 text-xs text-faint">{task.resource}</p> : null}
            </div>
          </li>
        ))}
      </ul>

      {day.checkpoint ? (
        <p className="mt-4 rounded-xl border border-line bg-raised px-3 py-2 text-sm text-muted">
          <span className="font-medium text-ink">Checkpoint &mdash; </span>
          {day.checkpoint}
        </p>
      ) : null}
    </article>
  );
}
