# Eval Delta Verdict (EDV) — build spec v1

Course project for 10xDevs 4.0 10xBuilder. Authoritative decisions: ~/Projects does NOT exist on this VM — shape notes are embedded below. Work dir: /opt/orca-base/work/patryk-eval-delta-verdict-10xbuilder-edv-scaffold-df64 (empty repo, push access via deploy key, repo patrykkopycinski/eval-delta-verdict).

## Product one-liner
Web app where an engineer points at an eval suite and two runs and gets a verdict — "real regression" vs "noise / chronically red" — with confidence intervals, per model, backed by Elasticsearch.

## Locked decisions (do NOT deviate)
- D2 Users = Patryk + team. Multi-user from day one: login, shared experiments, annotations.
- D3 Verdict engine = deterministic statistics (CI overlap, effect size, saturation, chronic-red detection). NO LLM anywhere in the verdict path.
- D4 Judge seam (LLM trace explanation) = flag-gated, OFF by default, FIRST to cut. Non-negotiable core: verdict engine + auth + CRUD + user-perspective test + CI.
- D5 ES = system of record; ES|QL for aggregation; Kibana viz optional.
- D7 MVP layering: verdict engine (week 1) → approval/annotation inbox as CRUD heart. Full autonomy = NON-GOAL (roadmap doc only).
- D9 Home page = "land on the verdict": newest runs with verdict badges.
- Stack: TypeScript, Node 22, Next.js (App Router) or Fastify+React — pick ONE and note why; vitest; Playwright optional for E2E; Docker compose for local ES 9 (single node, security off is fine locally, port 19200 to avoid collisions — bind localhost only).

## Data schema — REUSE kbn-evals golden index shape (alignment requirement)
kbn-evals (Elastic's real eval tooling) persists per-example scores to `.evaluation-scores*` docs with fields: `experiment_name`, `experiment_id`, `example.id`, `task.repetition_index`, `evaluator.name`, `evaluator.score`, `evaluator_model.id`, `task_model.id`. EDV ingests EXACTLY this doc shape into its own ES cluster (seed loader can synthesize realistic runs; also provide `npm run ingest -- --index .evaluation-scores-2026.10 < ndjson` to load real exports). Verdict queries use ES|QL over these docs.
Also mirror kbn-evals judge-agreement semantics in the engine: cells with a single judge model are excluded from agreement stats; per-example scores averaged within judge before cross-judge agreement. Cite this in docs/comments as "aligned with @kbn/evals judge_agreement".

## Verdict engine (deterministic, pure functions, fully unit-tested)
Input: two experiment runs (baseline vs candidate) for one experiment_name + optional model filter.
- Per-evaluator mean score per run; bootstrap or normal-approx 95% CI (n≥30 → normal; below → exact note "low n").
- Verdicts: REGRESSION (CI separation + effect size ≥ threshold), IMPROVEMENT (mirror), NOISE (CIs overlap), CHRONIC_RED (both runs below suite-defined floor AND verdict NOISE — i.e., red but not changed), LOW_N (insufficient examples).
- Effect size: Cohen's d on per-example paired scores where example ids intersect; unpaired fallback with note.
- All thresholds configurable per experiment (stored in ES, editable in UI = part of CRUD).

## Certification criteria mapping (all six MUST be real)
1. Access control: login (username/password, argon2, session cookie; seed 2 users: patryk/admin, demo/viewer roles).
2. CRUD: experiments (create/edit/delete), threshold settings, annotations on verdicts (add/edit/delete), runs list (read). Approval inbox (D7) = annotation workflow with status approve/decline.
3. Business logic one-liner (above) — implemented as the verdict engine.
4. Course artifacts: create docs/ artifacts dir placeholders README pointing to course platform (do NOT fabricate PRDs).
5. ≥1 user-perspective test: Playwright (or vitest browser) test: "engineer logs in, selects two runs of a seeded experiment, sees verdict REGRESSION with CI" — must actually pass.
6. CI: GitHub Actions — lint, typecheck, unit tests, build, the user-perspective test against ephemeral ES in the job (services or docker run).

## Process
- Update /tmp/edv-progress.log after each milestone. Real git history, real pushes. Never fabricate output; log failures and work around.
- MVP week rule: verdict engine + auth + one flow working end-to-end FIRST, then breadth.
- When done: print EVIDENCE_URLS: repo URL + passing CI run URL + local test output summary.

## Embedded shape decisions (context, do not re-open)
D6 do not rebuild kibana-test-health-v3. D8 agent judgment lives AROUND the engine, never inside — out of MVP scope.
