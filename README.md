# LEADLINK

**Connect. Lead. Inspire.**
Every leader builds. Every generation continues.

LEADLINK is a multi-organization management and leadership continuity platform, starting with student organizations at the University of Mindanao. LEADSPIRE is its leadership development space.

## Status: Phase 1 (foundation) — written, NOT yet tested

| Area | Status |
|---|---|
| Vite + React + TypeScript + Tailwind setup | Written, not yet built or run |
| Landing, About, Features, Login, Register pages | Written, not yet run. Login/Register validate input only; no real accounts |
| Personal dashboard and organization dashboard | Written, uses **sample data** |
| App shell: sidebar, org switcher (sample orgs), Ctrl+K quick jump, mobile drawer | Written, not yet run |
| GitHub Pages workflow | Written, not yet run |
| Supabase, auth, database, RLS | **Not started** (Phase 2) |
| Library, Legacy, Turnover, Events, Projects, PWA | **Not started** |

## Run it locally

```
npm install
npm run dev
```

Open the address shown in the terminal. Build check: `npm run build`.

## Deploy (GitHub Pages)

1. Push to `main`.
2. In the repo: Settings → Pages → Source: **GitHub Actions**.
3. The site appears at https://shaynedigo31-cyber.github.io/leadlink/

The app uses HashRouter (URLs look like `/#/login`) because GitHub Pages cannot rewrite deep links. Deployment has not been tested yet.

## Docs

See the `docs/` folder. Secrets never go in git: copy `.env.example` to `.env.local` when Supabase is set up.
