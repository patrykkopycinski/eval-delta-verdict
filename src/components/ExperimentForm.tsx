import type { Experiment } from '@/lib/stores';
import { DEFAULT_THRESHOLDS } from '@/lib/verdict';

export function ExperimentForm({ action, exp, submit }: { action: (f: FormData) => void | Promise<void>; exp?: Experiment; submit: string }) {
  const t = exp?.thresholds ?? DEFAULT_THRESHOLDS;
  return (
    <form action={action} className="stack">
      <label>Display name<input name="name" defaultValue={exp?.name} required /></label>
      <label>Suite (experiment_name in .evaluation-scores*)<input name="experiment_name" defaultValue={exp?.experiment_name} required /></label>
      <label>Description<textarea name="description" defaultValue={exp?.description} rows={3} /></label>
      <h2>Thresholds</h2>
      <label>Effect size threshold (|d| to call a regression/improvement)<input name="effectSizeThreshold" type="number" step="0.05" min="0" defaultValue={t.effectSizeThreshold} /></label>
      <label>Red floor (run mean below this is “red”)<input name="redFloor" type="number" step="0.01" min="0" max="1" defaultValue={t.redFloor} /></label>
      <label>Minimum examples (below → LOW_N)<input name="minExamples" type="number" step="1" min="2" defaultValue={t.minExamples} /></label>
      <button type="submit">{submit}</button>
    </form>
  );
}
