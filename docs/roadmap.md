# Roadmap

MVP (this repo): verdict engine → auth → CRUD + approval inbox → seed/ingest → user-perspective test → CI.

Later, in order:
1. Judge seam (D4): LLM trace explanation for a flagged cell, annotate-only. First thing to cut if scope slips.
2. Kibana visualisations over the same indices (optional, D5).
3. Run history trend + chronic-red detection over N prior runs.

## Non-goal: full autonomy
Autonomous triage/approval (agents acting on verdicts without a human) is **not** in scope (D7).
Agent judgment, if ever added, lives *around* the deterministic engine, never inside it (D8).
