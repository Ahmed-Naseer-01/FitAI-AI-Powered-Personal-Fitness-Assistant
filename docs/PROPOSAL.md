# FitAI — AI-Powered Personal Fitness Assistant

## Final Year Project Proposal

**Author:** Ahmed Naseer
**Repository:** https://github.com/Ahmed-Naseer-01/FitAI-AI-Powered-Personal-Fitness-Assistant
**Date:** September 2026

---

## 1. Abstract

FitAI is a web application that combines personalised nutrition planning,
workout scheduling, calorie tracking and real-time exercise form analysis in a
single system. It addresses two problems that consumer fitness applications
generally treat separately: *what a person should eat and do*, and *whether
they are performing exercises correctly*.

The project's distinguishing contribution is architectural rather than
algorithmic. Large language models are widely used in nutrition applications,
but they are prone to producing plausible-looking numbers that are wrong — a
serious defect when a user acts on a calorie figure. FitAI adopts a strict
separation: **the language model selects and explains; deterministic code
calculates.** The model returns only database identifiers and quantities, and
every user-visible number is computed by tested arithmetic over structured
data. This makes the system's output reproducible and its failure modes
bounded.

The exercise-analysis module performs pose estimation entirely in the user's
browser using a pre-trained MediaPipe model, so video never leaves the device.
Repetition counting and form classification are implemented as pure functions
over joint angles, which allows them to be verified against synthetic data
without a camera.

---

## 2. Problem statement

People pursuing fitness goals face three practical difficulties:

1. **Generic advice.** Most nutrition guidance is not adapted to the user's
   body, goal, budget, dietary restrictions or local cuisine. Plans built
   around foods a user cannot buy or will not eat are abandoned.

2. **No feedback on technique.** Exercising with poor form reduces benefit and
   risks injury. Personal training is expensive and unavailable to most
   students; existing apps show instructional videos but cannot tell a user
   whether *they* performed the movement correctly.

3. **Unreliable AI nutrition tools.** Applications that ask a language model
   for calorie and macronutrient values receive confident but frequently
   inaccurate numbers. Users have no way to distinguish a correct figure from
   a fabricated one.

For users in Pakistan and South Asia specifically, a fourth problem compounds
the first: mainstream nutrition databases are built around Western foods, so
roti, daal, karahi and biryani are absent or inaccurately represented.

---

## 3. Objectives

**Primary objectives**

1. Build a fitness profile that derives calorie and protein targets from
   established formulae (BMI, Mifflin–St Jeor BMR, TDEE) rather than
   estimates.
2. Generate personalised daily meal plans from a curated database of
   Pakistani and South Asian foods, respecting dietary preference, allergies
   and budget.
3. Generate weekly workout plans validated for session duration and adequate
   recovery between muscle groups.
4. Provide daily calorie and macronutrient tracking with search and optional
   natural-language entry.
5. Analyse exercise form in real time through the webcam, counting repetitions
   and distinguishing correct from incorrect execution.
6. Present progress over time through a dashboard of body, nutrition, workout
   and form-analysis metrics.

**Secondary objectives**

7. Ensure the application remains fully functional without an AI provider, so
   it has no hard external dependency.
8. Ensure all nutritional arithmetic is deterministic, testable and
   independent of the language model.
9. Process all video locally, so no biometric data is transmitted.
10. Meet WCAG 2.1 AA accessibility standards.

---

## 4. Scope

### In scope

- Single-user accounts with email and password authentication
- Profile-driven metric calculation
- AI-assisted diet and workout planning with deterministic fallbacks
- Food logging by search, by plan, and by natural-language description
- Webcam form analysis for **two exercises**: squat and bicep curl
- A progress dashboard over 7-day and 30-day windows
- Responsive interface for desktop, tablet and mobile

### Explicitly out of scope

These were excluded deliberately to keep the project achievable and honest:

- **Medical or diagnostic functionality.** BMI is presented as a screening
  metric with an explicit disclaimer.
- **Custom machine-learning model training.** The project uses a pre-trained
  pose model; training a bespoke one would not improve the result and would
  consume the entire timeline.
- **Wearable device integration.** No consistent API surface across devices.
- **A comprehensive nutrition database.** Sixty well-chosen local foods serve
  the demonstration better than thousands of poorly verified rows.
- **Social features, multi-user coaching, payment processing.**
- **Support for many exercises.** Each exercise requires its own joint-angle
  rules, state machine and threshold tuning. Two done well demonstrates the
  method; twenty done poorly does not.

---

## 5. Methodology

### 5.1 Governing design principle

> **AI selects and explains. Deterministic code calculates.**

Applied concretely:

| Responsibility | Owner |
|---|---|
| Choosing which foods make a meal | Language model |
| Explaining why those foods suit the user | Language model |
| Calories, protein, carbohydrate, fat | Application code |
| BMI, BMR, TDEE, calorie target | Application code |
| Calories burned during exercise | Application code |
| Repetition counting and form judgement | Application code |

### 5.2 Constraint by query, not by prompt

Dietary and allergy restrictions are enforced by filtering the database
*before* the prompt is constructed. A vegetarian user's menu contains 31 of
60 foods, and no meat appears among them. The model cannot violate the
constraint because the violating option is never presented to it.

This was verified empirically: a vegetarian profile with an egg allergy
produced a plan containing zero non-vegetarian and zero egg-tagged items,
while still reaching 145 g of protein against a 143 g target.

### 5.3 Validation and fallback

Every language-model response passes a schema check and a set of business
rules — valid identifiers, calorie total within 8% of target, protein above
the minimum. A failed response triggers one corrective retry, then a
deterministic generator produces the plan instead. The application therefore
functions with no API key at all.

### 5.4 Pose analysis pipeline

```
webcam → MediaPipe PoseLandmarker → 33 landmarks
       → visibility gate → joint angles → exponential smoothing
       → repetition state machine → form rules → live feedback
```

A repetition is counted only on a bottom-to-top transition, and the gap
between the two thresholds (hysteresis) prevents a hovering joint angle from
producing false counts.

### 5.5 Verification strategy

Testing effort is concentrated where defects are silent and consequential:
health and nutrition arithmetic, AI validators and fallback generators, and
the pose geometry and repetition logic. The camera pipeline is driven by
synthetic landmark data in `pipeline.test.ts`, which means repetition counting
and form classification are proven correct **before any camera is attached**.

This approach found a genuine design defect: the original repetition
thresholds made three of six form rules unreachable, because a squat could not
simultaneously be counted and be judged too shallow. The defect would have been
invisible in manual testing.

---

## 6. Technology

| Layer | Choice | Justification |
|---|---|---|
| Framework | Next.js 16, TypeScript | Single codebase for pages and API; strong typing |
| Database | SQLite via Prisma 6 | No database server to install or run on demo day |
| Authentication | bcrypt + signed JWT cookie | Stateless; no session table to maintain |
| Pose estimation | MediaPipe Tasks JS | Pre-trained, runs in-browser, no GPU server required |
| Language model | Google Gemini API | Free tier; native JSON-schema enforcement |
| Charts | Recharts | Declarative, accessible, small |
| Validation | Zod | One schema per AI endpoint |
| Testing | Vitest | Fast; no browser needed for the logic under test |

**Why pose detection runs in the browser.** The original design placed
MediaPipe behind a Python FastAPI service. Moving it into the browser removed a
second runtime, a WebSocket transport, and the largest single source of
demonstration failure — while also guaranteeing that video never leaves the
user's device.

---

## 7. System architecture

```
┌──────────────────────── Browser ────────────────────────┐
│  Next.js pages                                           │
│  /onboarding  /dashboard  /log  /diet  /workout  /train  │
│                                                           │
│  /train ──▶ MediaPipe (WASM, local)                      │
│             video → landmarks → angles → reps → feedback │
│             (video never transmitted)                     │
└──────────────────────────┬───────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────┐
│  API routes                                               │
│   auth · profile · foods · log · diet · workout · parse  │
│   form-session                                            │
│   ↑ metrics and nutrition are pure functions              │
│   ↑ every AI response is schema-validated                 │
└──────────────────────────┬───────────────────────────────┘
                           │ Prisma
┌──────────────────────────▼───────────────────────────────┐
│  SQLite — 12 tables                                       │
└───────────────────────────────────────────────────────────┘
```

---

## 8. Deliverables

1. A working web application covering all six modules
2. Source code under version control with a documented commit history
3. A seeded database of 60 local foods and 15 exercises
4. An automated test suite — **311 tests across 18 files**
5. Technical documentation, setup guide and deployment guide
6. This proposal and a final report

---

## 9. Timeline

The project was planned as seven working phases, ordered by risk so that the
most essential functionality was completed and verified first.

| Phase | Deliverable | Status |
|---|---|---|
| 1 | Project scaffold, database schema, seed data | Complete |
| 2 | Authentication, profile, deterministic metrics | Complete |
| 3 | Food search, calorie logging, daily tracker | Complete |
| 4 | AI diet planner with validator and fallback | Complete |
| 5 | AI workout planner, natural-language food entry | Complete |
| 6 | Webcam pose analysis, repetition and form logic | Complete |
| 7 | Progress dashboard, interface design, documentation | Complete |

**Risk ordering.** Phases 1–3 produce a fully working application with no AI
and no camera. Phases 4–5 add AI, each with a deterministic fallback. Phase 6
adds the camera, which nothing else depends on. Had the schedule compressed,
the losses would have been ordered from least to most damaging.

---

## 10. Expected outcomes and evaluation

**Functional outcomes**

- A user can register, build a profile, and receive calorie and protein
  targets derived from established formulae
- Diet and workout plans generate in under two seconds with or without an AI
  provider
- Dietary restrictions are structurally guaranteed, not merely requested
- The webcam counts repetitions and distinguishes correct from incorrect form
- Progress is visible across body, nutrition, workout and form metrics

**Evaluation criteria**

| Criterion | Method | Result |
|---|---|---|
| Metric correctness | Unit tests against worked examples | 20 tests passing |
| Dietary constraint integrity | Vegetarian and allergy profiles inspected on the live AI path | Zero violations |
| Repetition counting accuracy | Synthetic landmark sequences through the full pipeline | 8 scenarios passing |
| Provider independence | Full flow executed with no API key | All features except text entry function |
| Accessibility | Computed WCAG contrast ratios; automated audit of every page | AA met in light and dark themes |
| Resilience | Behaviour measured under provider rate-limiting and overload | Bounded to 15 s, then falls back |

---

## 11. Known limitations

Stated plainly, as they affect how results should be interpreted:

1. **Two-dimensional pose estimation.** Joint-angle thresholds are heuristics
   tuned against synthetic and recorded movement, not clinical measurements.
2. **Smoothing lag.** The smoothing filter damps movements completed in well
   under half a second, so an unrealistically fast repetition is missed. Real
   repetitions take one to three seconds.
3. **Infeasible protein targets.** On a budget-restricted menu with an
   aggressive protein target and a calorie deficit, no arrangement of the
   available foods reaches the target. The application detects this and
   explains it rather than silently under-delivering.
4. **Nutrition values are per standard household serving** from a published
   composition table; real portions vary.
5. **Natural-language quantity estimation is approximate**, which is why the
   result is presented as an editable draft rather than saved automatically.
6. **BMI is a screening metric**, not a diagnosis. The application states this
   wherever BMI appears.

---

## 12. References

1. Mifflin, M. D., St Jeor, S. T., et al. (1990). *A new predictive equation
   for resting energy expenditure in healthy individuals.* American Journal of
   Clinical Nutrition, 51(2), 241–247.
2. World Health Organization. *Body mass index (BMI) classification.*
3. Ainsworth, B. E., et al. (2011). *Compendium of Physical Activities: a
   second update of codes and MET values.* Medicine & Science in Sports &
   Exercise, 43(8), 1575–1581.
4. Google. *MediaPipe Pose Landmarker documentation.*
5. W3C. *Web Content Accessibility Guidelines (WCAG) 2.1.*

> **Note for the final report:** the nutritional values in
> `prisma/data/foods.ts` should cite the specific composition table used. This
> is recorded as an open item in the design specification.
