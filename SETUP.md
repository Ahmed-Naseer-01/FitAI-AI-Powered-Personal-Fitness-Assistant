# FitAI — Setup Guide

Everything needed to get FitAI running from a clean machine. Follow the steps
in order; each one tells you what success looks like.

---

## 1. System requirements

| Requirement | Minimum | Notes |
|---|---|---|
| **Node.js** | 20.0 or newer | Next.js 16 will not start on Node 18 |
| **npm** | 10 or newer | Ships with Node 20 |
| **Disk space** | ~700 MB | 600 MB `node_modules`, 5.5 MB pose model |
| **RAM** | 4 GB | 8 GB comfortable |
| **Browser** | Chrome, Edge, or Safari 16+ | Needed for the webcam module |
| **Webcam** | optional | Only the `/train` page uses it |
| **Internet** | optional | Only the AI features need it |

Check your versions:

```bash
node --version     # must print v20.x.x or higher
npm --version      # must print 10.x.x or higher
```

If Node is older, install the current LTS from [nodejs.org](https://nodejs.org)
or with `nvm install 20 && nvm use 20`.

---

## 2. Dependencies

These install automatically in step 3 — this table is for your report.

### Runtime

| Package | Version | Purpose |
|---|---|---|
| `next` | 16.3.6 | React framework, routing, API routes |
| `react` / `react-dom` | 19.2.8 | UI library |
| `@prisma/client` | 6.19.3 | Type-safe database access |
| `zod` | 4.6.5 | Runtime validation of input and AI responses |
| `bcryptjs` | 3.0.3 | Password hashing |
| `jose` | 6.2.12 | Signing and verifying the session JWT |
| `recharts` | 3.10.1 | Dashboard charts |
| `@mediapipe/tasks-vision` | 1.0.1 | In-browser pose detection |

### Development

| Package | Version | Purpose |
|---|---|---|
| `typescript` | 5.x | Static typing |
| `prisma` | 6.19.3 | Schema management and migrations |
| `vitest` | 4.1.11 | Unit and integration tests |
| `tailwindcss` | 4.x | Styling |
| `tsx` | 4.x | Runs the TypeScript seed scripts |
| `eslint` | 9.x | Linting |

---

## 3. Installation

```bash
# 1. Get the code
git clone https://github.com/Ahmed-Naseer-01/FitAI-AI-Powered-Personal-Fitness-Assistant.git
cd FitAI-AI-Powered-Personal-Fitness-Assistant

# 2. Install dependencies (takes 1-2 minutes)
npm install
```

**Success looks like:** `added N packages` with no `ERR!` lines.

---

## 4. Environment variables

```bash
cp .env.example .env
```

Then open `.env` and set `SESSION_SECRET`. Generate one with:

```bash
openssl rand -base64 32
```

Your `.env` should look like this:

```bash
# Database location. Leave as-is for local development.
DATABASE_URL="file:./dev.db"

# Signs the session cookie. REQUIRED — the app cannot log anyone in without it.
SESSION_SECRET="paste-your-32-character-random-string-here"

# Optional. Leave empty to use the built-in planners.
GEMINI_API_KEY=""

# Optional. Pins a single AI model instead of the built-in chain.
GEMINI_MODEL=""
```

> `.env` is git-ignored. Never commit it.

---

## 5. Database

```bash
npm run db:push     # creates prisma/dev.db from the schema
npm run db:seed     # loads 60 foods and 15 exercises
```

**Success looks like:** `Seeded 60 foods and 15 exercises.`

---

## 6. Pose model (only if you want the webcam feature)

```bash
npm run setup:model
```

Downloads `pose_landmarker_lite.task` (5.5 MB) into `public/models/`. Hosting
it locally rather than from a CDN means the webcam page works without internet.

**Success looks like:** the file exists and is about 5.5 MB:

```bash
ls -lh public/models/pose_landmarker_lite.task
```

---

## 7. Run it

```bash
npm run dev
```

Open **http://localhost:3000**.

You will be redirected to `/login`. Click **Sign up** and create an account,
then complete the six-field onboarding form.

---

## 8. Optional: load the demo account

Rather than starting empty, load two weeks of history:

```bash
npm run db:demo
```

Then log in as:

```
Email:    demo@fitai.test
Password: demo1234
```

This populates the dashboard with weight trends, calorie history, workouts and
form-analysis sessions. Three days are deliberately left unlogged so the charts
demonstrate gaps rather than zeros.

---

## 9. Optional: enable the AI features

Without a key, diet and workout plans are produced by the built-in
deterministic planners and the app tells you so. To enable AI-written plans:

1. Get a free key at [Google AI Studio](https://aistudio.google.com/apikey)
2. Add it to `.env`:
   ```bash
   GEMINI_API_KEY="your-key-here"
   ```
3. Restart the dev server

> ⚠️ **The free tier allows 20 requests per day, per model.** Generating a
> diet plan costs one request; a workout plan costs another. Before a
> presentation, generate your plans in advance rather than clicking
> *Regenerate* repeatedly. See [Deployment](docs/DEPLOYMENT.md) for
> alternatives.

---

## Command reference

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm test` | Run all 311 tests |
| `npm run test:watch` | Re-run tests as you edit |
| `npm run lint` | ESLint |
| `npm run db:push` | Apply the schema to the database |
| `npm run db:seed` | Load foods and exercises |
| `npm run db:demo` | Create the demo account with history |
| `npm run db:reset` | Delete the database and rebuild it from scratch |
| `npm run db:studio` | Open Prisma Studio to browse the data |
| `npm run setup:model` | Download the MediaPipe pose model |

---

## Troubleshooting

**`SESSION_SECRET is missing or shorter than 16 characters`**
You skipped step 4. Copy `.env.example` to `.env` and set a real secret.

**`Cannot find module '@prisma/client'`**
The Prisma client has not been generated. Run `npx prisma generate`.

**Food search returns nothing**
The database was created but not seeded. Run `npm run db:seed`.

**The webcam page shows "Loading pose model…" forever**
The model file is missing. Run `npm run setup:model` and reload.

**Camera permission was denied**
Allow camera access in your browser's site settings and reload. The workout
page still lets you tick exercises off manually.

**`Port 3000 is in use`**
Another dev server is running. Either use it, or stop it with
`lsof -ti:3000 | xargs kill`.

**Plans always say "Generated offline" even with a key set**
Your daily AI quota is exhausted (20 requests per model). Wait for the daily
reset, or leave it — the built-in planner produces a complete plan.

**`OpenGL error checking is disabled` in the console**
This is not an error. MediaPipe prints it when it initialises on the GPU.
