# RL Tracker

A dead-simple Rocket League win-streak & MMR tracker. No accounts, no backend —
everything is stored in your browser's **localStorage**, so your history stays on
your device and survives page reloads and app redeploys.

## Features

- **Win / Loss buttons** with an optional MMR entry per match
- **Stats**: current streak, wins, losses, win rate, best win streak, net MMR change
- **MMR chart** — a lightweight SVG line chart of your MMR over time
- **Match history** with per-match delete and a full reset
- Data persists across reloads and deploys (localStorage key `rl-tracker:matches:v1`)

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Tech

- Next.js (App Router) + TypeScript + Tailwind CSS
- 100% client-side persistence — no database, no login

## Deploying to Vercel

Push this folder to a Git repo and import it in Vercel (framework preset: Next.js).
Because all data lives in each visitor's browser, **new deploys never wipe user
data** — the storage key is versioned and only changes on a deliberate migration.

## How persistence works

- `src/lib/storage.ts` reads/writes/validates the match list under a stable,
  versioned key. Corrupt data falls back to an empty list instead of crashing.
- `src/hooks/useMatches.ts` loads once on mount and mirrors every change back to
  localStorage. It only starts writing *after* the initial load, so an empty
  first render can never overwrite existing history.
