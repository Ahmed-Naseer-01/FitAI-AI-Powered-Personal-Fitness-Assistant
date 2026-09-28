# FitAI — AI-Powered Personal Fitness Assistant
## Design Specification

**Date:** 2026-09-29
**Type:** Academic / Final Year Project
**Build window:** 1 week

---

## 1. Overview

FitAI is a web application that gives a user a personalised fitness profile, an
AI-generated diet plan, an AI-generated workout plan, a daily calorie tracker, a
progress dashboard, and real-time exercise form analysis through the webcam.

It is a demonstrator, not a production product. Every design decision below
favours *reliability in a live demo* over depth of feature.

### Governing principle

> **AI selects and explains. Deterministic code calculates.**

The language model never produces a number that the system depends on. It
returns database IDs and quantities; application code performs all arithmetic
against structured nutrition and exercise data. This makes the system's outputs
reproducible and its failure modes bounded.

### Non-goals

Explicitly out of scope: microservices, custom model training, wearable
integration, medical or diagnostic functionality, social features, large
nutrition databases, mobile apps, real-time multi-user features.

---

## 2. Technology

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js (App Router, TypeScript) | Single codebase, pages + API in one place |
| Database | SQLite via Prisma | No DB server to run on demo day |
| Auth | Email + password, bcrypt, session cookie | Expected by examiners; half a day to build |
| Pose detection | MediaPipe Tasks JS (`PoseLandmarker`, WASM) | Pre-trained, runs in-browser, no GPU server |
| LLM | Google Gemini API (`gemini-3.8-flash`), free tier, native `responseSchema` | No cost, no payment card; schema is enforced by the provider |
| Charts | Recharts | Line and bar charts only |
| Validation | Zod | One schema per AI endpoint |

**No Python.** Because pose detection runs in the browser, the original
FastAPI/OpenCV/MediaPipe-Python server is unnecessary. This removes a second
runtime, a WebSocket transport, and the largest single source of demo-day
failure.

**Privacy consequence:** webcam frames never leave the user's device. Only
aggregate rep counts and form scores are transmitted. This is worth stating in
the report.

---

## 3. Architecture

```
┌─────────────────────────── Browser ────────────────────────────┐
│  Next.js React pages                                            │
│  /onboarding  /diet  /log  /dashboard  /workout  /train         │
│                                                                  │
│  /train ──▶ MediaPipe Tasks JS (WASM, local)                    │
│             webcam → 33 landmarks → joint angles →              │
│             rep state machine → form rules → live feedback      │
│             (video never leaves the device)                     │
└────────────────────────────┬────────────────────────────────────┘
                             │ fetch / server actions
┌────────────────────────────▼────────────────────────────────────┐
│  Next.js API routes (Node)                                       │
│    auth        sessions, bcrypt                                  │
│    metrics     BMI / BMR / TDEE        ← pure functions          │
│    nutrition   totals, daily rollups   ← pure functions          │
│    ai/diet     LLM ▸ food IDs + quantities                       │
│    ai/workout  LLM ▸ exercise IDs + sets/reps                    │
│    ai/parse    LLM ▸ NL text → food IDs + quantities             │
│                ↑ every AI response passes a Zod validator        │
└────────────────────────────┬────────────────────────────────────┘
                             │ Prisma
┌────────────────────────────▼────────────────────────────────────┐
│  SQLite                                                          │
│  User · Profile · WeightEntry · Food · FoodLog · MealPlan ·     │
│  MealPlanItem · Exercise · WorkoutPlan · WorkoutPlanItem ·      │
│  WorkoutSession · FormSession                                    │
└──────────────────────────────────────────────────────────────────┘
```

### Three structural rules

1. **All health mathematics is a pure function** in `lib/metrics.ts` — BMI, BMR
   (Mifflin–St Jeor), TDEE, calorie target. Deterministic, unit-testable, never
   AI-derived.
2. **AI endpoints return only IDs and quantities**, validated by Zod. Invalid
   response → one retry with corrective feedback → algorithmic fallback.
3. **Single write path per concept.** Diet planner, NL parser and manual search
   all produce `FoodLog` rows. Camera trainer and workout checklist both produce
   `WorkoutSession` rows. The dashboard reads those tables and computes nothing
   of its own.

---

## 4. Data model

```
User            id, email, passwordHash, createdAt

Profile         userId (1:1), name, age, gender, heightCm, weightKg,
                activityLevel, experience, goal, workoutDays,
                sessionMinutes, dietaryPreference, allergies?, budget?,
                updatedAt
                └─ derived on read: bmi, bmiCategory, bmr, tdee, calorieTarget

WeightEntry     userId, weightKg, bmi, recordedAt          (append-only)

Food            id, name, nameUrdu?, category, servingLabel, servingGrams,
                kcal, proteinG, carbsG, fatG, isVeg, tags[]     (~60 seeded)

FoodLog         userId, foodId, servings, mealSlot, consumedAt

MealPlan        userId, date, generatedAt, aiNotes
MealPlanItem    mealPlanId, foodId, servings, mealSlot, reason

Exercise        id, name, muscleGroup, equipment, difficulty, metValue,
                hasFormTracking, defaultSets, defaultReps      (~15 seeded)

WorkoutPlan     userId, weekStart, generatedAt, aiNotes
WorkoutPlanItem workoutPlanId, exerciseId, dayOfWeek, sets, reps, restSec

WorkoutSession  userId, workoutPlanItemId?, exerciseId, completedAt,
                durationSec, totalReps, estimatedKcal

FormSession     userId, exerciseId, startedAt, durationSec,
                correctReps, incorrectReps, avgFormScore, feedbackTags[]
```

### Decisions embedded in the schema

**Mandatory fields:** age, gender, height, weight, activity level, goal. These
are the minimum inputs for a valid BMR/TDEE calculation. Onboarding is therefore
six fields on one screen.

**Optional fields:** experience (default `beginner`), workout days (default 3),
session minutes (default 45), dietary preference (default `non-veg`), allergies,
budget.

**Weight updates.** `Profile.weightKg` holds the current value. Every change also
appends a `WeightEntry` capturing the BMI at that moment. History is therefore
free, "starting weight" is the first entry, and no separate weight-logging flow
is needed — updating the profile *is* logging.

**Food values are per serving, not per 100 g.** "1 roti = 120 kcal" matches how
users think and how the LLM reasons. `servingGrams` is stored alongside for
reporting. `servings` is a float, so 1.5 rotis is representable.

**FoodLog stores servings, never calories.** Macros are recomputed from the
`Food` row on every read. Correcting a seed value retroactively corrects all
history; there are no stale denormalised numbers.

**Two session tables.** `WorkoutSession` records that a workout was performed;
`FormSession` records that the camera analysed it. A camera session writes both.
This keeps the CV module independent — if the webcam fails, workout statistics
still populate.

**Deliberately absent:** per-set logging, per-muscle-group history, saved
favourite meals, user-created custom foods. If time remains on day 7, custom
foods is the first addition.

---

## 5. Module 1 — Profile and fitness assessment

### Deterministic calculations (`lib/metrics.ts`)

```
BMI   = weightKg / (heightM ^ 2)

BMR   (Mifflin–St Jeor)
      male:   10·weight + 6.25·height − 5·age + 5
      female: 10·weight + 6.25·height − 5·age − 161

TDEE  = BMR × activityFactor
      sedentary 1.2 · light 1.375 · moderate 1.55 ·
      active 1.725 · very active 1.9

Calorie target
      weight loss       TDEE − 500   (floor: 1200 F / 1500 M)
      maintenance       TDEE
      muscle gain       TDEE + 300
      general fitness   TDEE

Protein target
      weight loss 1.6 · muscle gain 2.0 · otherwise 1.2  (g per kg bodyweight)
```

BMI categories: <18.5 underweight · 18.5–24.9 normal · 25–29.9 overweight ·
≥30 obese.

**Required disclaimer**, shown wherever BMI appears: *BMI is a general screening
metric. It does not account for muscle mass, bone density or body composition,
and is not a medical diagnosis. Consult a healthcare professional for medical
advice.*

### Profile → recommendations

| Field | Affects |
|---|---|
| goal | calorie target, protein target, workout split |
| activityLevel | TDEE |
| dietaryPreference, allergies | food menu filter (pre-query, not prompt) |
| budget | food menu filter |
| experience | exercise difficulty filter |
| workoutDays, sessionMinutes | workout plan shape and validation bounds |

---

## 6. Modules 2 & 7 — The AI planners

Both follow an identical five-step pipeline.

```
1. BUILD MENU   query SQLite for eligible rows only
2. ASK LLM      profile + target + menu → IDs and quantities
3. VALIDATE     Zod schema + business rules; one corrective retry
4. COMPUTE      application code multiplies and sums
5. PERSIST      write plan rows, render
```

### 6.0 The LLM provider

All three AI endpoints go through one module, `lib/ai/client.ts`, exposing a
single function:

```ts
generateStructured<T>(prompt: string, schema: ZodSchema<T>): Promise<T | null>
```

The default implementation calls the **Google Gemini API** (`gemini-3.8-flash`)
on its free tier, passing the schema as `responseSchema` so the provider itself
guarantees the response shape. The API key lives in `GEMINI_API_KEY`.

Two consequences worth stating:

- **The application is provider-agnostic.** Swapping to Groq, Claude or a local
  Ollama instance means replacing one function body. No calling code changes.
- **The application never depends on the LLM being reachable.** Every caller
  treats `null` as "use the deterministic fallback". With no API key set at all,
  FitAI still generates diet and workout plans — algorithmically, and slightly
  less intelligently. Only natural-language food entry is genuinely unavailable
  without a provider.

Free-tier quotas change over time; confirm current limits when provisioning the
key. Demo usage is on the order of 20 requests, which is far below any published
tier.

### 6a. Diet planner

**Step 1 — constrain by query, not by prompt.** The single most important
reliability decision in the system:

```ts
const menu = await db.food.findMany({
  where: {
    ...(profile.dietaryPreference === 'vegetarian' && { isVeg: true }),
    NOT: { tags: { hasSome: profile.allergies } },
    ...(profile.budget === 'low' && { tags: { has: 'budget' } }),
  },
  select: { id, name, category, servingLabel, kcal, proteinG, carbsG, fatG },
})
```

A vegetarian's menu cannot contain chicken. The model cannot violate a dietary
or allergy constraint because the violating option is not present in its input.
No prompt engineering is required for the constraints that matter most.

**Step 2 — request.** The menu is sent as a compact table, with the user's
profile summary, calorie target, protein minimum and meal slots. Instruction:
return only IDs from the table, plus serving counts and one short reason per
meal.

**Step 3 — response** (enforced by Gemini `responseSchema`):

```json
{ "meals": [
  { "slot": "breakfast",
    "items": [ { "foodId": 12, "servings": 2 },
               { "foodId": 44, "servings": 2 } ],
    "reason": "Eggs with roti front-loads protein for muscle gain." }
] }
```

**Step 4 — validation gate**, in order:

- every `foodId` exists in the menu sent → else retry
- total kcal within ±8 % of target → else retry, feeding back the actual total
- protein ≥ goal minimum → else retry
- servings within 0.25–6 → clamp

Second failure triggers the **greedy fallback**: fill each slot by category from
the menu until the calorie budget is met. Unrefined, but it never fails.

**Step 5 — compute and render.** Application code performs the multiplication.
The UI shows per-meal and daily totals plus the model's one-line reason per meal.

**Interactions**

- *Regenerate one meal* — same endpoint, scoped: "breakfast only, remaining
  budget 620 kcal". Small prompt, fast.
- *Swap a food* — **no AI call**. Show other foods in the same category within a
  calorie band; user picks. Instant and works offline.
- *Log this meal* — copies `MealPlanItem` rows into `FoodLog` rows. Always
  explicit, never automatic: the plan is intent, the log is fact.

### 6b. Workout planner

Same pipeline. Menu filtered by available equipment and
`difficulty <= experience`. Input adds `workoutDays` and `sessionMinutes`.

```json
{ "days": [
  { "dayOfWeek": 1, "focus": "Upper body",
    "items": [ { "exerciseId": 3, "sets": 3, "reps": 12, "restSec": 60 } ],
    "reason": "Compound pushes first while fresh." }
] }
```

**Validation:** day count equals `workoutDays`; estimated duration
(sets × reps × 3 s + rest) within ±10 min of `sessionMinutes`; no muscle group on
consecutive days; all IDs valid. Fallback is a fixed 3-day full-body template.

**Integration with the camera.** Each `Exercise` carries `hasFormTracking`. Plan
items for squat and bicep curl render a **"Train with camera"** button that opens
`/train` pre-selected to that exercise; all others render a checkbox. This single
boolean is the entire coupling between the workout planner and the CV module.

Completing an item writes a `WorkoutSession`, with calories estimated as
`MET × weightKg × hours`. The camera route writes that plus a `FormSession`.

**Cost:** roughly 2,500 input tokens per plan generation, on a free tier. A
full demo session is on the order of 20 requests.

---

## 7. Module 3 — Calorie and nutrition tracker

**Search.** Single input, `LIKE %query%` over `name` and `nameUrdu`, limit 10,
debounced 200 ms. With ~60 foods no index or fuzzy matching is warranted.

**Logging.** Select food → set servings (stepper, default 1, step 0.5) → select
slot → save. Rows display as `1.5 × Roti — 180 kcal`, editable and deletable in
place.

**Daily summary.** Target, consumed, remaining; protein/carbs/fat totals against
targets.

**Natural-language entry (optional feature).** Free text such as *"two rotis,
chicken curry and a glass of lassi"* is sent with the same food menu; the model
returns `[{ foodId, servings, slot }]`. The result is presented as an **editable
draft and is never auto-saved** — the user confirms or corrects quantities before
any write. This framing is the correct treatment of an inherently approximate
feature: the model proposes, the user commits.

**Day handling.** A day is a date filter over `FoodLog`; there is no day record
to open or close. An unlogged day has no rows and renders as a **gap** in charts,
not a zero — a zero asserts "ate nothing", a gap asserts "no data". Averages skip
empty days.

---

## 8. Module 4 — Progress dashboard

Landing page after login. Four cards above the fold:

| Card | Contents |
|---|---|
| Today | Calorie ring (target / consumed / remaining); protein, carb, fat bars |
| Weight | Current, change since start, BMI and category |
| This week | Workouts completed vs planned, total reps, estimated kcal burned |
| Form | Last session score, correct vs incorrect reps, most common fault |

Three charts (Recharts):

1. Weight over time, from `WeightEntry`, with optional goal line
2. Calories consumed vs target — daily bars with target reference line
3. Workouts per week — bar count

A 7-day / 30-day toggle applies to all three. No monthly view, no correlation
analysis, no streaks.

**Empty states are required.** A new account shows *"Log your first meal to see
this"* with an action button, never an empty chart.

---

## 9. Module 5 — AI exercise analysis

### Pipeline (entirely client-side)

```
getUserMedia → <video> → requestAnimationFrame loop (~30 fps)
  └─▶ PoseLandmarker.detectForVideo()
        └─▶ 33 landmarks { x, y, z, visibility }
              ├─▶ visibility gate on required joints
              ├─▶ compute 2–3 joint angles
              ├─▶ smooth (EMA over 5 frames)
              ├─▶ rep state machine → count
              ├─▶ form rules → score + feedback
              └─▶ draw skeleton overlay on <canvas>
  └─▶ on Finish → POST one FormSession
```

Implemented in `lib/pose/` with one configuration object per exercise. Adding an
exercise means adding a config, not new plumbing.

### Core geometry

```ts
function angle(a: Pt, b: Pt, c: Pt): number {   // angle at b, degrees
  const rad = Math.atan2(c.y - b.y, c.x - b.x)
            - Math.atan2(a.y - b.y, a.x - b.x)
  const deg = Math.abs(rad * 180 / Math.PI)
  return deg > 180 ? 360 - deg : deg
}
```

Every repetition count and form check derives from this one function. Normalised
coordinates are used throughout, so results are resolution-independent.

### Squat

Landmarks: hip (23/24), knee (25/26), ankle (27/28), shoulder (11/12); left and
right averaged.

| Signal | Points | Purpose |
|---|---|---|
| Knee angle | hip → knee → ankle | depth; drives rep count |
| Hip angle | shoulder → hip → knee | hinge amount |
| Torso lean | shoulder–hip vector vs vertical | back straightness |

**Repetition:**

```
UP ──(knee < 100°)──▶ DOWN ──(knee > 160°)──▶ UP   ✓ rep
```

The 60° hysteresis gap prevents an angle hovering near a single threshold from
producing phantom reps. A rep is counted only on the DOWN → UP transition, so it
necessarily represents a full descent and ascent.

**Form rules, evaluated at the bottom of each rep:**

| Rule | Condition | Feedback |
|---|---|---|
| Depth | min knee angle > 100° | "Go slightly lower" |
| Back | torso lean > 45° from vertical | "Keep your back straighter" |
| Knees | knee x inside ankle x by > 8 % of frame width | "Push your knees out" |

All clear → correct rep, "Good repetition." Otherwise incorrect, and only the
single worst violation is displayed.

### Bicep curl

Landmarks: shoulder (11/12), elbow (13/14), wrist (15/16).

| Signal | Points | Purpose |
|---|---|---|
| Elbow angle | shoulder → elbow → wrist | curl position; drives rep count |
| Upper-arm drift | shoulder–elbow vs vertical | elbow anchoring |

```
DOWN ──(elbow < 50°)──▶ UP ──(elbow > 150°)──▶ DOWN   ✓ rep
```

| Rule | Condition | Feedback |
|---|---|---|
| Range | min elbow angle > 60° | "Curl all the way up" |
| Extension | max elbow angle < 150° | "Fully extend at the bottom" |
| Elbow drift | upper arm > 20° from vertical | "Keep your elbow tucked in" |

### Robustness

**Jitter.** Landmark positions wobble frame to frame. Mitigation: exponential
moving average, `smoothed = 0.7·previous + 0.3·current`, over the last 5 frames.
Combined with threshold hysteresis this removes effectively all false counts.

**Subject leaves frame.** Before each evaluation:

```ts
const ready = cfg.required.every(i => landmarks[i]?.visibility > 0.5)
```

If not ready: freeze the state machine, retain the count, display "Step back into
frame". On return the machine resumes from its prior state. This also covers
occlusion by a passer-by and camera displacement.

**Camera positioning** affects accuracy more than threshold tuning. A setup card
precedes every session: stand 2–3 m back, full body in frame, side-on for squats
and front-on for curls, adequate lighting. The Start button is gated on all
required landmarks being visible for one continuous second, so a session cannot
begin from an unusable position.

**Stated limitation for the report:** this is 2D pose estimation and the
thresholds are heuristics tuned against a small set of test recordings. They are
not clinical measurements. Naming this limit is more defensible than claiming
precision.

### Live UI and persistence

On screen: rep count, large CORRECT / NEEDS WORK indicator, current feedback
line, running form score, skeleton overlay.

On Finish, one POST:

```json
{ "exerciseId": 7, "durationSec": 96, "correctReps": 11,
  "incorrectReps": 3, "avgFormScore": 78,
  "feedbackTags": ["depth", "back_angle"] }
```

`avgFormScore = correctReps / totalReps × 100` — honest and trivially
explainable. The route writes a `FormSession` and a `WorkoutSession`.

---

## 10. Seed data

**Foods (~60)** covering Pakistani and South Asian staples: roti/chapati, naan,
plain rice, biryani, pulao, daal chana, daal masoor, chana chaat, rajma, karahi
chicken, chicken curry, chicken tikka, seekh kebab, beef nihari, fish, eggs
(boiled/fried/omelette), dahi, lassi, milk, paneer, aloo gosht, palak, mixed
vegetable sabzi, salad, banana, apple, mango, orange, dates, almonds, peanuts,
samosa, pakora, halwa, kheer, chai with sugar, chai without sugar, paratha, keema,
haleem, white bread, oats, cornflakes.

Each row carries a realistic household serving (1 medium roti, 1 cup, 1 piece),
per-serving macros, `isVeg`, and tags (`budget`, `high-protein`, `egg`, `dairy`,
`nuts`, `gluten`).

**Exercises (~15):** squat, push-up, lunge, plank, bicep curl, shoulder press,
bench press, dumbbell row, lat pulldown, deadlift, glute bridge, mountain
climber, jumping jack, burpee, crunch. Each with muscle group, equipment,
difficulty, MET value, and `hasFormTracking` true for squat and bicep curl only.

Nutrition values should be sourced from a published table and cited in the
report. Their accuracy is a data-quality matter, not a system-design one.

---

## 11. Build order — 7 days

| Day | Deliverable |
|---|---|
| 1 | Next.js + Prisma + SQLite scaffold; schema; seed foods and exercises; auth (signup, login, session); `lib/metrics.ts` with unit tests |
| 2 | Onboarding form; profile page with BMI/BMR/TDEE/target and disclaimer; weight update writing `WeightEntry` |
| 3 | Food search; food logging CRUD; daily summary; the tracker page end to end |
| 4 | LLM integration: diet planner endpoint, validator, greedy fallback; diet page with regenerate-one-meal, swap, and "log this meal" |
| 5 | Workout planner endpoint and page; completion checkboxes writing `WorkoutSession`; NL food parsing with editable draft |
| 6 | Webcam module: MediaPipe setup, angle utilities, squat and bicep-curl configs, state machines, form rules, overlay, session save |
| 7 | Dashboard cards and charts; empty states; styling pass; demo rehearsal; README and report figures |

**Risk order.** Days 1–3 produce a working application with no AI and no camera.
Day 4–5 add AI with algorithmic fallbacks. Day 6 adds the camera, which is
isolated enough to be dropped without breaking anything else. If the week
compresses, the losses are ordered from least to most damaging.

---

## 12. Failure modes and mitigations

| Risk | Mitigation |
|---|---|
| LLM returns invalid or out-of-range plan | Zod validation, one corrective retry, then deterministic fallback generator |
| No internet on demo day | Fallback generators cover both planners; only NL parsing is unavailable |
| Free-tier rate limit or quota exhausted | Same fallback path as a network failure; limits are far above demo usage |
| Webcam permission denied or no camera | `/train` degrades to manual rep entry; dashboard form card shows empty state |
| Poor lighting or framing | Pre-session setup card; Start gated on landmark visibility |
| Phantom rep counts | EMA smoothing plus threshold hysteresis |
| Incorrect seed nutrition values | Stored per-serving and recomputed on read; fixing a row corrects all history |

---

## 13. Open items

- Source and cite the nutrition reference table used for seed values.
- Tune squat and curl thresholds against 3–5 self-recorded clips on day 6;
  record the final values in the report.
- Decide whether to add user-created custom foods if day 7 has slack.
