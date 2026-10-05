# Architecture

**Stack: Next.js 15 (App Router) + TypeScript, Node >= 22.** One deployable, server components +
server actions give auth, CRUD and the verdict UI without a separate API layer and keep
the secrets/ES client server-side. (Fastify+React would add a second package and an API contract
for no gain at this size.) Local Node may be newer than 22; CI pins 22.

```
ES 9 (system of record, D5)
 ├─ .evaluation-scores*   kbn-evals golden shape (ingested as-is)
 ├─ edv-users / edv-experiments (thresholds) / edv-annotations
Next.js server ──ES|QL──> per-(run,model,evaluator,judge,example) AVG(score)
        │
        └─> src/lib/verdict (pure TS, deterministic, D3)  ──> UI badges + CIs
```

## Data schema
EDV ingests exactly the kbn-evals `.evaluation-scores*` doc: `experiment_name`, `experiment_id`,
`example.id`, `task.repetition_index`, `evaluator.name`, `evaluator.score`, `evaluator_model.id`,
`task_model.id` (+ optional `@timestamp`). `npm run ingest -- --index .evaluation-scores-2026.10 < x.ndjson`
validates and loads real exports; `npm run seed` synthesizes deterministic runs. Reads use the pattern
`.evaluation-scores*`, so real and seeded indices are both visible.

## Verdict engine (`src/lib/verdict`)
Pure functions; no I/O, clock, randomness or LLM (enforced by `tests/unit/guards.test.ts`).
Per (task model, evaluator) cell:

1. Repetitions are averaged within a judge (ES|QL `STATS AVG` by judge+example), then judges are
   averaged per example — aligned with @kbn/evals judge_agreement. Cells with a single judge model are
   excluded from agreement stats (shown as n/a) but still feed the verdict.
2. 95% CI of the per-example mean: Student-t for n < 30 (noted "low n"), normal (1.96) for n >= 30.
3. Effect size: paired d_z over shared example ids; unpaired pooled Cohen's d fallback with a note.
   Capped at ±100 when the variance is zero.
4. Verdict: `LOW_N` (n < minExamples) → `REGRESSION`/`IMPROVEMENT` (CIs disjoint AND |d| >= threshold)
   → otherwise `NOISE`, upgraded to `CHRONIC_RED` when both runs are below the red floor.
5. Roll-up per model and overall: REGRESSION > IMPROVEMENT > CHRONIC_RED > NOISE; LOW_N ignored when
   anything is conclusive.

Thresholds (`effectSizeThreshold`, `redFloor`, `minExamples`) are per experiment, stored in ES, edited in the UI.

## Auth / roles
Username+password (argon2id), HMAC-signed httpOnly session cookie, middleware redirect + server-side
verification on every page/action. `admin` (patryk): all. `viewer` (demo): read, propose annotations
(pending), edit/delete own. Approve/decline = admin only (the D7 inbox).

## Judge seam (D4)
`src/lib/judge.ts`, behind `EDV_JUDGE_ENABLED` (default off, no network when off). Not imported by the
verdict engine and not wired into the UI in the MVP.

## Not done / honest limits
- Verdict is computed on request (no caching); fine for seeded/real exports of this size.
- The home page judges each run against the previous run of the same `experiment_name`.
- Seed passwords are dev defaults; override `EDV_SEED_*_PASSWORD` and `SESSION_SECRET` anywhere real.
