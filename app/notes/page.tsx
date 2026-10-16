import type { Metadata } from "next";

import { NotesWorkspace } from "@/components/NotesWorkspace";

export const metadata: Metadata = {
  title: "Group notes",
  description: "Turn messy group study notes into a summary, open doubts and owned action items.",
};

export default function NotesPage() {
  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Group notes</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          Paste whatever your group typed during the session. You get a summary, the questions
          nobody answered, and an action list where every task has an owner &mdash; then push it all
          to Notion.
        </p>
      </header>

      <NotesWorkspace />
    </div>
  );
}
