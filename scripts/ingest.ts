/**
 * Load real kbn-evals exports (NDJSON of `.evaluation-scores*` docs) from stdin.
 *   npm run ingest -- --index .evaluation-scores-2026.10 < scores.ndjson
 * Docs are validated against the kbn-evals shape; invalid lines abort the load.
 */
import 'dotenv/config';
import { createInterface } from 'node:readline';
import { config } from '../src/lib/config';
import { ensureIndex, es, SCORES_MAPPING } from '../src/lib/es';
import { parseScoreLine } from '../src/lib/ingest';

async function main() {
  const args = process.argv.slice(2);
  const i = args.indexOf('--index');
  const index = i >= 0 ? args[i + 1] : config.scoresIndex;
  if (!index) throw new Error('--index requires a value');

  await ensureIndex(index, SCORES_MAPPING);
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  let batch: object[] = [];
  let ok = 0;
  let lineNo = 0;
  const flush = async () => {
    if (batch.length === 0) return;
    const res = await es().bulk({ operations: batch, refresh: false });
    if (res.errors) throw new Error('bulk indexing reported errors');
    ok += batch.length / 2;
    batch = [];
  };
  for await (const line of rl) {
    lineNo++;
    if (!line.trim()) continue;
    const parsed = parseScoreLine(line);
    if (!parsed.ok) throw new Error(`line ${lineNo}: ${parsed.error}`);
    batch.push({ index: { _index: index } }, parsed.doc);
    if (batch.length >= 2000) await flush();
  }
  await flush();
  await es().indices.refresh({ index });
  console.log(`ingested ${ok} docs into ${index}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
