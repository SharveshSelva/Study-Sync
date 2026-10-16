"use client";

import { useEffect, useRef, useState } from "react";

import { DigestView } from "@/components/DigestView";
import { ResultActions } from "@/components/ResultActions";
import { Button, Callout, Card, Field, Input, Spinner, Textarea } from "@/components/ui";
import { apiFetch } from "@/lib/client";
import { digestToMarkdown } from "@/lib/markdown";
import type { NotesDigest } from "@/lib/schemas";

const STORAGE_KEY = "studysync:digest";

const SAMPLE = `ok so we started with deadlock

priya: the 4 coffman conditions are mutual exclusion, hold and wait, no preemption, circular wait
arun - wait is circular wait the same as a cycle in the resource graph?
priya: yes for single instance resources. multi instance a cycle doesn't always mean deadlock
arun: ok that's the bit i keep getting wrong

banker's algorithm - we went through the example from lecture 9
maya walked us through the safety check. need = max - allocation
nobody could remember if we need to run safety check before OR after pretending to grant. priya thinks after. not sure
TODO someone check this in the textbook

then memory
LRU vs FIFO - belady's anomaly only happens in FIFO
maya: does LRU ever have belady? i said no but can't explain why
left this one

clock algorithm we skipped, ran out of time

decided: meeting again thursday 6pm same room
decided: everyone does past paper 2019 q3 before thursday, we compare answers
arun said he'd type up the deadlock notes properly and share
maya is doing a one pager on page replacement algos

also exam is 2 weeks from friday so we should do a full past paper under timed conditions at some point`;

type Status = "idle" | "loading";

export function NotesWorkspace() {
  const [rawNotes, setRawNotes] = useState("");
  const [sessionTitle, setSessionTitle] = useState("");
  const [memberInput, setMemberInput] = useState("");

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [digest, setDigest] = useState<NotesDigest | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setDigest(JSON.parse(saved) as NotesDigest);
    } catch {
      // A corrupt or unreadable entry just means we start fresh.
    }
  }, []);

  useEffect(() => {
    if (status !== "loading") return;
    setElapsed(0);
    const timer = setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [status]);

  const members = memberInput
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .slice(0, 20);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("loading");
    setError(null);

    try {
      const response = await apiFetch("/api/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rawNotes, members, sessionTitle }),
      });

      const data = (await response.json()) as NotesDigest | { error: string };

      if (!response.ok) {
        throw new Error("error" in data ? data.error : `Request failed (${response.status}).`);
      }

      const result = data as NotesDigest;
      setDigest(result);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
      } catch {
        // Storage can be full or disabled; the digest is still on screen.
      }
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setStatus("idle");
    }
  }

  function reset() {
    setDigest(null);
    setError(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing to clean up if storage is unavailable.
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const loading = status === "loading";

  return (
    <div className="flex flex-col gap-10">
      <Card className="no-print">
        <form onSubmit={submit} className="flex flex-col gap-5">
          <Field
            label="Raw session notes"
            htmlFor="rawNotes"
            hint="Straight from the shared doc or chat. Typos, half-sentences and crosstalk are expected."
          >
            <Textarea
              id="rawNotes"
              rows={12}
              required
              minLength={20}
              maxLength={20000}
              value={rawNotes}
              onChange={(e) => setRawNotes(e.target.value)}
              placeholder="Paste whatever the group typed during the session…"
            />
          </Field>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-faint">
            <span>{rawNotes.length.toLocaleString()} / 20,000 characters</span>
            <button
              type="button"
              onClick={() => {
                setRawNotes(SAMPLE);
                setMemberInput("Priya, Arun, Maya");
                setSessionTitle("Deadlock and memory management");
              }}
              className="font-medium text-accent hover:underline"
            >
              Use sample notes
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Group members"
              htmlFor="members"
              hint="Comma separated. Used to assign every action item an owner."
            >
              <Input
                id="members"
                value={memberInput}
                onChange={(e) => setMemberInput(e.target.value)}
                placeholder="Priya, Arun, Maya"
              />
            </Field>

            <Field label="Session title" htmlFor="sessionTitle" hint="Optional — one is written for you.">
              <Input
                id="sessionTitle"
                maxLength={120}
                value={sessionTitle}
                onChange={(e) => setSessionTitle(e.target.value)}
                placeholder="Week 7 revision"
              />
            </Field>
          </div>

          {members.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {members.map((name) => (
                <span
                  key={name}
                  className="rounded-full border border-line bg-raised px-2.5 py-0.5 text-xs text-muted"
                >
                  {name}
                </span>
              ))}
            </div>
          ) : null}

          {error ? <Callout>{error}</Callout> : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={loading}>
              {loading ? <Spinner label={`Reading the notes… ${elapsed}s`} /> : "Turn into tasks"}
            </Button>
            {loading ? (
              <span className="text-xs text-faint">Usually 15&ndash;40 seconds.</span>
            ) : null}
          </div>
        </form>
      </Card>

      <div ref={resultRef}>
        {digest ? (
          <div className="flex flex-col gap-6">
            <ResultActions
              kind="digest"
              payload={digest}
              markdown={digestToMarkdown(digest)}
              filename={`${digest.sessionTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-notes.md`}
              onReset={reset}
            />
            <DigestView digest={digest} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
