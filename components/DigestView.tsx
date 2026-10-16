import { Card, Pill, PriorityPill, SectionTitle } from "@/components/ui";
import { namedOwner, type ActionItem, type NotesDigest } from "@/lib/schemas";

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

/** Groups the action list by owner, because "who owes what" is the question. */
function byMember(items: ActionItem[]): Array<[string, ActionItem[]]> {
  const groups = new Map<string, ActionItem[]>();
  for (const item of items) {
    const existing = groups.get(item.member);
    if (existing) existing.push(item);
    else groups.set(item.member, [item]);
  }

  return [...groups.entries()].sort(([a], [b]) => {
    // Unassigned work sinks to the bottom; it needs an owner, not attention first.
    if (a === "Unassigned") return 1;
    if (b === "Unassigned") return -1;
    return a.localeCompare(b);
  });
}

export function DigestView({ digest }: { digest: NotesDigest }) {
  const groups = byMember(digest.actionItems);

  const doubts = [...digest.openDoubts].sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
  );

  return (
    <div className="flex flex-col gap-8">
      <Card>
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{digest.sessionTitle}</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">{digest.summary}</p>
      </Card>

      {digest.keyPoints.length > 0 ? (
        <section>
          <SectionTitle>Key points</SectionTitle>
          <Card>
            <ul className="flex list-disc flex-col gap-2 pl-4 text-sm leading-relaxed">
              {digest.keyPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      {digest.decisions.length > 0 ? (
        <section>
          <SectionTitle>Decisions</SectionTitle>
          <Card>
            <ul className="flex flex-col gap-2 text-sm leading-relaxed">
              {digest.decisions.map((decision) => (
                <li key={decision} className="flex gap-2.5">
                  <span aria-hidden className="text-positive">
                    &#10003;
                  </span>
                  <span>{decision}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      <section>
        <SectionTitle hint={doubts.length === 0 ? undefined : `${doubts.length} unresolved`}>
          Open doubts
        </SectionTitle>
        {doubts.length === 0 ? (
          <Card>
            <p className="text-sm text-muted">
              Nothing was left hanging in these notes &mdash; the group resolved what it raised.
            </p>
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {doubts.map((doubt) => (
              <li
                key={doubt.question}
                className="rounded-2xl border border-line bg-surface p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <PriorityPill priority={doubt.priority} />
                  {namedOwner(doubt.suggestedOwner) ? (
                    <Pill tone="accent">Ask {namedOwner(doubt.suggestedOwner)}</Pill>
                  ) : null}
                </div>
                <p className="mt-2 text-sm font-medium leading-relaxed">{doubt.question}</p>
                <p className="mt-1 text-sm text-muted">{doubt.context}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionTitle
          hint={`${digest.actionItems.length} ${digest.actionItems.length === 1 ? "task" : "tasks"}`}
        >
          Action items
        </SectionTitle>
        {groups.length === 0 ? (
          <Card>
            <p className="text-sm text-muted">No actions came out of these notes.</p>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {groups.map(([member, items]) => (
              <Card key={member} className="flex flex-col">
                <div className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent"
                  >
                    {member === "Unassigned" ? "?" : member.slice(0, 1).toUpperCase()}
                  </span>
                  <h3 className="truncate font-medium tracking-tight">{member}</h3>
                  <span className="ml-auto shrink-0 text-xs text-faint">{items.length}</span>
                </div>

                <ul className="mt-4 flex flex-col gap-3">
                  {items
                    .slice()
                    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
                    .map((item, index) => (
                      <li key={index} className="flex gap-2.5">
                        <span
                          aria-hidden
                          className="mt-1 h-3.5 w-3.5 shrink-0 rounded border border-line"
                        />
                        <div className="min-w-0">
                          <p className="text-sm leading-relaxed">{item.task}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <PriorityPill priority={item.priority} />
                            {item.dueHint ? (
                              <span className="text-xs text-faint">{item.dueHint}</span>
                            ) : null}
                          </div>
                        </div>
                      </li>
                    ))}
                </ul>
              </Card>
            ))}
          </div>
        )}
      </section>

      {digest.nextAgenda.length > 0 ? (
        <section>
          <SectionTitle>Next session</SectionTitle>
          <Card>
            <ol className="flex list-decimal flex-col gap-2 pl-4 text-sm leading-relaxed">
              {digest.nextAgenda.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
