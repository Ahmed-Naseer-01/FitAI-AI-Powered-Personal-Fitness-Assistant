# FitAI — Deployment Guide

Three routes, in order of what I'd recommend for a final-year project.

| Route | Cost | Effort | Database | Best for |
|---|---|---|---|---|
| **A — Vercel + Neon** | free | ~20 min | managed Postgres | a public URL to put in your report |
| **B — Railway** | ~$5 credit | ~10 min | SQLite on a disk | zero code change |
| **C — Local only** | free | none | SQLite | live demonstration on your laptop |

> **Why the database changes.** SQLite writes to a file. Serverless platforms
> give each request a fresh, read-only filesystem, so a SQLite file cannot
> persist — anything written disappears. Route A therefore uses managed
> Postgres. Route B runs a real server with a real disk, so SQLite works
> unchanged.
>
> The code handles this automatically: `scripts/set-db-provider.mjs` reads
> `DATABASE_URL` and sets the Prisma provider to match, so there is only ever
> one schema file to maintain.

---

## Route A — Vercel + Neon Postgres (recommended)

### A1. Create the database

1. Sign up at [neon.tech](https://neon.tech) — free tier, no card required
2. Create a project named `fitai`
3. Copy the **pooled** connection string. It looks like:

```
postgresql://user:password@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require
```

> Use the **pooled** string, not the direct one. Serverless functions open
> many short-lived connections and will exhaust a direct connection limit.

### A2. Push your code to GitHub

```bash
git add -A
git commit -m "chore: prepare for deployment"
git push origin main
```

### A3. Deploy on Vercel

1. Sign up at [vercel.com](https://vercel.com) with your GitHub account
2. **Add New → Project**, then import your repository
3. Leave the framework preset as **Next.js**
4. Before clicking Deploy, open **Environment Variables** and add:

| Name | Value |
|---|---|
| `DATABASE_URL` | your Neon pooled connection string |
| `SESSION_SECRET` | a fresh secret — run `openssl rand -base64 32` |
| `GEMINI_API_KEY` | your key, or leave empty |

5. Click **Deploy**

The `vercel-build` script runs automatically and does four things: sets the
Prisma provider from `DATABASE_URL`, generates the client, creates the tables,
then builds the app.

### A4. Seed the production database

The build creates empty tables. Load the reference data from your machine:

```bash
DATABASE_URL="your-neon-pooled-string" npm run db:provider
DATABASE_URL="your-neon-pooled-string" npx prisma generate
DATABASE_URL="your-neon-pooled-string" npm run db:seed
```

Expected output: `Seeded 60 foods and 15 exercises.`

Optionally add the demo account:

```bash
DATABASE_URL="your-neon-pooled-string" npm run db:demo
```

Then restore your local setup:

```bash
npm run db:provider && npx prisma generate
```

### A5. Verify

Open your Vercel URL and check:

- [ ] `/login` renders
- [ ] You can sign up and complete onboarding
- [ ] `/profile` shows BMI, BMR, TDEE and the calorie target
- [ ] Food search returns results — *if empty, step A4 did not run*
- [ ] `/diet` generates a plan
- [ ] `/train` requests camera permission and loads the pose model
- [ ] `/dashboard` renders charts

---

## Route B — Railway (no code changes)

Railway runs a persistent container, so SQLite works exactly as it does
locally.

1. Sign up at [railway.app](https://railway.app)
2. **New Project → Deploy from GitHub repo**
3. Add a **Volume** mounted at `/app/prisma` — this is what makes the database
   survive restarts
4. Add environment variables:

| Name | Value |
|---|---|
| `DATABASE_URL` | `file:/app/prisma/prod.db` |
| `SESSION_SECRET` | `openssl rand -base64 32` |
| `GEMINI_API_KEY` | your key, or empty |

5. Set the build command:

```bash
npm run setup:model && npx prisma generate && npx prisma db push && npm run build
```

6. Set the start command:

```bash
npx prisma db seed && npm run start
```

> **Without the volume your data is wiped on every restart.** This is the most
> common mistake with this route.

---

## Route C — Local demonstration

Entirely legitimate for a viva, and the most reliable option — no network, no
quota, no platform outage.

```bash
npm run build
npm run start
```

Serves the production build at `http://localhost:3000`, faster than `dev`.

To demonstrate from a phone on the same wifi, add your machine's LAN address
to `next.config.ts`:

```ts
const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.1.2'],   // your address
}
```

> The camera requires a secure context. `localhost` counts as secure, but a
> LAN IP over plain HTTP does not — so `/train` will not work from a phone
> without HTTPS. Demonstrate the camera on the laptop itself.

---

## Before you deploy — checklist

- [ ] `npm test` passes (311 tests)
- [ ] `npm run build` succeeds
- [ ] `.env` is **not** committed — verify with `git check-ignore .env`
- [ ] A **fresh** `SESSION_SECRET` for production, not your development one
- [ ] `npm run setup:model` has run, or the webcam page cannot load

---

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Connection string. Also selects the Prisma provider. |
| `SESSION_SECRET` | yes | Signs the session cookie. 32+ random characters. |
| `GEMINI_API_KEY` | no | Enables AI plans. Without it the built-in planners run. |
| `GEMINI_MODEL` | no | Pins one model instead of the built-in chain. |

---

## The pose model in production

`public/models/pose_landmarker_lite.task` (5.5 MB) is git-ignored, because a
binary that large does not belong in version control.

**On Vercel**, add the download to the build so it ships with the deployment:

```json
"vercel-build": "npm run setup:model && node scripts/set-db-provider.mjs && prisma generate && prisma db push --accept-data-loss && next build"
```

**Alternatively**, commit the file by removing this line from `.gitignore`:

```
public/models/*.task
```

If you skip both, `/train` will show "Loading pose model…" indefinitely.

---

## Troubleshooting

**Food search returns nothing in production**
The database was created but never seeded. Run step A4.

**`Can't reach database server`**
Check `DATABASE_URL` in the Vercel dashboard, and that you used the **pooled**
Neon string.

**`SESSION_SECRET is missing or shorter than 16 characters`**
The variable is not set on the platform. Add it and redeploy.

**`Too many connections`**
You used the direct Neon string instead of the pooled one.

**Data disappears after a restart (Railway)**
The volume is missing or mounted at the wrong path. It must cover the
directory your `DATABASE_URL` points at.

**`/train` never finishes loading**
The model file is not deployed. See *The pose model in production* above.

**The camera does not work on the deployed site**
`getUserMedia` requires HTTPS. Vercel and Railway both provide it
automatically — if you are on plain HTTP, that is the cause.

**Plans always say "Generated offline"**
Either `GEMINI_API_KEY` is unset in the platform's environment, or the daily
quota (20 requests per model) is exhausted. The application works either way.
