import { VERDICT_LABELS, type VerdictClass } from '@/lib/verdict';

const TONE: Record<VerdictClass, string> = {
  REGRESSION: 'badge red',
  IMPROVEMENT: 'badge green',
  NOISE: 'badge grey',
  CHRONIC_RED: 'badge amber',
  LOW_N: 'badge blue',
};

export function VerdictBadge({ verdict, testId = 'verdict-badge' }: { verdict: VerdictClass; testId?: string }) {
  return (
    <span className={TONE[verdict]} data-testid={testId} data-verdict={verdict}>
      {verdict} <small>· {VERDICT_LABELS[verdict]}</small>
    </span>
  );
}

export const fmt = (n: number, dp = 3) => n.toFixed(dp);
