# Architecture

- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS 3, Lucide React, React Router 6 (HashRouter).
- **Hosting:** GitHub Pages (static). Vite `base` is `/leadlink/`.
- **Backend (planned, Phase 2):** Supabase Free: Postgres, Auth, Storage, Row Level Security.

## Folder layout
```
src/layouts   PublicLayout (marketing), AppLayout (sidebar shell)
src/pages     one file per screen
src/components shared pieces (Logo, CommandPalette, MockBanner)
src/lib       nav definitions, temporary mock data
```

## Decisions
- HashRouter: reliable on GitHub Pages without server rewrites.
- Tailwind 3 (stable, widely documented) rather than 4.
- Sample data lives only in `src/lib/mock.ts` and every screen that uses it shows a "Sample data" banner.
