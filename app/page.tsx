import Link from "next/link";

import { Card } from "@/components/ui";

const FEATURES = [
  {
    href: "/planner",
    eyebrow: "Plan",
    title: "Syllabus to a day-by-day plan",
    body: "Paste the syllabus, say how long you have and how much time you can give it. You get dated sessions with specific tasks, spaced revision built in, and the last week kept free for practice papers.",
    cta: "Build a plan",
  },
  {
    href: "/notes",
    eyebrow: "Sync",
    title: "Group notes to clear tasks",
    body: "Drop in whatever the group typed during the session. You get a summary, the questions nobody answered, and one owner per action item — then push the whole thing to Notion.",
    cta: "Clean up notes",
  },
];

const STEPS = [
  ["Paste", "A syllabus, or the notes your group just made. Rough is fine."],
  ["Generate", "Claude turns it into dated sessions or an owned task list."],
  ["Share", "Send it to Notion through n8n so the group tracks it in one place."],
];

export default function HomePage() {
  return (
    <div className="flex flex-col gap-14">
      <section className="pt-4 sm:pt-10">
        <p className="mb-3 text-sm font-medium text-accent">AI study planner</p>
        <h1 className="max-w-2xl text-3xl font-semibold leading-tight tracking-tight text-balance sm:text-5xl">
          Know what to study today, and who owes what to the group.
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
          StudySync takes the two things that quietly derail revision — a syllabus nobody has broken
          down, and group notes nobody has read back — and turns both into something you can act on.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href="/planner"
            className="rounded-xl bg-accent px-5 py-3 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90"
          >
            Build a study plan
          </Link>
          <Link
            href="/notes"
            className="rounded-xl border border-line bg-raised px-5 py-3 text-sm font-medium transition-colors hover:border-accent/60"
          >
            Turn notes into tasks
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {FEATURES.map((feature) => (
          <Card key={feature.href} className="flex flex-col">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">
              {feature.eyebrow}
            </p>
            <h2 className="mt-2 text-lg font-semibold tracking-tight">{feature.title}</h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{feature.body}</p>
            <Link
              href={feature.href}
              className="mt-5 inline-flex w-fit items-center gap-1 text-sm font-medium text-accent hover:underline"
            >
              {feature.cta}
              <span aria-hidden>→</span>
            </Link>
          </Card>
        ))}
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
          How it works
        </h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {STEPS.map(([title, body], index) => (
            <li key={title} className="rounded-2xl border border-line bg-surface p-5">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent-soft text-sm font-semibold text-accent">
                {index + 1}
              </span>
              <h3 className="mt-3 font-medium">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
