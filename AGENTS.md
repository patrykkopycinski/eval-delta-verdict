# AGENTS.md — AI context for eval-delta-verdict

Deterministic eval-delta verdict engine: compares two evaluation runs and returns
REGRESSION / IMPROVEMENT / NOISE / CHRONIC_RED / LOW_N with confidence intervals
and effect sizes. Elasticsearch 9 is the system of record; stats live in
`src/lib/verdict/` (pure, no I/O, no LLM in the verdict path).

## Invariants (do not break)

1. Verdict path is deterministic statistics only — the judge seam
   (`src/lib/judge.ts`, D4) is flag-gated, OFF by default, never consulted for
   verdicts.
2. Scores are read from `.evaluation-scores*` indices via ES|QL aggregations
   (`src/lib/scores.ts`); kbn-evals field alignment is deliberate.
3. REGRESSION requires BOTH disjoint CIs and |effect size| >= threshold
   (default 0.5); anything else with adequate n is NOISE (see
   `tests/unit/verdict.test.ts` boundary test).
4. Auth: individual accounts, argon2 + HMAC cookie session, admin/viewer roles;
   no self-registration.

## Conventions

- Conventional commits; identity Patryk Kopycinski <contact@patrykkopycinski.com>.
- Tests: vitest unit (`tests/unit`) + Playwright user-perspective e2e
  (`tests/e2e`) against a real ES9 service container.
- CI must stay green on main; no force-push.
