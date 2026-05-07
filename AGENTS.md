## Learned User Preferences
- User prefers strict test quality gates and repeatedly asks to keep Jest coverage at 100 percent.
- User expects fixes to include verification, then a concise explanation of the root cause and the implemented change.
- User prefers direct implementation over brainstorming when they request concrete feature or bugfix work.
- User often requests broad test coverage for dashboard and monitoring features, including critical path components.

## Learned Workspace Facts
- Repository contains a Next.js dashboard and monitoring UI with core files under `app/dashboard` and `components/dashboard`.
- Test suite uses both Node test runner and Jest style tests, with Jest invoked via `npm run test:jest`.
- Dashboard work frequently touches `neon-operations-wall`, monitor forms, monitor table, and dashboard KPI components.
- Incremental memory updates track transcript mtimes in `.cursor/hooks/state/continual-learning-index.json`.
