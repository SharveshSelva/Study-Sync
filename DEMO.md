# StudySync — how it works, and how to demo it

Everything in one place: the full request flow for both features, every file and what it does, how to run it, and a timed demo script.

---

## 1. What the app does

Two features, both turning unstructured text into structured, actionable output.

| Feature | Input | Output |
| --- | --- | --- |
| **Planner** (`/planner`) | A syllabus, start and exam dates, hours per session, sessions per week, confidence level | Dated study sessions with specific tasks, milestones, spaced revision, risk areas, tips |
| **Group notes** (`/notes`) | Raw session notes, member names, optional title | Summary, key points, decisions, unresolved doubts, action items with one owner each, next agenda |

Both results can be copied as Markdown, downloaded as `.md`, or pushed to Notion through n8n.

---

## 2. The stack, and why

| Layer | Choice | Reason |
| --- | --- | --- |
| Framework | Next.js 16, App Router | Server routes and UI in one deployable unit |
| Language | TypeScript, strict | Schemas generate the types the UI renders |
| Styling | Tailwind CSS v4 | Tokens in `app/globals.css`, light + dark |
| LLM access | Vercel AI SDK 7 | Provider-agnostic; swapping is one env var |
| Model | Gemini (default), Groq, or local Ollama | Free tiers; real JSON-schema constrained decoding |
| Validation | Zod | One schema constrains the model *and* types the UI |
| Sharing | n8n → Notion | Re-pointable without redeploying the app |

---

## 3. Full request flow — Planner

```
Browser  /planner
  │  PlannerWorkspace.tsx — form state, live session-count preview
  │  computed client-side by lib/schedule.ts (no server round-trip)
  ▼  apiFetch POST /api/plan   (adds x-studysync-password if set)

app/api/plan/route.ts
  1. guard(request)                      lib/guard.ts
       • shared password, if APP_PASSWORD is set        → 401
       • per-IP rate limit, default 20/hour             → 429
       • runs BEFORE any model call, so blocks cost nothing
  2. PlanRequestSchema.safeParse(body)   lib/schemas.ts → 422 with a human message
  3. buildSchedule(start, exam, perWeek) lib/schedule.ts
       • picks weekdays from the days-per-week setting
       • excludes the exam day itself
       • caps at MAX_SESSIONS (60)
  4. generateStructured()                lib/generate.ts
       • Output.object({ schema: StudyPlanSchema }) constrains generation
       • system prompt + user message from lib/prompts.ts
       • model returns SESSION NUMBERS, never dates
       • on a transient 503 it retries once on a FALLBACK model
  6. finishReason checks                 → 422 on "length" / "content-filter"
  7. enrich()                            in the route
       • pairs sessions with real dates BY POSITION
       • sums task minutes per day
       • clamps milestone session numbers into range
  ▼  JSON

Browser
  PlanView.tsx     renders weeks → day cards → tasks, checkpoints, milestones
  localStorage     result cached under studysync:plan
  ResultActions    copy Markdown · download .md · Send to Notion
```

**The key design decision:** the model never produces a calendar date. LLMs get date arithmetic wrong, and a study plan off by a day is worse than useless. The model works purely in session numbers; `lib/schedule.ts` owns the calendar. Milestones reference a session number and get their date the same way.

---

## 4. Full request flow — Group notes

```
Browser  /notes
  │  NotesWorkspace.tsx — raw notes, comma-separated members (shown as chips)
  ▼  apiFetch POST /api/notes

app/api/notes/route.ts
  1. guard(request)                      same password + rate limit
  2. NotesRequestSchema.safeParse(body)
  3. getModel("notes")                   cheaper model than the planner by default
  4. generateText({ output: Output.object({ schema: NotesDigestSchema }) })
  5. finishReason checks
  ▼  JSON

Browser
  DigestView.tsx
    • doubts sorted high → low priority
    • action items GROUPED BY MEMBER, "Unassigned" sorted last
    • namedOwner() normalises the literal string "Unassigned" to null
```

The prompt's main job is keeping three things apart that get conflated constantly: what the group **learned** (key points), what it **settled** (decisions), and what it **could not resolve** (open doubts).

---

## 5. Full flow — Notion sync

```
Browser  "Send to Notion"
  ▼  POST /api/sync  { kind: "plan" | "digest", payload }

app/api/sync/route.ts
  GET  → { configured: boolean }   UI hides the button when no webhook is set
  POST → lib/n8n.ts forwardToN8n()
           • adds header x-studysync-secret
           • 30s timeout, mapped to a clear error
  ▼  POST https://<instance>.app.n8n.cloud/webhook/studysync
     body: { kind, sentAt, payload: { ...result, markdown } }

n8n — StudySync to Notion  (10 nodes)
  StudySync webhook         Header Auth credential "x-studysync-secret"
    │                       unauthenticated → 403 before the workflow runs
    ▼
  Plan or digest?           Switch on $json.body.kind
    │
    ├── plan ──────────────────────────────────────────────────┐
    │   Create plan page        Notion databasePage → Plans     │
    │   Markdown to Notion blocks   Code node                   │
    │       • reads $('StudySync webhook'), NOT $input          │
    │       • markdown → heading/to_do/quote/bullet blocks      │
    │       • emits ONE ITEM PER 100-BLOCK BATCH                │
    │   Append plan body        HTTP PATCH /v1/blocks/{id}/children
    │       • Batching: 1 item per batch (keeps batches ordered)│
    │                                                           │
    └── digest ────────────────────────────────────────────────┤
        Create session page    Notion databasePage → Notes      │
        One item per task      Code node, one item per action   │
        Create task row        Notion databasePage → Tasks      │
                                                                ▼
                                            Collapse to one → Respond OK
```

**Three constraints this design works around:**

1. **Notion caps appends at 100 children per request.** A real 20-session plan renders to 119 blocks, so it is split into batches.
2. **Batches must be serialised.** Sent concurrently, Notion received them out of order and the page started at Day 19. `Batching: 1 item` fixes it.
3. **A Code node's `$input` is the previous node's output.** Both Code nodes sit after Notion nodes, so they reference `$('StudySync webhook')` explicitly. Reading `$input` silently produced zero results.

### Notion destinations

All under a private **StudySync** page:

| Database | Properties |
| --- | --- |
| Plans | `Type` select, `Exam date` date, `Sessions` number, `Generated` created-time |
| Notes | `Type` select, `Summary` text, `Open doubts` number, `Generated` created-time |
| Tasks | `Owner` **text**, `Priority` select, `Status` select, `Session` text, `Due hint` text, `Added` created-time |

`Owner` is text, not select, because Notion returns `400` for a select value that is not already a registered option, and member names are not known in advance.

---

## 6. Every file

### `app/`
| File | Role |
| --- | --- |
| `layout.tsx` | Shell, nav, metadata, wraps content in `PasswordGate` |
| `globals.css` | Tailwind v4 import, colour tokens, light/dark, print styles |
| `page.tsx` | Landing page |
| `planner/page.tsx`, `notes/page.tsx` | Thin wrappers around the two workspaces |
| `api/plan/route.ts` | Syllabus → `StudyPlan`, plus date enrichment |
| `api/notes/route.ts` | Raw notes → `NotesDigest` |
| `api/sync/route.ts` | `GET` config probe, `POST` forward to n8n |
| `api/gate/route.ts` | `GET` whether a password is required, `POST` verify one |

### `components/`
| File | Role |
| --- | --- |
| `ui.tsx` | Button, Card, Field, Input, Select, Textarea, Pill, Spinner, Callout, Stat |
| `PasswordGate.tsx` | Shared-password prompt; renders children when open |
| `PlannerWorkspace.tsx` | Planner form, loading timer, localStorage, error display |
| `PlanView.tsx` | Plan rendering: weeks, day cards, milestones, tips |
| `NotesWorkspace.tsx` | Notes form, member chips, sample loader |
| `DigestView.tsx` | Digest rendering, action items grouped by owner |
| `ResultActions.tsx` | Copy / download / sync / reset |
| `SyncButton.tsx` | Notion push; hides itself when no webhook configured |

### `lib/`
| File | Role |
| --- | --- |
| `schemas.ts` | **Single source of truth** — Zod schemas + inferred types + `namedOwner()` |
| `prompts.ts` | System prompts and user-message builders |
| `model.ts` | Provider/model resolution from env; per-task defaults |
| `schedule.ts` | Weekday patterns, date maths, formatting, `MAX_SESSIONS` |
| `generate.ts` | Structured generation + automatic fallback on a busy model |
| `markdown.ts` | Plan/digest → Markdown for copy, download and Notion |
| `n8n.ts` | Webhook forwarding, secret header, timeout handling |
| `errors.ts` | `AppError` + maps AI SDK errors to useful HTTP responses |
| `guard.ts` | Shared password + per-IP rate limiting |
| `client.ts` | `apiFetch` — attaches the password header client-side |

---

## 7. Running it

```bash
npm install
cp .env.example .env.local      # add your Gemini key
npm run dev                     # http://localhost:3000
```

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |

### Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `GOOGLE_GENERATIVE_AI_API_KEY` | yes (default provider) | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| `LLM_PROVIDER` | no | `google` (default), `groq`, `ollama` |
| `LLM_PLAN_MODEL` / `LLM_NOTES_MODEL` | no | Override per-task defaults |
| `LLM_PLAN_FALLBACK_MODEL` / `LLM_NOTES_FALLBACK_MODEL` | no | Used when the primary returns a transient 503 |
| `GROQ_API_KEY` | only for Groq | |
| `OLLAMA_BASE_URL` | only for Ollama | defaults to `http://127.0.0.1:11434/api` |
| `N8N_WEBHOOK_URL` | no | Unset hides the Send to Notion button |
| `N8N_WEBHOOK_SECRET` | with the above | Must match the n8n Header Auth credential |
| `APP_PASSWORD` | no | Set it and the whole app is password gated |
| `RATE_LIMIT_PER_HOUR` | no | Per-IP cap, default 20, `0` disables |

---

## 8. Demo script

**Setup, before they join:** app open on `/planner`, the Notion **StudySync** page open in a second tab, `.env.local` configured, one generation already done recently so you know the quota is live.

### Open with the problem — 15s

> "Two things kill group revision: nobody breaks the syllabus down, and nobody reads the notes back. This does both."

Do **not** start with the stack.

### Notes first — ~30s

Faster than the planner and the output looks smarter. Click **Use sample notes** → **Turn into tasks**.

When it lands, point at **Open doubts**:

> "That's the interesting part. It separated questions nobody answered from things the group decided — those get conflated constantly. And every action item has an owner, pulled from who volunteered in the notes."

Then scroll to the per-member task cards.

### Planner — start it, then talk — ~50s

Click **Use a sample syllabus** → **Build my plan**, and immediately start talking. Do not watch the spinner.

> "While that runs — the model never produces dates. It works in session numbers and the server maps them onto a calendar. LLMs get date arithmetic wrong, and a plan that's off by a day is useless."

When it lands, show: day cards with time budgets, a **revise** task referencing an earlier session (spaced repetition), and the last sessions being mock papers rather than new material.

### Notion — ~20s

Click **Send to Notion**, switch tabs, refresh.

> "The app doesn't talk to Notion — it posts to n8n, which does. The group can re-point that workflow without redeploying."

### If they dig deeper

- **Structured output:** "The Zod schemas are the single source of truth — the same objects constrain the model and generate the TypeScript the UI renders. Gemini does real schema-constrained decoding, so it's a guarantee, not a polite request."
- **Provider-agnostic:** "Gemini, Groq, or a local Ollama model. One env var. It started on a different provider entirely and the schemas and prompts didn't change."
- **A real bug — use this one:** "Notion caps block appends at 100; a real plan is 119. I batch it, and had to serialise the batches because they arrived out of order and the page started at Day 19. Found that by reading the page back, not by trusting the 200."

That last point lands harder than any feature. It shows you verify outcomes rather than status codes.

### Questions you should expect

| Question | Answer |
| --- | --- |
| "What stops someone spamming this?" | Shared password plus per-IP rate limiting, both before any model call. Honest caveat: the limiter is in-memory, so per-instance, not a distributed guarantee. |
| "What does it cost?" | Pennies. ~$0.03 a plan, ~$0.01 a digest, and the free tier covers normal use. |
| "What would you do next?" | Accounts and shared group state, Postgres instead of localStorage, distributed rate limiting, and an eval set for plan quality. |
| "How do you know the plans are good?" | Time budgets are checked against the requested session length; dates and ordering are asserted. Quality itself is still judged by eye — an eval set is the honest next step. |

---

## 9. Known limits

- **~49s** for a 20-session plan. Vercel Hobby caps functions at 60s, so a long syllabus can time out. Mitigation: `LLM_PLAN_MODEL=gemini-3.5-flash-lite`.
- **Gemini free tier is rate-limited per minute.** Don't demo twice back to back.
- **n8n Cloud trial.** The Notion sync stops when it expires unless you pay or self-host.
- **No accounts.** Results live in each browser's `localStorage`; Notion is the only shared copy.
- **Rate limiter is per-instance.** See above.
- **Plans cap at 60 sessions.** Longer ranges generate the first 60 and say so.
