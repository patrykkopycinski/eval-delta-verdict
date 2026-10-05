import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { listExperiments } from '@/lib/stores';
import { can } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export default async function Experiments() {
  const s = await requireSession();
  const list = await listExperiments();
  return (
    <>
      <div className="row"><h1 style={{ flex: 1 }}>Experiments</h1>
        {can(s.r, 'experiment:write') && <Link href="/experiments/new"><button>New experiment</button></Link>}
      </div>
      <table data-testid="experiments-table">
        <thead><tr><th>Name</th><th>Suite (experiment_name)</th><th>Owner</th><th>Effect ≥</th><th>Red floor</th><th>Min n</th></tr></thead>
        <tbody>
          {list.map((e) => (
            <tr key={e.id} data-testid="experiment-row">
              <td><Link href={`/experiments/${e.id}`}>{e.name}</Link></td>
              <td>{e.experiment_name}</td><td>{e.owner}</td>
              <td>{e.thresholds.effectSizeThreshold}</td><td>{e.thresholds.redFloor}</td><td>{e.thresholds.minExamples}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
