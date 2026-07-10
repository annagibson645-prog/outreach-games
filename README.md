# Outreach Games

A private, gamified tracker for outreach activity — quick-log actions (DMs, follow-ups, Looms, calls, closed clients, content, comments, real revenue), turn them into a running score, and see the payoff in streaks, a daily goal, badges, goals, and an interactive trend chart.

Art Deco visual direction: deep navy and gold, symmetric layout, diamond medallions for badges.

## Features

- **PIN-gated** single-user access (demo PIN: `1234`)
- **Quick log** — one tap per action, instant feedback
- **Daily goal** — set a daily point target; today's progress shows on the dashboard, and hit/miss days are marked on the trend chart and in History
- **Score trend** — interactive chart (daily / weekly / monthly / quarterly) with hover tooltips
- **Conversion funnel** — DM → Loom → Call → Close, with stage-to-stage rates
- **History** — grouped by day, each entry editable or deletable
- **Goals** — optional weekly/monthly/quarterly targets per metric
- **Badges** — 8 achievements computed from your real history
- Fully responsive, mobile-first, no build step

## Tech

Plain HTML/CSS/JS. No framework, no bundler, no dependencies.

- `index.html` — UI and app logic
- `core.js` — data model, scoring/streak/badge/goal engine (all in `localStorage`)
- `charts.js` — interactive SVG line chart + funnel chart engine

## Run locally

Just open `index.html` in a browser — no server or build step required. Or, for a local dev server:

```bash
npx serve .
```

## Deploy

This is a zero-config static site. On [Vercel](https://vercel.com):

1. Push this repo to GitHub (already done if you're reading this from the repo).
2. In the Vercel dashboard, click **Add New → Project**, import this repo.
3. Leave all build settings blank/default (no framework, no build command, no output directory needed) — Vercel will serve the static files as-is.
4. Deploy.

## Data & privacy

All data lives in the browser's `localStorage` — nothing is sent to a server. Clearing site data, switching browsers, or switching devices will not carry history over (see the product roadmap for planned multi-device sync via a real backend).
