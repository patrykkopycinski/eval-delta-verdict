# EDV — Eval Delta Verdict

Point at an eval suite and two runs; get a verdict — **real regression** vs **noise / chronically red** —
with confidence intervals, per model, backed by Elasticsearch. Deterministic statistics only; no LLM in the verdict path.

Data shape is the kbn-evals `.evaluation-scores*` golden shape. Course project (10xDevs 4.0 10xBuilder).

## Run locally
```bash
cp .env.example .env.local   # optional; defaults work
npm install
npm run es:up                # ES 9 on 127.0.0.1:19200, security off (local only)
npm run seed                 # users, experiments, deterministic runs
npm run build && npm start   # http://localhost:3000
```
Seeded logins (dev defaults): `patryk` / `patryk-edv-2026` (admin), `demo` / `demo-edv-2026` (viewer).

Load real kbn-evals exports: `npm run ingest -- --index .evaluation-scores-2026.10 < scores.ndjson`
CLI verdict: `npm run verdict -- agent-builder-core abc-run-02 abc-run-03`

## Test
```bash
npm run lint && npm run typecheck && npm test   # unit (verdict engine, auth, guards)
npm run e2e                                      # Playwright against real ES; needs `npm run build` + es:up
```
CI (`.github/workflows/ci.yml`) runs all of the above with an ephemeral ES 9 service.

See `docs/architecture.md`, `docs/roadmap.md`, `docs/course/README.md`.
