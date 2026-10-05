# Shape Notes — Eval Delta Verdict

Status: SHAPING (module 1 workflow). This file is the living record of decisions and open
questions. Every open question must be answered by Patryk — never assumed by the agent.

## One-liner

A web app where an engineer points at an eval suite and two runs and gets a verdict —
"real regression" vs "noise / chronically red" — with confidence intervals, per model,
backed by Elasticsearch.

## Decided (2026-09-22/23, by Patryk)

- D1. Project = Eval Delta Verdict (course: 10xDevs 4.0). Fallback if it dies: KTH-lite.
- D2. Users = Patryk AND his team. Multi-user from day one (login, shared experiments,
  annotations). Not single-user.
- D3. Verdict engine = deterministic statistics (CI overlap, effect size, saturation,
  chronic-red detection). NO LLM/JEV/Laya in the verdict path.
- D4. Judge seam (trace explanation, JEV/Laya experimental + flag-gated) is IN MVP scope,
  but is the FIRST component to cut if the MVP week slips. Non-negotiable core:
  verdict engine + auth + CRUD + user-perspective test + CI.
- D5. Elastic Stack leverage is a goal, not decoration: ES = system of record, ES|QL for
  aggregation, Kibana viz optional. Stack otherwise open (no obligation to course defaults).
- D6. Do NOT rebuild kibana-test-health-v3 (reference only).
- D7 (2026-10-02): Product vision = autonomous eval-improvement control plane (agents
  monitor/root-cause/propose; human approves → PR, declines → rejection memory). Course MVP
  layering (Option C): verdict engine first (deterministic core, week 1), approval inbox as
  module 2-3 CRUD heart, full autonomy = explicit NON-GOAL for the course MVP (roadmap only).
- D8: D3 holds — no LLM in the verdict path. Agent judgment lives AROUND the verdict engine,
  never inside it.
- D9 (2026-10-02): MVP entry UX = flow 2 "land-on-the-verdict": home page shows newest run per
  watched suite with verdict chips (REAL REGRESSION / NOISE / CHRONICALLY RED / CLEAN),
  comparison pair pre-chosen by app; search box escape hatch (flow 1) lives on the same page.
  Flow 3 (Slack deep links from the alert) = roadmap under D7, NOT MVP. Q-A answered by D9.
- D10 (2026-10-02): Data = ingested snapshots into EDV's own ES index (option 2). Importer
  starts as manual "import run(s)" trigger; scheduled/cron import later; live-query mode = flag,
  later. Rationale: self-contained deploy, simple team auth (Q-E), verdict engine runs on frozen
  data → deterministic + seedable tests (cert element 5). Q-B answered by D10.
- D11 (2026-10-02, REVISED after Slack check): Two-level model — a RUN = one Buildkite build
  (import unit; build number is the human-facing identity, e.g. "Weekly LLM Evals #74"),
  containing CELLS = (suite, model) which are the verdict/streak/CI units (suite slug + eis-
  model slug are the team's actual vocabulary — verified in the team evals channel).
  App-assigned IDs = internal keys; experiment_name = provenance only. Evidence: build #74
  chronic failure (all 6 models, same root cause, 2026-09-12 + 09-14) vs build #66 per-model
  distinct failures — confirms chronic-vs-real is a real distinction. Q-C answered by D11.
- D12 (2026-10-02): Verdict thresholds = fixed defaults in MVP, but stored as seeded rows in ES
  (editable via config/seed only, no UI). Later thresholds-CRUD = UI over existing data, not a
  migration. Q-D answered by D12.
- D13 (2026-10-02): Auth = individual email+password accounts, admin-seeded, no self-
  registration, admin-reset only. Satisfies cert element 1 with named authors for annotations
  and the later approval inbox. SSO rejected as over-engineering; shared password rejected —
  no author identity for rejection memory. Q-E answered by D13.
- D14 (2026-10-02): "Red" = run score below per-suite floor (hard fail folds in as score 0 —
  one rule, no special case). "Chronic" = 3 consecutive red runs, per-suite configurable via
  seeded threshold row (D12). Verdict displays streak length ("red ×5"). Q-F answered by D14.
- D15 (2026-10-02): Judge-seam MVP cutline — cut when ANY holds at end of first MVP weekend:
  (1) any non-negotiable (verdict engine, auth, CRUD, user-perspective test, CI) incomplete or
  red; (2) >~4 after-hours hours estimated remain on non-negotiables; (3) JEV/Laya integration
  cannot stay a thin flag-gated weekend add-on. Mechanical trigger — no fresh decision under
  sunk-cost pressure. Q-G answered by D15. SHAPING COMPLETE (queue empty).

## Rejected options (2026-10-02)

- Switching course project to AMES (agent-memory-es) with a web UI: strong ES fit and alive
  codebase, but agent-infrastructure user ("my agents") is weaker than a human with a decision;
  CRUD/auth would be retrofitted. Keep EDV. (AMES vs KTH-lite as *fallback* ranking: undecided.)
- VP dogfood as course project: internal tool, fuzzy business-logic sentence — weakest fit.

## Open questions (Socratic queue — answer one at a time)

- None. Queue empty since D15 (2026-10-02). D11's Slack-thread check DONE (2026-10-02) —
  revised to run=build / cell=(suite,model); see D11 evidence.

## Certification check (live tracking)

| # | Element | Status | Notes |
|---|---------|--------|-------|
| 1 | Access control | planned | login for team (Q-E) |
| 2 | Domain CRUD | planned | experiments, baselines, thresholds, annotations (Q-D) |
| 3 | One-sentence business logic | ✅ locked | "decides whether a score change between two eval runs is real or noise" |
| 4 | Course artifacts | in progress | this file → PRD → plan, via course workflow |
| 5 | User-perspective test | planned | two runs → expected verdict, seeded data |
| 6 | CI/CD | planned | build + tests from module 1 onward |

MVP rule: first working user flow within ~1 week of after-hours work — otherwise shrink
(judge seam goes first, then Kibana viz, then configurability).

## Evidence base (why this project)

- 50+ projects across 10x2/10x3/10x4 editions: zero dev-tooling/eval competitors.
- a team Slack evals channel: weekly "failed for all 6 models" with no
  regression-vs-chronic distinction (alert fatigue, no noise floor).
- feedback from an internal alerting project: "no way to measure if a change helped."
- GitHub: no incumbent in eval-regression detection; LLM eval dashboards are toy projects.
