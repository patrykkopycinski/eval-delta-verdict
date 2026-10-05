/** Pure descriptive statistics. No I/O, no randomness. */
import type { RunStats } from './types';

export const NORMAL_Z_95 = 1.96;
/** n >= this uses the normal approximation; below it we use Student t and flag "low n". */
export const NORMAL_MIN_N = 30;

/** Two-sided 95% Student t critical values, df = 1..29. */
const T_975: readonly number[] = [
  12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16,
  2.145, 2.131, 2.12, 2.11, 2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052,
  2.048, 2.045,
];

export function mean(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

/** Sample standard deviation (n-1). 0 when n < 2. */
export function sd(xs: readonly number[], m: number = mean(xs)): number {
  if (xs.length < 2) return 0;
  let acc = 0;
  for (const x of xs) acc += (x - m) ** 2;
  return Math.sqrt(acc / (xs.length - 1));
}

export function criticalValue(n: number): { value: number; method: RunStats['ciMethod'] } {
  if (n < 2) return { value: 0, method: 'none' };
  if (n >= NORMAL_MIN_N) return { value: NORMAL_Z_95, method: 'normal' };
  return { value: T_975[n - 2], method: 't' };
}

export function runStats(xs: readonly number[]): RunStats {
  const n = xs.length;
  const m = mean(xs);
  const s = sd(xs, m);
  const { value, method } = criticalValue(n);
  const hw = n < 2 ? 0 : (value * s) / Math.sqrt(n);
  return { n, mean: m, sd: s, ciLow: m - hw, ciHigh: m + hw, ciMethod: method };
}

/** CI separation: the two intervals do not intersect. Point intervals: unequal means separate. */
export function ciSeparated(a: RunStats, b: RunStats): boolean {
  if (a.n === 0 || b.n === 0) return false;
  return a.ciHigh < b.ciLow || b.ciHigh < a.ciLow;
}

/** Cap used when the standard deviation is 0 but the means differ (d would be infinite). */
export const EFFECT_CAP = 100;

function capped(delta: number, denom: number): number {
  if (denom === 0) return delta === 0 ? 0 : delta > 0 ? EFFECT_CAP : -EFFECT_CAP;
  return Math.max(-EFFECT_CAP, Math.min(EFFECT_CAP, delta / denom));
}

/** Paired effect size d_z = mean(diff) / sd(diff). */
export function pairedEffect(diffs: readonly number[]): number {
  const m = mean(diffs);
  return capped(m, sd(diffs, m));
}

/** Unpaired pooled Cohen's d (candidate - baseline). */
export function pooledEffect(b: RunStats, c: RunStats): number {
  const dof = b.n + c.n - 2;
  if (dof <= 0) return 0;
  const pooled = Math.sqrt(((b.n - 1) * b.sd ** 2 + (c.n - 1) * c.sd ** 2) / dof);
  return capped(c.mean - b.mean, pooled);
}
