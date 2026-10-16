"use client";

import { useEffect, useRef, useState } from "react";

import { PlanView } from "@/components/PlanView";
import { ResultActions } from "@/components/ResultActions";
import { Button, Callout, Card, Field, Input, Select, Spinner, Textarea } from "@/components/ui";
import { apiFetch } from "@/lib/client";
import { planToMarkdown } from "@/lib/markdown";
import { LEVELS, type Level, type StudyPlan } from "@/lib/schemas";
import { addDays, countAvailableSessions, MAX_SESSIONS, todayISO } from "@/lib/schedule";

const STORAGE_KEY = "studysync:plan";

const SAMPLE = `CS3001 Operating Systems

1. Processes and threads: process control block, context switching, user vs kernel threads
2. CPU scheduling: FCFS, SJF, round robin, multilevel feedback queues
3. Synchronisation: race conditions, mutexes, semaphores, monitors, classic problems
4. Deadlock: Coffman conditions, prevention, avoidance (banker's algorithm), detection
5. Memory management: paging, segmentation, TLBs, page replacement algorithms
6. Virtual memory: demand paging, thrashing, working set model
7. File systems: inodes, directory structure, journalling, allocation strategies
8. I/O and storage: disk scheduling, RAID levels, SSD characteristics

Assessment: 3 hour written exam. Two questions on synchronisation and memory
management are compulsory. Past papers from the last five years are on the
module page.`;

type Status = "idle" | "loading";

export function PlannerWorkspace() {
  const [syllabus, setSyllabus] = useState("");
  const [startDate, setStartDate] = useState("");
  const [examDate, setExamDate] = useState("");
  const [hoursPerDay, setHoursPerDay] = useState(2);
  const [daysPerWeek, setDaysPerWeek] = useState(5);
  const [level, setLevel] = useState<Level>("intermediate");

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const resultRef = useRef<HTMLDivElement>(null);

  // Dates and any saved plan are read after mount so server and client
  // render the same markup on the first pass.
  useEffect(() => {
    const today = todayISO();
    setStartDate(today);
    setExamDate(addDays(today, 30));

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setPlan(JSON.parse(saved) as StudyPlan);
    } catch {
      // A corrupt or unreadable entry just means we start fresh.
    }
  }, []);

  // A plan can take a minute or two; a visible counter beats a dead spinner.
  useEffect(() => {
    if (status !== "loading") return;
    setElapsed(0);
    const timer = setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [status]);

  const sessions =
    startDate && examDate && examDate > startDate
      ? Math.min(countAvailableSessions(startDate, examDate, daysPerWeek), MAX_SESSIONS)
      : 0;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("loading");
    setError(null);

    try {
      const response = await apiFetch("/api/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ syllabus, startDate, examDate, hoursPerDay, daysPerWeek, level }),
      });

      const data = (await response.json()) as StudyPlan | { error: string };

      if (!response.ok) {
        throw new Error("error" in data ? data.error : `Request failed (${response.status}).`);
      }

      const result = data as StudyPlan;
      setPlan(result);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
      } catch {
        // Storage can be full or disabled; the plan is still on screen.
      }
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setStatus("idle");
    }
  }

  function reset() {
    setPlan(null);
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
            label="Your syllabus"
            htmlFor="syllabus"
            hint="Topic lists, a module outline, a photo transcription — rough is fine."
          >
            <Textarea
              id="syllabus"
              rows={10}
              required
              minLength={20}
              maxLength={20000}
              value={syllabus}
              onChange={(e) => setSyllabus(e.target.value)}
              placeholder="Paste the syllabus, topic list or module outline here…"
            />
          </Field>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-faint">
            <span>{syllabus.length.toLocaleString()} / 20,000 characters</span>
            <button
              type="button"
              onClick={() => setSyllabus(SAMPLE)}
              className="font-medium text-accent hover:underline"
            >
              Use a sample syllabus
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Start" htmlFor="startDate">
              <Input
                id="startDate"
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </Field>

            <Field label="Exam" htmlFor="examDate">
              <Input
                id="examDate"
                type="date"
                required
                value={examDate}
                min={startDate || undefined}
                onChange={(e) => setExamDate(e.target.value)}
              />
            </Field>

            <Field label="Hours per session" htmlFor="hoursPerDay">
              <Input
                id="hoursPerDay"
                type="number"
                required
                min={0.5}
                max={16}
                step={0.5}
                value={hoursPerDay}
                onChange={(e) => setHoursPerDay(Number(e.target.value))}
              />
            </Field>

            <Field label="Days per week" htmlFor="daysPerWeek">
              <Select
                id="daysPerWeek"
                value={daysPerWeek}
                onChange={(e) => setDaysPerWeek(Number(e.target.value))}
              >
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "day" : "days"}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Where you are with it" htmlFor="level">
              <Select
                id="level"
                value={level}
                onChange={(e) => setLevel(e.target.value as Level)}
              >
                {LEVELS.map((value) => (
                  <option key={value} value={value}>
                    {value[0]!.toUpperCase() + value.slice(1)}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="flex items-end">
              <p className="text-sm text-muted">
                {sessions > 0 ? (
                  <>
                    <span className="font-semibold text-ink">{sessions}</span> study sessions before
                    the exam
                  </>
                ) : (
                  "Pick an exam date after the start date."
                )}
              </p>
            </div>
          </div>

          {error ? <Callout>{error}</Callout> : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={loading || sessions === 0}>
              {loading ? <Spinner label={`Building your plan… ${elapsed}s`} /> : "Build my plan"}
            </Button>
            {loading ? (
              <span className="text-xs text-faint">
                A full plan usually takes 30&ndash;90 seconds.
              </span>
            ) : null}
          </div>
        </form>
      </Card>

      <div ref={resultRef}>
        {plan ? (
          <div className="flex flex-col gap-6">
            <ResultActions
              kind="plan"
              payload={plan}
              markdown={planToMarkdown(plan)}
              filename={`${plan.subject.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-study-plan.md`}
              onReset={reset}
            />
            <PlanView plan={plan} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
