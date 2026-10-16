import { namedOwner, type NotesDigest, type StudyPlan } from "./schemas";
import { formatMinutes, formatShort } from "./schedule";

/**
 * Markdown renderings of both outputs. Used by the copy and download
 * buttons, and sent alongside the JSON to n8n so a Notion page can be
 * created without the workflow having to rebuild the formatting itself.
 */

export function planToMarkdown(plan: StudyPlan): string {
  const lines: string[] = [];

  lines.push(`# ${plan.subject} — study plan`, "");
  lines.push(plan.summary, "");
  const sessions = plan.meta.totalSessions;
  const perWeek = plan.meta.daysPerWeek;
  lines.push(
    `**${sessions} ${sessions === 1 ? "session" : "sessions"}** · ${plan.meta.hoursPerDay}h per session · ` +
      `${perWeek} ${perWeek === 1 ? "day" : "days"} a week · exam ${plan.meta.examDate}`,
    "",
  );

  if (plan.milestones.length > 0) {
    lines.push("## Milestones", "");
    for (const milestone of plan.milestones) {
      lines.push(
        `- **${milestone.title}** — session ${milestone.afterDay} (${formatShort(milestone.date)}): ${milestone.description}`,
      );
    }
    lines.push("");
  }

  lines.push("## Sessions", "");
  for (const day of plan.days) {
    lines.push(
      `### Day ${day.dayNumber} · ${formatShort(day.date)} — ${day.focus} (${formatMinutes(day.totalMinutes)})`,
      "",
    );
    for (const task of day.tasks) {
      const resource = task.resource ? ` _(${task.resource})_` : "";
      lines.push(`- [ ] **${task.kind}** · ${task.title} — ${formatMinutes(task.minutes)}${resource}`);
    }
    if (day.checkpoint) lines.push("", `> Checkpoint: ${day.checkpoint}`);
    lines.push("");
  }

  if (plan.riskAreas.length > 0) {
    lines.push("## Watch out for", "");
    for (const risk of plan.riskAreas) lines.push(`- ${risk}`);
    lines.push("");
  }

  if (plan.tips.length > 0) {
    lines.push("## Tips", "");
    for (const tip of plan.tips) lines.push(`- ${tip}`);
    lines.push("");
  }

  return lines.join("\n");
}

export function digestToMarkdown(digest: NotesDigest): string {
  const lines: string[] = [];

  lines.push(`# ${digest.sessionTitle}`, "", digest.summary, "");

  if (digest.keyPoints.length > 0) {
    lines.push("## Key points", "");
    for (const point of digest.keyPoints) lines.push(`- ${point}`);
    lines.push("");
  }

  if (digest.decisions.length > 0) {
    lines.push("## Decisions", "");
    for (const decision of digest.decisions) lines.push(`- ${decision}`);
    lines.push("");
  }

  if (digest.openDoubts.length > 0) {
    lines.push("## Open doubts", "");
    for (const doubt of digest.openDoubts) {
      const named = namedOwner(doubt.suggestedOwner);
      const owner = named ? ` — suggested: ${named}` : "";
      lines.push(`- **[${doubt.priority}]** ${doubt.question}${owner}`, `  - ${doubt.context}`);
    }
    lines.push("");
  }

  if (digest.actionItems.length > 0) {
    lines.push("## Action items", "");
    for (const item of digest.actionItems) {
      const due = item.dueHint ? ` _(${item.dueHint})_` : "";
      lines.push(`- [ ] **${item.member}** — ${item.task} \`${item.priority}\`${due}`);
    }
    lines.push("");
  }

  if (digest.nextAgenda.length > 0) {
    lines.push("## Next session", "");
    for (const item of digest.nextAgenda) lines.push(`- ${item}`);
    lines.push("");
  }

  return lines.join("\n");
}
