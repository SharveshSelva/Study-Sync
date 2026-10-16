# StudySync

An AI study planner. It does two things:

1. **Syllabus to a day-by-day plan.** Paste a syllabus, say how long you have and how much time you can give each session. You get dated sessions with specific tasks, spaced revision of earlier topics, and the run-up to the exam reserved for practice papers rather than new material.
2. **Group notes to clear tasks.** Paste whatever your study group typed during a session. You get a summary, the questions nobody answered, and an action list where every item has an owner — then push the whole thing to Notion through n8n.

Built with Next.js (App Router), TypeScript, Tailwind CSS and the Vercel AI SDK. Runs on **Google Gemini, Groq or a local Ollama model** — your choice, set by one environment variable.

---

## Running it locally

```bash
npm install
cp .env.example .env.local
```

By default the app uses **Google Gemini**, which has a free tier. Get a key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey), put it in `.env.local` as `GOOGLE_GENERATIVE_AI_API_KEY`, then:

```bash
npm run dev
```

The app runs at http://localhost:3000. Both pages have a "use sample" button so you can see the output shape without pasting anything real.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with Turbopack |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |

---

## Choosing a model

Set `LLM_PROVIDER` to `google`, `groq` or `ollama`. Each provider has sensible per-task defaults, and planning gets the stronger model because it is the harder job — turning a vague syllabus into well-sequenced, specific work is real reasoning, whereas the notes digest is mostly extraction and attribution.

| Provider | Key needed | Default plan model | Default notes model |
| --- | --- | --- | --- |
| `google` *(default)* | [`GOOGLE_GENERATIVE_AI_API_KEY`](https://aistudio.google.com/apikey) | `gemini-3.6-flash` | `gemini-3.5-flash-lite` |
| `groq` | [`GROQ_API_KEY`](https://console.groq.com/keys) | `llama-3.3-70b-versatile` | `llama-3.1-8b-instant` |
| `ollama` | none — needs `ollama serve` running | `llama3.1:8b` | `llama3.1:8b` |

**Automatic fallback.** Gemini returns `503 — this model is currently experiencing high demand` on individual models fairly regularly, and it is per-model: `gemini-3.8-flash` was down while `gemini-3.6-flash` was fine. If the primary fails transiently, the app retries once on a fallback model (`LLM_PLAN_FALLBACK_MODEL` / `LLM_NOTES_FALLBACK_MODEL`) before reporting an error. If both are busy you get an explicit "upstream capacity" message rather than a generic failure.

Override either model without touching code:

```bash
LLM_PLAN_MODEL=gemini-3.6-flash
LLM_NOTES_MODEL=gemini-3.8-flash   # sharper digests, costs a little more
```

> **Gotcha:** Google's `/models` endpoint still lists the Gemini **2.5** family, but those models are closed to newly created API keys — calling one returns a 404 saying to use the 3.x equivalent. If you see "model not found", that is almost certainly why. The defaults above are all on the 3.x line.

### Running fully offline with Ollama

```bash
ollama serve
ollama pull llama3.1:8b
```

Then set `LLM_PROVIDER=ollama`. No key, no per-run cost. Be realistic about quality: an 8B model produces noticeably blander plans than a hosted model, and it is the most likely of the three to return something that fails schema validation. The app surfaces that as a clear error rather than a crash, and suggests switching model.

### What it costs

Published rates per 1M tokens, and a rough estimate for one 30-session plan (the expensive operation; a notes digest is several times cheaper):

| Model | Input · Output | One plan |
| --- | --- | --- |
| `gemini-3.5-flash-lite` | $0.30 · $2.50 | ~$0.02 |
| `gemini-3.8-flash` *(plan default)* | $0.75 · $3.75 | ~$0.03 |
| Groq free tier | — | $0 |
| Ollama | — | $0 |

Gemini Flash models and Groq both have free tiers that comfortably cover normal student use. Free-tier request limits are per minute and per day, so the failure mode is a 429, which the app reports as "wait a moment and try again" rather than a generic error.

Model names and prices change. Check [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing) and [Groq's model list](https://console.groq.com/docs/models) before assuming the defaults above are current — if a model is retired you will get a clear "model not found" error telling you to set `LLM_PLAN_MODEL`.

---

## How it works

### Structured output, not parsed prose

Both features ask the model for JSON matching a Zod schema, using the AI SDK's `Output.object`:

```ts
const { output, finishReason } = await generateText({
  model,
  system: PLANNER_SYSTEM,
  prompt: plannerUserMessage(input, schedule.length),
  output: Output.object({ schema: StudyPlanSchema }),
});
// output is typed as z.infer<typeof StudyPlanSchema>, already validated
```

The schemas in [`lib/schemas.ts`](lib/schemas.ts) are the single source of truth — the same objects constrain the model's output and generate the TypeScript types the UI renders. Gemini and Groq both support real JSON-schema constrained decoding, so this is a hard guarantee rather than a polite request.

Because the schemas and prompts are provider-independent, swapping provider touches exactly one file: [`lib/model.ts`](lib/model.ts).

### The model never touches dates

LLMs are unreliable at date arithmetic, so the planner prompt works purely in session numbers (`Day 1`, `Day 2`, …). [`lib/schedule.ts`](lib/schedule.ts) builds the real calendar — picking weekdays from the "days per week" setting, skipping the exam day itself — and the API route pairs sessions with dates by position. Milestones reference a session number and get their date the same way.

Plans are capped at 60 sessions (`MAX_SESSIONS`). Longer ranges generate the first 60 and say so in the UI.

### Where things live

```
app/
  api/plan/route.ts     syllabus  -> StudyPlan   (+ dates attached server-side)
  api/notes/route.ts    raw notes -> NotesDigest
  api/sync/route.ts     forwards a result to the n8n webhook
  planner/, notes/      the two feature pages
components/             forms, result views, shared UI primitives
lib/
  model.ts              provider + model selection from env
  schemas.ts            Zod schemas + inferred types
  prompts.ts            system prompts and user-message builders
  schedule.ts           calendar maths, date formatting
  markdown.ts           plan/digest -> Markdown for copy, download and Notion
  n8n.ts                webhook forwarding
  errors.ts             maps thrown errors to useful HTTP responses
n8n/                    importable workflow
```

---

## Notion sync through n8n

The app does not talk to Notion directly. It POSTs the finished result to an n8n webhook, and n8n writes to Notion. That way the group can re-point the workflow — a different database, an extra Slack message, whatever — without redeploying the app.

Set `N8N_WEBHOOK_URL` and the **Send to Notion** button appears. Leave it blank and the button stays hidden, so a local setup without n8n never shows a control that can only fail.

### The Notion side is already built

Three databases live under a private **StudySync** page in your workspace, with the IDs already baked into the workflow JSON:

| Database | ID | Properties |
| --- | --- | --- |
| [Plans](https://app.notion.com/p/46c5777eb1344d3f94780f7aa329398f) | `46c5777eb1344d3f94780f7aa329398f` | `Type` select, `Exam date` date, `Sessions` number, `Generated` created-time |
| [Notes](https://app.notion.com/p/a86336f60d1e4b32b33d7644f8252571) | `a86336f60d1e4b32b33d7644f8252571` | `Type` select, `Summary` text, `Open doubts` number, `Generated` created-time |
| [Tasks](https://app.notion.com/p/e1dc9ebb0ff74b72896285bf3889dd65) | `e1dc9ebb0ff74b72896285bf3889dd65` | `Owner` text, `Priority` select, `Status` select, `Session` text, `Due hint` text, `Added` created-time |

Each holds a verified test row; delete them whenever you like.

> **Why `Owner` is text and not a select.** Notion returns `400 validation_error` for a select value that is not already a registered option — it does *not* create options on the fly. Group member names are not known in advance, so a select would break the first time a new name appeared. `Priority` and `Status` stay selects because their values are fixed.

### Setting up n8n

1. Create an [n8n Cloud](https://n8n.io) account (the free trial is enough) — or self-host, but then the webhook is only reachable locally unless you run `n8n start --tunnel`, so a deployed app could not reach it.
2. **Workflows → Import from File** → choose [`n8n/studysync-notion-workflow.json`](n8n/studysync-notion-workflow.json).
3. Create a **Notion API** credential from an [internal integration token](https://www.notion.so/my-integrations), then select it on the three Notion nodes and the **Append plan body** HTTP node. (`REPLACE_WITH_CREDENTIAL_ID` in the JSON is a placeholder; picking the credential in the UI overwrites it.)
4. In Notion, open the **StudySync** page → `...` → **Connections** → add your integration. Permissions inherit to all three databases. **Skip this and every write returns 404** even though the credential is valid — it is the most commonly missed step.
5. Open the **StudySync webhook** node. **Authentication** is set to **Header Auth**; create its credential with **Name** `x-studysync-secret` and any long random string as the **Value**. The name must match exactly — that is the header the app sends.
6. **Publish** the workflow (older n8n versions call this the **Active** toggle), then copy the **Production** webhook URL from the webhook node.
7. In `.env.local`, set `N8N_WEBHOOK_URL` to that URL and `N8N_WEBHOOK_SECRET` to the same secret from step 5. The **Send to Notion** button appears as soon as the URL is set.

> **Why auth lives on the webhook node.** An earlier version used an IF node comparing `$env.STUDYSYNC_SECRET`. n8n Cloud denies `$env` access on lower plans, so that node threw `access to env vars denied` and every request failed. Header Auth is also simply better: the secret sits in an encrypted credential rather than an environment variable, and unauthorized requests are rejected before the workflow starts. An unauthenticated request now gets `403 Authorization data is wrong!`.

The request body is:

```json
{
  "kind": "plan",
  "sentAt": "2026-10-16T09:00:00.000Z",
  "payload": { "...the full result object...", "markdown": "# rendered markdown" }
}
```

A digest fans out: one Notion page for the session, plus one row per action item in the Tasks database, so everyone sees what they owe in one view.

---

## Protecting a public deployment

Both LLM routes cost money to run, so a public URL is an open invitation to spend your quota. Two opt-in controls ship with the app, neither needing an external service:

| Variable | Effect |
| --- | --- |
| `APP_PASSWORD` | Whole app sits behind a shared password. The API routes verify it themselves, so skipping the UI does not bypass it. |
| `RATE_LIMIT_PER_HOUR` | Generations allowed per IP per hour (default 20, `0` disables). |

> **What the rate limiter is and is not.** It keeps timestamps in process memory, which on Vercel means per warm instance, lost on recycle. That stops casual repeated spam from one client; it is not a hard distributed guarantee. For that you need shared state (Vercel KV, Upstash) or Vercel's firewall.

**The control that actually caps your downside is on Google's side.** The Gemini free tier has no card attached, so exhausting it means requests start failing — not a bill. Only if you enable billing does spend become possible, and then you should set a hard cap in the Google Cloud console. Check this before deploying; it matters more than anything in the app.

Vercel's own **Deployment Protection** (Settings → Deployment Protection) is the strongest option if you only need to show the demo to specific people, though full production protection needs a paid plan.

## Deploying to Vercel

1. Push the repository to GitHub.
2. Import it in Vercel — the framework is detected automatically, no build settings to change.
3. Add your provider key (`GOOGLE_GENERATIVE_AI_API_KEY` or `GROQ_API_KEY`) under **Settings → Environment Variables**, plus `LLM_PROVIDER` if you are not using the default, and `N8N_WEBHOOK_URL` / `N8N_WEBHOOK_SECRET` for the Notion sync.
4. Deploy.

`LLM_PROVIDER=ollama` cannot work on Vercel — a local Ollama server is not reachable from Vercel's infrastructure. Use it for local development only.

The plan and notes routes set `maxDuration = 300`. **On Vercel's Hobby plan functions are capped at 60 seconds.** Gemini Flash is fast enough that this is rarely a problem, but a 60-session plan on a slow provider can hit it — shorten the date range or use a faster model if you do.

---

## Limits worth knowing

- Nothing is stored server-side. Results are kept in `localStorage` so a refresh does not lose them, which also means they are per-browser and not shared between group members. Notion is the shared copy.
- Inputs are capped at 20,000 characters.
- These plans and digests are model-generated. They are good and still occasionally wrong — check anything that matters.
