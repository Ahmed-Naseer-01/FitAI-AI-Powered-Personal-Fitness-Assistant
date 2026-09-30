# FitAI — AI-Powered Personal Fitness Assistant

An academic final-year project: a web application combining a fitness profile
with deterministic health metrics, AI-generated diet and workout plans, a
calorie tracker, a progress dashboard, and real-time exercise form analysis
through the webcam.

## Governing principle

> **AI selects and explains. Deterministic code calculates.**

The language model never produces a number the system depends on. It returns
database IDs and quantities; application code performs all arithmetic against
structured nutrition and exercise data. Every AI response is schema-validated,
and every AI feature has a deterministic fallback — **the application generates
diet and workout plans with no API key at all.**

A worked example of why this matters: a vegetarian user's food menu is filtered
by SQL *before* the prompt is built, dropping 60 foods to 31. The model cannot
recommend chicken because chicken was never in its input. That is a structural
guarantee, not a matter of the prompt being obeyed.

## Features

| Module | Description |
|---|---|
| Profile & assessment | BMI, BMR (Mifflin–St Jeor), TDEE, calorie and protein targets |
| AI diet planner | Meals chosen from a 60-item Pakistani/South Asian food database |
| Calorie tracker | Search, log, edit; optional natural-language entry |
| AI workout planner | Weekly schedule validated for duration and recovery |
| Form analysis | In-browser pose detection for squat and bicep curl |
| Progress dashboard | Weight, calories, workouts and form score over 7 or 30 days |

## Technology

Next.js 16 (App Router, TypeScript) · Prisma 6 + SQLite · Tailwind CSS v4 ·
Zod · Recharts · MediaPipe Tasks JS · Google Gemini API · Vitest

### Resilience and the free-tier quota

**The free Gemini tier allows 20 requests per day, per model.** Plan for that
before a demo: generating a diet plan and a workout plan costs one request
each when the service is healthy, and regenerating a single meal costs another.

The client is built around that constraint and around the fact that free-tier
models are often overloaded:

- **A chain of three models.** The quota is per model, so when one is
  exhausted (429) or retired (404) the client moves straight to the next
  rather than retrying a request that cannot succeed.
- **Hard timeouts.** 10 seconds per request, 15 seconds for the whole
  exchange. An overloaded model once held a connection open for 47 seconds to
  return six tokens; without a ceiling, a single plan took 86 seconds.
- **Retries only where they help.** 5xx is retried once with backoff; 429,
  404, 400 and 403 are not.
- **A deterministic fallback behind everything.** When no model answers, the
  built-in planners produce the plan and the page says so.

Set `GEMINI_MODEL` in `.env` to pin a single model if you would rather not use
the chain.

**Privacy:** webcam frames are processed entirely in the browser and never
leave the device. Only aggregate rep counts and form scores are transmitted.

## Quick start

```bash
npm install
cp .env.example .env                        # then set SESSION_SECRET
openssl rand -base64 32                     # paste this into SESSION_SECRET
npm run setup:model                         # MediaPipe pose model (~5.5 MB)
npm run db:push && npm run db:seed
npm run dev
```

Open http://localhost:3000.

**[→ Full setup guide](SETUP.md)** — system requirements, every step, and
troubleshooting.

### Optional: enable the AI features

Get a free API key from [Google AI Studio](https://aistudio.google.com/apikey)
and add it to `.env`:

```
GEMINI_API_KEY=your-key-here
GEMINI_MODEL=              # optional, overrides the default model
```

Without a key the application still works: diet and workout plans come from
the deterministic fallback generators. Only natural-language food entry
requires a key.

### Demo account

```bash
npm run db:demo
```

Creates `demo@fitai.test` / `demo1234` with two weeks of history, including
three deliberately unlogged days so the charts demonstrate gaps rather than
zeros.

## Testing

```bash
npm test
```

Unit tests cover all health and nutrition arithmetic, the AI validators and
fallback generators, and the pose geometry and rep-counting state machine.

`src/app/api/__tests__/routes.test.ts` runs the real route handlers against a
throwaway SQLite database created and destroyed per run, so the food log,
profile, form-session and workout-completion endpoints are covered including
their authorisation boundaries — a user cannot read, edit or delete another
user's rows.

`src/lib/pose/pipeline.test.ts` simulates the whole camera pipeline —
visibility gate, joint angles, smoothing, rep counting, form rules — against
synthetic landmarks, so **rep counting and form classification are verified
without a camera**, including the case where the user walks out of frame
mid-set.

## How the form analysis works

```
webcam → MediaPipe PoseLandmarker → 33 landmarks
  → visibility gate → joint angles → EMA smoothing (α = 0.3)
  → rep state machine (hysteresis) → form rules → live feedback
```

A repetition is counted only on a bottom→top transition, and the gap between
the two thresholds prevents a hovering angle from producing phantom reps.

| Exercise | Rep signal | Count thresholds | Form checks |
|---|---|---|---|
| Squat | Hip–knee–ankle angle | below 120°, then above 160° | depth (>100°), torso lean (>45°), knee valgus |
| Bicep curl | Shoulder–elbow–wrist angle | below 80°, then above 140° | range (>60°), extension (<150°), elbow drift (>20°) |

Note that the *counting* thresholds are deliberately more generous than the
*form* thresholds. An earlier design used the same number for both, which made
three of the six form rules unreachable — a rep could not simultaneously be
counted and be judged too shallow. A regression test now asserts every rule
threshold falls inside the counted range.

## Limitations

These are real and worth stating plainly:

- **2D pose estimation.** Thresholds are heuristics tuned against synthetic and
  recorded movement, not clinical measurements.
- **Smoothing lag.** The EMA damps movements completed in well under half a
  second, so an unrealistically fast repetition is missed. Real repetitions
  take one to three seconds.
- **BMI** is a screening metric only, not a medical diagnosis. The application
  states this wherever BMI appears.
- **Nutrition values** are per standard household serving from a published
  composition table; real portions vary.
- **Infeasible protein targets.** On a budget-restricted menu with an
  aggressive protein target and a calorie deficit, no plan can reach the
  target: cheap foods are carbohydrate-dense, and 115 g of protein inside
  1800 kcal needs about 0.064 g per kcal, which only eggs and pulses
  approach. Rather than silently under-delivering, the planner detects this
  and explains it — "a 114 g protein target is not achievable within 1529
  kcal from the foods available to you" — and suggests raising the calorie
  target or widening food preferences.
- **Natural-language quantities** are approximate, which is why the result is
  presented as an editable draft rather than saved automatically.

## Project structure

```
prisma/          schema, seed data (60 foods, 15 exercises), demo data
src/lib/         pure logic: metrics, nutrition, profile, stats, week
src/lib/ai/      client adapter, diet planner, workout planner, text parsing
src/lib/pose/    geometry, smoothing, rep machine, exercise configs
src/app/         pages and API routes
src/components/  shared UI
```

## Documentation

| Document | Contents |
|---|---|
| **[Setup guide](SETUP.md)** | Requirements, installation, commands, troubleshooting |
| **[Technical documentation](docs/DOCUMENTATION.md)** | Architecture, data model, algorithms, API reference, testing |
| **[Project proposal](docs/PROPOSAL.md)** | Problem statement, objectives, scope, methodology, evaluation |
| **[Deployment guide](docs/DEPLOYMENT.md)** | Vercel + Neon, Railway, and local options |
| [Design specification](docs/superpowers/specs/2026-09-29-fitai-design.md) | The original design decisions |
| [Implementation plan](docs/superpowers/plans/2026-09-29-fitai.md) | Task-by-task build plan |

## Deployment

The application deploys to Vercel with a managed Postgres database, or to
Railway with SQLite on a persistent disk. The Prisma provider is derived from
`DATABASE_URL` automatically, so there is only one schema file to maintain.

**[→ Deployment guide](docs/DEPLOYMENT.md)**
