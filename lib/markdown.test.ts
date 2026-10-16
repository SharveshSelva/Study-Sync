import { describe, expect, it } from "vitest";

import { digestToMarkdown, planToMarkdown } from "./markdown";
import type { NotesDigest, StudyPlan } from "./schemas";

const plan: StudyPlan = {
  subject: "CS3001 Operating Systems",
  summary: "Three weeks, three sessions a week.",
  milestones: [
    {
      title: "Synchronisation solid",
      afterDay: 2,
      date: "2026-10-21",
      description: "Bounded buffer from memory.",
    },
  ],
  days: [
    {
      dayNumber: 1,
      date: "2026-10-19",
      focus: "Processes",
      totalMinutes: 90,
      checkpoint: "Draw the PCB fields.",
      tasks: [
        { title: "Read ch.3", kind: "read", minutes: 45, resource: "Silberschatz ch.3" },
        { title: "Trace a context switch", kind: "practice", minutes: 45, resource: null },
      ],
    },
  ],
  riskAreas: ["Banker's algorithm"],
  tips: ["Write semaphore solutions by hand."],
  meta: {
    startDate: "2026-10-19",
    examDate: "2026-11-02",
    hoursPerDay: 2,
    daysPerWeek: 3,
    level: "intermediate",
    totalSessions: 1,
    totalMinutes: 90,
    truncatedTo: null,
  },
};

const digest: NotesDigest = {
  sessionTitle: "Deadlock and memory management",
  summary: "The group worked through the Coffman conditions.",
  keyPoints: ["Need = Max - Allocation"],
  decisions: ["Meet Thursday 6pm."],
  openDoubts: [
    {
      question: "Safety check before or after?",
      context: "Lecture 9 example.",
      priority: "high",
      suggestedOwner: "Priya",
    },
    {
      question: "Why is LRU immune to Belady?",
      context: "Nobody could explain it.",
      priority: "low",
      // The model often writes this literal string instead of null.
      suggestedOwner: "Unassigned",
    },
  ],
  actionItems: [
    { member: "Arun", task: "Type up deadlock notes", priority: "high", dueHint: "before Thursday" },
    { member: "Unassigned", task: "Book a timed paper sit", priority: "medium", dueHint: null },
  ],
  nextAgenda: ["Cover the clock algorithm."],
};

describe("planToMarkdown", () => {
  const md = planToMarkdown(plan);

  it("opens with the subject as a heading", () => {
    expect(md.startsWith("# CS3001 Operating Systems — study plan")).toBe(true);
  });

  it("renders the real calendar date, not the session number", () => {
    expect(md).toContain("Mon 19 Oct");
  });

  it("renders tasks as checkboxes with kind and duration", () => {
    expect(md).toContain("- [ ] **read** · Read ch.3 — 45m");
  });

  it("includes a resource when present", () => {
    expect(md).toContain("_(Silberschatz ch.3)_");
  });

  it("omits the resource suffix when null", () => {
    expect(md).toContain("Trace a context switch — 45m\n");
  });

  it("renders the checkpoint as a quote", () => {
    expect(md).toContain("> Checkpoint: Draw the PCB fields.");
  });

  it("dates milestones from their session number", () => {
    expect(md).toContain("session 2 (Wed 21 Oct)");
  });

  it("pluralises a single session correctly", () => {
    expect(md).toContain("**1 session**");
    expect(md).not.toContain("**1 sessions**");
  });
});

describe("digestToMarkdown", () => {
  const md = digestToMarkdown(digest);

  it("opens with the session title", () => {
    expect(md.startsWith("# Deadlock and memory management")).toBe(true);
  });

  it("names a suggested owner on a doubt", () => {
    expect(md).toContain("**[high]** Safety check before or after? — suggested: Priya");
  });

  it("does not write 'suggested: Unassigned'", () => {
    expect(md).not.toContain("suggested: Unassigned");
  });

  it("renders an owned task as a checkbox", () => {
    expect(md).toContain("- [ ] **Arun** — Type up deadlock notes `high` _(before Thursday)_");
  });

  it("omits the due hint when null", () => {
    expect(md).toContain("- [ ] **Unassigned** — Book a timed paper sit `medium`\n");
  });
});
