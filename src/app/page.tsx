import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { newestRunVerdicts } from '@/lib/home';
import { VerdictBadge } from '@/components/Badge';

export const dynamic = 'force-dynamic';

/** D9: land on the verdict — newest runs, each with a verdict badge vs its predecessor. */
export default async function Home() {
  await requireSession();
  const items = await newestRunVerdicts();
  return (
    <>
      <h1>Latest verdicts</h1>
      <p className="mut">Each run is judged against the previous run of the same suite. Deterministic statistics only — no LLM in the verdict path.</p>
      {items.length === 0 ? (
        <div className="card">No runs yet. Run <code>npm run seed</code> or <code>npm run ingest</code>.</div>
      ) : (
        <table data-testid="latest-runs">
          <thead><tr><th>Suite</th><th>Run</th><th>Started</th><th>vs</th><th>Verdict</th></tr></thead>
          <tbody>
            {items.map(({ run, baseline, result, experimentId }) => {
              const href = experimentId && baseline
                ? `/experiments/${experimentId}?baseline=${encodeURIComponent(baseline.experiment_id)}&candidate=${encodeURIComponent(run.experiment_id)}`
                : experimentId ? `/experiments/${experimentId}` : null;
              return (
                <tr key={run.experiment_id} data-testid="run-row" data-run={run.experiment_id}>
                  <td>{run.experiment_name}</td>
                  <td>{href ? <Link href={href}>{run.experiment_id}</Link> : run.experiment_id}</td>
                  <td className="mut">{run.started.slice(0, 16).replace('T', ' ')}</td>
                  <td className="mut">{baseline?.experiment_id ?? '—'}</td>
                  <td>{result ? <VerdictBadge verdict={result.verdict} testId="home-verdict" /> : <span className="mut">first run — no baseline</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
