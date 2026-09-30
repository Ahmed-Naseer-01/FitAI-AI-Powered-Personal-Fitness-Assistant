# FitAI — Technical Documentation

Complete reference for the system: architecture, data model, modules, API,
algorithms, testing and limitations.

**Contents**
1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Data model](#3-data-model)
4. [Health metrics](#4-health-metrics)
5. [The AI layer](#5-the-ai-layer)
6. [Pose analysis](#6-pose-analysis)
7. [API reference](#7-api-reference)
8. [Design system](#8-design-system)
9. [Testing](#9-testing)
10. [Security and privacy](#10-security-and-privacy)
11. [Limitations](#11-limitations)

---

## 1. Overview

FitAI is a Next.js application with six modules: profile and assessment, AI
diet planning, calorie tracking, AI workout planning, webcam form analysis,
and a progress dashboard.

**Codebase:** 91 TypeScript files, roughly 6,200 lines of source and 2,700
lines of tests.

### The governing principle

> **AI selects and explains. Deterministic code calculates.**

The language model never produces a number the system depends on. It returns
database identifiers and quantities; application code performs all arithmetic
against structured data. Three consequences follow:

- Output is **reproducible** — the same inputs give the same numbers
- Failure modes are **bounded** — a bad AI response is rejected, not displayed
- The application is **independent** of the provider — with no API key it still
  generates plans

---

## 2. Architecture

```
┌───────────────────────────── Browser ──────────────────────────────┐
│  React pages (Next.js App Router)                                   │
│                                                                      │
│  /train ──▶ MediaPipe PoseLandmarker (WASM, local)                  │
│             webcam → 33 landmarks → joint angles →                  │
│             smoothing → rep state machine → form rules              │
│             Video never leaves the device.                          │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ fetch
┌──────────────────────────────▼──────────────────────────────────────┐
│  API routes (Node)                                                   │
│    auth         sessions, bcrypt                                     │
│    profile      upsert + weight history                              │
│    foods        search, similar                                      │
│    log          create, update, delete                               │
│    diet         generate, regenerate one meal, swap                  │
│    workout      generate, complete                                   │
│    parse        natural language → food ids                          │
│    form-session persist a camera session                             │
│                                                                      │
│    ↑ metrics and nutrition are pure, tested functions                │
│    ↑ every AI response passes a Zod validator                        │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ Prisma
┌──────────────────────────────▼──────────────────────────────────────┐
│  SQLite — 12 tables                                                  │
└──────────────────────────────────────────────────────────────────────┘
```

### Directory structure

```
prisma/
  schema.prisma          12 models
  seed.ts                loads reference data
  demo.ts                creates a demo account with history
  data/foods.ts          60 Pakistani and South Asian foods
  data/exercises.ts      15 exercises

src/lib/
  db.ts                  Prisma client singleton
  types.ts               shared union types and Zod enums
  tags.ts                comma-separated list helpers
  metrics.ts             BMI / BMR / TDEE / targets      (pure)
  nutrition.ts           macro scaling and summing        (pure)
  foodLog.ts             day ranges and daily summaries
  profile.ts             profile validation and persistence
  stats.ts               dashboard aggregation
  week.ts                ISO week helper                  (pure)
  session.ts             JWT cookie read/write
  auth.ts                password hashing, credential schema

src/lib/ai/
  client.ts              the ONLY network call to a model
  diet.ts                menu, prompt, validator, fallback
  workout.ts             menu, prompt, validator, fallback
  parse.ts               natural-language food parsing

src/lib/pose/
  angles.ts              geometry                         (pure)
  smoother.ts            exponential moving average       (pure)
  repMachine.ts          repetition state machine         (pure)
  exercises.ts           per-exercise configuration       (pure)

src/app/                 pages and API routes
src/components/          feature components
src/components/ui/       design-system primitives
```

### Three structural rules

1. **All health mathematics is a pure function.** Deterministic, unit-tested,
   never AI-derived.
2. **AI endpoints return only identifiers and quantities**, validated by Zod,
   with one corrective retry then a deterministic fallback.
3. **One write path per concept.** The diet planner, the natural-language
   parser and manual search all produce `FoodLog` rows through the same
   endpoint. The camera and the workout checklist both produce
   `WorkoutSession` rows.

---

## 3. Data model

Twelve tables.

```
User             id, email, passwordHash, createdAt

Profile          userId (1:1), name, age, gender, heightCm, weightKg,
                 activityLevel, experience, goal, workoutDays,
                 sessionMinutes, dietaryPreference, allergies, budget
                 └─ bmi, bmr, tdee, calorieTarget derived on read

WeightEntry      userId, weightKg, bmi, recordedAt          (append-only)

Food             id, name, nameUrdu, category, servingLabel, servingGrams,
                 kcal, proteinG, carbsG, fatG, isVeg, tags       (60 rows)

FoodLog          userId, foodId, servings, mealSlot, consumedAt

MealPlan         userId, date, generatedAt, source, aiNotes
MealPlanItem     mealPlanId, foodId, servings, mealSlot, reason

Exercise         id, name, muscleGroup, equipment, difficulty, metValue,
                 hasFormTracking, formKey, defaultSets, defaultReps,
                 repUnit                                          (15 rows)

WorkoutPlan      userId, weekStart, generatedAt, source, aiNotes
WorkoutPlanItem  workoutPlanId, exerciseId, dayOfWeek, sets, reps,
                 restSec, focus, reason

WorkoutSession   userId, workoutPlanItemId?, exerciseId, completedAt,
                 durationSec, totalReps, estimatedKcal

FormSession      userId, exerciseId, startedAt, durationSec, correctReps,
                 incorrectReps, avgFormScore, feedbackTags
```

### Design decisions

**Metrics are derived on read, never stored.** They cannot drift out of sync
with the profile that produced them.

**`FoodLog` stores servings, never calories.** Macros are recomputed from the
`Food` row on every read, so correcting a seed value retroactively corrects
all history.

**Updating your weight *is* logging it.** Saving the profile appends a
`WeightEntry` when the value actually changed, so there is no separate
weight-logging flow. The change threshold is 100 g.

**Two session tables.** `WorkoutSession` records that a workout happened;
`FormSession` records that the camera analysed it. A camera session writes
both, in one transaction. This keeps workout statistics intact if the camera
is never used.

**SQLite deviations.** SQLite supports neither scalar lists nor enums, so:

| Conceptually | Stored as |
|---|---|
| `tags[]`, `allergies[]`, `feedbackTags[]` | comma-separated `String`, via `lib/tags.ts` |
| enum columns | `String` + a Zod union in `lib/types.ts` |
| array filtering | JavaScript filtering after fetch |

---

## 4. Health metrics

All in `src/lib/metrics.ts`. Pure functions, 20 unit tests.

```
BMI   = weightKg / heightM²

BMR   (Mifflin–St Jeor)
      male:   10·weight + 6.25·height − 5·age + 5
      female: 10·weight + 6.25·height − 5·age − 161

TDEE  = BMR × activity factor
      sedentary 1.2 · light 1.375 · moderate 1.55
      active 1.725 · very active 1.9

Calorie target
      weight loss      TDEE − 500   (floor: 1500 male / 1200 female)
      muscle gain      TDEE + 300
      maintenance      TDEE
      general fitness  TDEE

Protein target (g per kg bodyweight)
      weight loss 1.6 · muscle gain 2.0 · otherwise 1.2

Calories burned = MET × weightKg × hours
```

**BMI categories:** <18.5 underweight · 18.5–24.9 normal · 25–29.9 overweight
· ≥30 obese.

**Safety floors** prevent an aggressive deficit on a small body from producing
an unsafe target.

### Worked example — the reference user

A 24-year-old male, 72 kg, 175 cm, moderately active, goal muscle gain:

```
BMI            = 72 / 1.75²                     = 23.5  (normal)
BMR            = 10(72) + 6.25(175) − 5(24) + 5 = 1699 kcal
TDEE           = 1699 × 1.55                    = 2633 kcal
Calorie target = 2633 + 300                     = 2933 kcal
Protein target = 72 × 2.0                       = 144 g
```

These exact values are asserted in `metrics.test.ts` and can be checked by
hand.

### Required disclaimer

Shown wherever BMI appears:

> BMI is a general screening metric. It does not account for muscle mass, bone
> density or body composition, and is not a medical diagnosis. Consult a
> healthcare professional for medical advice.

---

## 5. The AI layer

### 5.1 The client (`lib/ai/client.ts`)

The only place FitAI makes a network call to a language model. One function:

```ts
generateStructured<T>({ prompt, zodSchema, jsonSchema, retryPrompt }): Promise<T | null>
```

It **never throws**. `null` means "use the deterministic fallback", and every
caller handles it — which is what allows the application to work with no API
key.

**Resilience.** Free-tier models are frequently overloaded and are capped at
**20 requests per day, per model**:

| Condition | Behaviour | Why |
|---|---|---|
| No API key | return `null` immediately | nothing to call |
| 5xx overload | retry once with 700 ms backoff | often transient |
| 429 quota exhausted | move to the next model at once | quota is per model; retrying cannot succeed |
| 404 model retired | move to the next model at once | the next may still exist |
| 400 / 403 | give up | will never succeed |
| Schema mismatch | one corrective retry naming the problem | the model can often fix it |

**Timeouts.** 10 seconds per request, 15 seconds for the whole exchange.
Without these, a single overloaded model held a connection open for 47 seconds
to return six tokens, and one plan took 86 seconds.

**Model chain.** Three models are tried in order. `GEMINI_MODEL` in `.env`
overrides the chain with a single model.

### 5.2 The five-step pipeline

Both planners follow the same shape:

```
1. BUILD MENU    query the database for eligible rows only
2. ASK MODEL     profile + target + menu → identifiers and quantities
3. VALIDATE      Zod schema + business rules; one corrective retry
4. COMPUTE       application code multiplies and sums
5. PERSIST       write the plan, render it
```

### 5.3 Constrain by query, not by prompt

The single most important reliability decision:

```ts
const menu = await db.food.findMany({
  where: opts.dietaryPreference === 'vegetarian' ? { isVeg: true } : {},
})
// allergy and budget filters applied in JS
```

A vegetarian's menu contains 31 of 60 foods, and no meat is among them. **The
model cannot violate the constraint because the violating option is never in
its input.** This is a structural guarantee, not a matter of the prompt being
obeyed.

*Verified on the live AI path:* a vegetarian profile with an egg allergy
produced a plan with zero non-vegetarian and zero egg-tagged items, at 3,028
kcal and 145 g protein against a 2,923 kcal / 143 g target.

### 5.4 Diet plan validation

In order:

1. Every `foodId` exists in the menu that was sent → else retry
2. Total calories within ±8% of target → else retry, quoting the actual total
3. Total protein ≥ the minimum → else retry
4. Servings between 0.25 and 6 → clamp

A second failure triggers the deterministic fallback.

### 5.5 The deterministic fallback

Builds each meal from a category template — a grain, a protein, a vegetable —
rather than sorting by protein density. An earlier version sorted by density
and produced "3× Chicken tikka" for breakfast with lunch and dinner identical:
arithmetically correct, nutritionally absurd.

A top-up pass then raises protein-dense servings, trading down the least
protein-dense item when calories run out.

A `variant` seed is randomised per request, so pressing *Regenerate* offline
returns a genuinely different plan while remaining deterministic for a given
seed.

**Infeasible targets.** On a budget-restricted menu with an aggressive protein
target and a calorie deficit, no arrangement reaches the target — 115 g of
protein inside 1,800 kcal requires about 0.064 g per kcal, which only eggs and
pulses approach. The planner detects this and explains it:

> A 114 g protein target is not achievable within 1,529 kcal from the foods
> available to you — the densest options here top out near 86 g. Consider
> raising your calorie target or widening your food preferences.

### 5.6 Workout plan validation

- Day count equals the profile's `workoutDays`
- Each day's estimated duration within 10 minutes of `sessionMinutes`
  (3 seconds per repetition plus rest)
- No muscle group trained on consecutive days
- Every exercise identifier came from the menu

The fallback pads each day from the rest of the menu and adds sets until it
reaches the session length — the beginner menu has only one chest movement, so
a strict "Push" day would otherwise be a single five-minute exercise.

### 5.7 Natural-language food entry

Free text is mapped onto the same filtered menu, so text entry cannot
introduce a food the user's diet excludes. The result is presented as an
**editable draft and never auto-saved** — quantity estimation from text is
inherently approximate, so the model proposes and the user commits.

---

## 6. Pose analysis

### 6.1 Pipeline

Runs entirely in the browser.

```
getUserMedia → <video> → requestAnimationFrame (~30 fps)
  └─▶ PoseLandmarker.detectForVideo()
        └─▶ 33 landmarks { x, y, z, visibility }
              ├─▶ visibility gate on required joints
              ├─▶ joint angles
              ├─▶ exponential smoothing (α = 0.3)
              ├─▶ repetition state machine
              ├─▶ form rules
              └─▶ skeleton overlay
  └─▶ on Finish → POST one FormSession + one WorkoutSession
```

### 6.2 The core geometry

Every repetition count and form check derives from one function:

```ts
export function angle(a: Pt, b: Pt, c: Pt): number {
  const radians = Math.atan2(c.y - b.y, c.x - b.x)
                - Math.atan2(a.y - b.y, a.x - b.x)
  const degrees = Math.abs((radians * 180) / Math.PI)
  return degrees > 180 ? 360 - degrees : degrees
}
```

Normalised coordinates make it resolution- and distance-independent.

### 6.3 Repetition counting

A two-state machine with hysteresis:

```
top ──(value < enterBottom)──▶ bottom ──(value > enterTop)──▶ top  ✓ rep
```

The gap between thresholds prevents a hovering angle from producing phantom
repetitions. A repetition is counted **only** on the bottom→top transition, so
it necessarily represents a full movement down and back up.

### 6.4 Exercise configuration

| | Squat | Bicep curl |
|---|---|---|
| Primary angle | hip → knee → ankle | shoulder → elbow → wrist |
| Count thresholds | below 120°, then above 160° | below 80°, then above 140° |
| Form rule 1 | depth: min angle > 100° → *"Go slightly lower"* | range: min > 60° → *"Curl all the way up"* |
| Form rule 2 | back: torso lean > 45° → *"Keep your back straighter"* | extension: max < 150° → *"Fully extend at the bottom"* |
| Form rule 3 | knees: inset > 8% frame width → *"Push your knees out"* | drift: upper arm > 20° → *"Keep your elbow tucked in"* |
| Camera position | side-on, 2–3 m | front-on, 2 m |

**Counting thresholds are deliberately more generous than form thresholds.**
An earlier design used the same number for both, which made three of the six
form rules unreachable — a squat could not simultaneously be counted and be
judged too shallow. A regression test now asserts every rule threshold falls
inside the counted range.

Only the single highest-priority violation is displayed. Three simultaneous
corrections is noise, not coaching.

### 6.5 Robustness

**Jitter.** Landmarks wobble frame to frame. An exponential moving average
(`smoothed = 0.7·previous + 0.3·current`) removes it. Combined with threshold
hysteresis this eliminates false counts.

**Leaving frame.** Before every evaluation, required landmarks are checked for
visibility above 0.5. If any is missing the state machine freezes and a banner
appears; the count is retained and resumes correctly. Verified by simulation.

**Camera position.** A setup card precedes every session, and the Start button
is gated on one continuous second of full visibility — so a session cannot
begin from an unusable position.

**Form score** = correct ÷ total × 100. Honest and trivially explainable.

---

## 7. API reference

All routes require an authenticated session except the auth routes themselves.
Unauthenticated requests are redirected to `/login`.

### Authentication

| Route | Method | Body | Response |
|---|---|---|---|
| `/api/auth/signup` | POST | `{email, password}` | `{ok, next}` · 409 if taken |
| `/api/auth/login` | POST | `{email, password}` | `{ok, next}` · 401 invalid |
| `/api/auth/logout` | POST | — | `{ok}` |

Login returns an identical message for an unknown email and a wrong password,
so the endpoint cannot be used to enumerate registered addresses.

### Profile

| Route | Method | Body | Response |
|---|---|---|---|
| `/api/profile` | GET | — | `{profile, metrics, allergies}` · 404 if none |
| `/api/profile` | POST | full profile | `{profile, metrics, allergies}` |

A POST appends a `WeightEntry` when the weight changed by 100 g or more.

### Foods and logging

| Route | Method | Query / body | Response |
|---|---|---|---|
| `/api/foods/search` | GET | `?q=` | `{foods}` — max 10, name and Urdu name |
| `/api/foods/similar` | GET | `?foodId=` | `{foods}` — same category, ±40% calories, diet-filtered |
| `/api/log` | POST | one entry or `{entries:[…]}` | `{ok, count}` |
| `/api/log/[id]` | PATCH | `{servings}` | `{ok}` · 404 if not yours |
| `/api/log/[id]` | DELETE | — | `{ok}` · 404 if not yours |

`/api/log` is the single write path for food entries — manual search, "log this
meal" and natural-language entry all use it.

### Planning

| Route | Method | Body | Response |
|---|---|---|---|
| `/api/diet` | GET | — | `{plan}` |
| `/api/diet` | POST | `{}` or `{slot}` | `{ok, source, shortfall, totals}` |
| `/api/diet` | PATCH | `{itemId, foodId}` | `{ok}` — swap, no AI call |
| `/api/workout` | POST | — | `{ok, source}` |
| `/api/workout/complete` | POST | `{workoutPlanItemId}` | `{ok, session}` — idempotent per week |
| `/api/parse` | POST | `{text, defaultSlot}` | `{draft}` · 503 without a key |
| `/api/form-session` | POST | session summary | `{ok, formSession}` |

`source` is `"ai"` or `"fallback"`, and the interface shows which.

---

## 8. Design system

Tokens live in `src/app/globals.css`; primitives in `src/components/ui/`.

### Colour

A deep, desaturated pine (chroma 0.075 against a typical 0.15) used sparingly
— primary actions, active states and data. Neutrals are near-achromatic so
large grey areas read as paper rather than as a colour.

**Every text token meets WCAG AA (4.5:1) in both themes**, verified by
computing ratios from the oklch values rather than by eye. Two tokens failed
the first check and were solved numerically:

| Token | Before | After |
|---|---|---|
| accent on white | 3.67:1 | **6.84:1** |
| tertiary grey on white | 2.59:1 | **4.51:1** |

### Primitives

`Button` · `Card` · `Field` · `Input` · `Select` · `Notice` · `EmptyState` ·
`Skeleton` · `Badge` · `ProgressBar` · `ProgressRing` · `Page` · `PageHeader`

### Motion

One shared easing. Fade, rise and scale entrances; staggered list reveals.
**Every animation is disabled under `prefers-reduced-motion`**, including
smooth scrolling.

### Responsive behaviour

Desktop gets a sticky translucent header; mobile gets a bottom tab bar within
thumb reach, with safe-area padding for notched devices. A skip link is the
first focusable element on every page.

---

## 9. Testing

**311 tests across 18 files.**

| File | Tests | Covers |
|---|---|---|
| `ai/diet.test.ts` | 37 | menu filtering, validation, fallback, feasibility |
| `pose/exercises.test.ts` | 31 | joint angles, form rules, config invariants |
| `ai/client.test.ts` | 30 | retries, model chain, timeouts, quota handling |
| `api/__tests__/routes.test.ts` | 28 | route handlers against a real database |
| `ai/workout.test.ts` | 24 | duration estimation, recovery rules, fallback |
| `pose/repMachine.test.ts` | 23 | repetition counting, hysteresis, smoothing |
| `metrics.test.ts` | 20 | BMI, BMR, TDEE, targets, floors |
| `nutrition.test.ts` | 14 | macro scaling, summing, calorie burn |
| `profile.test.ts` | 14 | validation, weight-entry threshold |
| `seed.test.ts` | 12 | seed data plausibility |
| `tags.test.ts` | 12 | comma-separated list encoding |
| `pose/angles.test.ts` | 12 | geometry |
| `foodLog.test.ts` | 11 | day ranges, daily summaries |
| `ai/parse.test.ts` | 11 | natural-language mapping |
| `auth.test.ts` | 10 | hashing, credential validation |
| `stats.test.ts` | 10 | series building, gaps vs zeros |
| `pose/pipeline.test.ts` | 8 | **whole camera pipeline, synthetically driven** |
| `week.test.ts` | 4 | ISO week boundaries |

### Strategy

Effort is concentrated where defects are silent and expensive: arithmetic, AI
validators and fallbacks, and pose logic. Interface code is verified manually.

**`pipeline.test.ts` is the most valuable file in the suite.** It drives the
entire camera pipeline with synthetic landmarks — a leg is constructed so the
interior knee angle is exactly the target, verified to 0.1° — so repetition
counting and form classification are proven correct **without a camera**,
including the case where the user walks out of frame mid-set.

Integration tests run the real route handlers against a throwaway SQLite
database created and destroyed per run, covering authorisation boundaries: a
user cannot read, edit or delete another user's rows.

### Defects the tests found

1. **Unreachable form rules.** Counting below 100° while faulting above 100°
   meant *"Go slightly lower"* could never appear. Three of six rules were
   dead code.
2. **A floating-point weight bug.** `|72 − 72.1|` is `0.09999999999999432`, so
   a bare `>= 0.1` test silently discarded 100 g weight changes.
3. **An absurd fallback plan.** Sorting by protein density produced "3×
   Chicken tikka" for breakfast with lunch and dinner identical.
4. **A stale search race.** A slow response could overwrite a newer one.

### Running

```bash
npm test              # all 311
npm run test:watch    # re-run on change
npm test -- src/lib/pose   # one directory
```

---

## 10. Security and privacy

**Passwords** are hashed with bcrypt (10 rounds, salted). The plaintext is
never stored or logged.

**Sessions** are signed JWTs in an `httpOnly`, `SameSite=Lax` cookie, secure
in production. Stateless, so there is no session table to keep in sync. An
expired or tampered token returns `null` rather than throwing.

**Authorisation** is enforced in the query, not after it. Update and delete
operations scope by `userId` in the `where` clause, so another user's row
reads as not-found rather than being editable. Covered by integration tests.

**User enumeration** is prevented: login returns an identical message for an
unknown email and a wrong password.

**Video never leaves the device.** Pose detection runs in the browser via
WebAssembly. Only aggregate repetition counts and a form score are
transmitted. The interface states this on the page.

**Secrets** live in `.env`, which is git-ignored. The API key is sent in the
query string of the provider request, never in a body that could be logged,
and never reaches the browser.

---

## 11. Limitations

Stated plainly, as they affect how results should be read.

1. **Two-dimensional pose estimation.** Thresholds are heuristics tuned
   against synthetic and recorded movement, not clinical measurements.
2. **Smoothing lag.** Movements completed in well under half a second are
   damped below the thresholds and missed. Real repetitions take one to three
   seconds.
3. **BMI is a screening metric**, not a diagnosis.
4. **Nutrition values are per standard household serving** from a published
   composition table; real portions vary.
5. **Infeasible protein targets** on a budget menu with a calorie deficit
   cannot be met by any arrangement of the available foods. The application
   detects and explains this.
6. **Natural-language quantities are approximate**, which is why the result is
   an editable draft.
7. **The free AI tier allows 20 requests per day, per model.** Plan
   demonstrations accordingly; the deterministic planners cover the shortfall.
8. **Two exercises** have camera form tracking. Adding a third means adding
   one configuration object — the plumbing generalises.
