import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { getExperiment, listAnnotations } from '@/lib/stores';
import { listRuns, loadRows } from '@/lib/scores';
import { compareRuns, type CellVerdict } from '@/lib/verdict';
import { can } from '@/lib/permissions';
import { VerdictBadge, fmt } from '@/components/Badge';
import { AnnotationItem } from '@/components/AnnotationItem';
import { addAnnotationAction, deleteExperimentAction } from '../../actions';

export const dynamic = 'force-dynamic';

function CiBar({ c }: { c: CellVerdict }) {
  const pct = (x: number) => `${Math.max(0, Math.min(1, x)) * 100}%`;
  const seg = (lo: number, hi: number) => ({ left: pct(lo), width: `${Math.max(0.5, (Math.min(1, hi) - Math.max(0, lo)) * 100)}%` });
  return (
    <div className="bar" aria-hidden>
      <i className="b" style={seg(c.baseline.ciLow, c.baseline.ciHigh)} />
      <i className="c" style={{ ...seg(c.candidate.ciLow, c.candidate.ciHigh), top: 0 }} />
    </div>
  );
}

export default async function ExperimentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ baseline?: string; candidate?: string; model?: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const sp = await searchParams;
  const exp = await getExperiment(id);
  if (!exp) notFound();

  const runs = await listRuns(exp.experiment_name);
  const baselineId = sp.baseline && runs.some((r) => r.experiment_id === sp.baseline) ? sp.baseline : undefined;
  const candidateId = sp.candidate && runs.some((r) => r.experiment_id === sp.candidate) ? sp.candidate : undefined;
  const selected = baselineId && candidateId && baselineId !== candidateId;

  const result = selected
    ? compareRuns({
        rows: await loadRows(exp.experiment_name, [baselineId, candidateId]),
        baselineId,
        candidateId,
        thresholds: exp.thresholds,
        modelFilter: sp.model || undefined,
      })
    : null;
  const annotations = await listAnnotations({ experimentId: id });
  const here = `/experiments/${id}?baseline=${baselineId ?? ''}&candidate=${candidateId ?? ''}`;
  const allModels = result ? result.models.map((m) => m.taskModel) : [];

  return (
    <>
      <div className="row">
        <h1 style={{ flex: 1 }}>{exp.name}</h1>
        {can(session.r, 'experiment:write') && (
          <>
            <Link href={`/experiments/${id}/edit`}><button>Edit / thresholds</button></Link>
            <form action={deleteExperimentAction.bind(null, id)}><button className="danger" type="submit">Delete</button></form>
          </>
        )}
      </div>
      <p className="mut">{exp.description} · suite <code>{exp.experiment_name}</code> · owner {exp.owner}</p>

      <div className="card">
        <form method="get" className="row" data-testid="run-picker">
          <label>Baseline run
            <select name="baseline" defaultValue={baselineId ?? ''} data-testid="baseline-select">
              <option value="">— select —</option>
              {runs.map((r) => <option key={r.experiment_id} value={r.experiment_id}>{r.experiment_id} · {r.started.slice(0, 10)}</option>)}
            </select>
          </label>
          <label>Candidate run
            <select name="candidate" defaultValue={candidateId ?? ''} data-testid="candidate-select">
              <option value="">— select —</option>
              {runs.map((r) => <option key={r.experiment_id} value={r.experiment_id}>{r.experiment_id} · {r.started.slice(0, 10)}</option>)}
            </select>
          </label>
          <label>Model filter<input name="model" defaultValue={sp.model ?? ''} placeholder="all models" /></label>
          <button type="submit" data-testid="compare">Compare</button>
        </form>
      </div>

      {!result && <p className="mut">Select two runs to get a verdict.</p>}
      {result && (
        <section data-testid="verdict-panel">
          <div className="verdict-hero">
            <VerdictBadge verdict={result.verdict} testId="overall-verdict" />
            <span className="mut">{baselineId} → {candidateId}</span>
          </div>
          {result.models.map((m) => (
            <div className="card" key={m.taskModel} data-testid="model-card" data-model={m.taskModel}>
              <div className="row"><strong>{m.taskModel}</strong><VerdictBadge verdict={m.verdict} testId="model-verdict" /></div>
              <table>
                <thead><tr><th>Evaluator</th><th>Verdict</th><th>Baseline mean [95% CI]</th><th>Candidate mean [95% CI]</th><th>Δ</th><th>Effect d</th><th>CI</th><th>Judge agr.</th></tr></thead>
                <tbody>
                  {m.cells.map((c) => (
                    <tr key={c.evaluator} data-testid="cell-row" data-evaluator={c.evaluator} data-verdict={c.verdict}>
                      <td>{c.evaluator}</td>
                      <td><VerdictBadge verdict={c.verdict} testId="cell-verdict" /></td>
                      <td className="ci" data-testid="baseline-ci">{fmt(c.baseline.mean)} [{fmt(c.baseline.ciLow)}, {fmt(c.baseline.ciHigh)}] <span className="mut">n={c.baseline.n}</span></td>
                      <td className="ci" data-testid="candidate-ci">{fmt(c.candidate.mean)} [{fmt(c.candidate.ciLow)}, {fmt(c.candidate.ciHigh)}] <span className="mut">n={c.candidate.n}</span></td>
                      <td className="ci">{c.delta >= 0 ? '+' : ''}{fmt(c.delta)}</td>
                      <td className="ci">{fmt(c.effectSize, 2)} <span className="mut">{c.effectMode}</span></td>
                      <td><CiBar c={c} /></td>
                      <td className="ci">{c.judgeAgreement.baseline === null ? <span className="mut">n/a (1 judge)</span> : fmt(c.judgeAgreement.candidate ?? c.judgeAgreement.baseline, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {m.cells.flatMap((c) => c.notes.map((n) => `${c.evaluator}: ${n}`)).map((n) => <div className="mut" key={n}>• {n}</div>)}
            </div>
          ))}
          {allModels.length > 0 && (
            <div className="card">
              <h2 style={{ marginTop: 0 }}>Annotate this verdict</h2>
              <form action={addAnnotationAction.bind(null, id)} className="stack">
                <input type="hidden" name="baseline" value={baselineId} />
                <input type="hidden" name="candidate" value={candidateId} />
                <input type="hidden" name="verdict" value={result.verdict} />
                <label>Note<textarea name="text" rows={2} required data-testid="annotation-input" /></label>
                <button type="submit" data-testid="annotation-submit">Add annotation (goes to inbox as pending)</button>
              </form>
            </div>
          )}
        </section>
      )}

      <h2>Annotations ({annotations.length})</h2>
      {annotations.map((a) => <AnnotationItem key={a.id} a={a} session={session} back={here} />)}
    </>
  );
}
