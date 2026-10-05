/** CLI: npm run verdict -- <experiment_name> <baselineRunId> <candidateRunId> [model] */
import 'dotenv/config';
import { loadRows } from '../src/lib/scores';
import { compareRuns } from '../src/lib/verdict';

async function main() {
  const [name, b, c, model] = process.argv.slice(2);
  if (!name || !b || !c) throw new Error('usage: verdict <experiment_name> <baseline> <candidate> [model]');
  const rows = await loadRows(name, [b, c]);
  const r = compareRuns({ rows, baselineId: b, candidateId: c, modelFilter: model });
  console.log(JSON.stringify(r, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
