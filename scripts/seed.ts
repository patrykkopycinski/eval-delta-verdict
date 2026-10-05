/** Seed users, experiments and synthetic kbn-evals score docs. Idempotent. */
import 'dotenv/config';
import argon2 from 'argon2';
import { config } from '../src/lib/config';
import { ensureAllIndices, es } from '../src/lib/es';
import { generateRun, SEED_EXPERIMENTS, seedRuns } from '../src/lib/seed-data';

export const SEED_USERS = [
  { username: 'patryk', role: 'admin', password: process.env.EDV_SEED_ADMIN_PASSWORD ?? 'patryk-edv-2026' },
  { username: 'demo', role: 'viewer', password: process.env.EDV_SEED_VIEWER_PASSWORD ?? 'demo-edv-2026' },
] as const;

async function main() {
  await ensureAllIndices();
  const now = new Date().toISOString();

  for (const u of SEED_USERS) {
    await es().index({
      index: config.usersIndex,
      id: u.username,
      document: {
        username: u.username,
        role: u.role,
        password_hash: await argon2.hash(u.password),
        created_at: now,
      },
    });
  }

  for (const e of SEED_EXPERIMENTS) {
    await es().index({
      index: config.experimentsIndex,
      id: e.id,
      document: {
        name: e.name,
        experiment_name: e.experiment_name,
        description: e.description,
        owner: 'patryk',
        thresholds: e.thresholds,
        created_at: now,
        updated_at: now,
      },
    });
  }

  // Replace seeded runs wholesale so reseeding never duplicates docs.
  const runs = seedRuns();
  await es().deleteByQuery({
    index: config.scoresIndex,
    query: { terms: { experiment_id: runs.map((r) => r.experiment_id) } },
    refresh: true,
    conflicts: 'proceed',
  });
  let total = 0;
  for (const run of runs) {
    const docs = generateRun(run);
    const operations = docs.flatMap((d) => [{ index: { _index: config.scoresIndex } }, d]);
    const res = await es().bulk({ operations, refresh: true });
    if (res.errors) throw new Error(`bulk errors seeding ${run.experiment_id}`);
    total += docs.length;
  }
  console.log(`seeded: ${SEED_USERS.length} users, ${SEED_EXPERIMENTS.length} experiments, ${runs.length} runs, ${total} score docs -> ${config.scoresIndex}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
