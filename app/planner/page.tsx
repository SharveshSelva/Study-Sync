import type { Metadata } from "next";

import { PlannerWorkspace } from "@/components/PlannerWorkspace";

export const metadata: Metadata = {
  title: "Planner",
  description: "Turn a syllabus into a dated, day-by-day study plan.",
};

export default function PlannerPage() {
  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Study planner</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          Paste your syllabus and say how much time you actually have. You get dated sessions with
          specific tasks, earlier topics revisited later on, and the run-up to the exam kept for
          practice rather than new material.
        </p>
      </header>

      <PlannerWorkspace />
    </div>
  );
}
