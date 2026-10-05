import { describe, expect, it } from 'vitest';
import argon2 from 'argon2';
import { createSessionToken, verifySessionToken } from '@/lib/session';
import { can } from '@/lib/permissions';
import { parseScoreLine } from '@/lib/ingest';
import { generateRun, seedRuns } from '@/lib/seed-data';
import { aggregateDocs } from '@/lib/verdict';

const SECRET = 'test-secret';

describe('session token', () => {
  const user = { username: 'patryk', role: 'admin' as const };
  it('round-trips', () => {
    const t = createSessionToken(user, SECRET, 60, 1000);
    expect(verifySessionToken(t, SECRET, 1001)).toEqual({ u: 'patryk', r: 'admin', exp: 1060 });
  });
  it('rejects expiry, wrong secret, tampering, garbage', () => {
    const t = createSessionToken(user, SECRET, 60, 1000);
    expect(verifySessionToken(t, SECRET, 1060)).toBeNull();
    expect(verifySessionToken(t, 'other', 1001)).toBeNull();
    const [p, s] = t.split('.');
    const forged = Buffer.from(JSON.stringify({ u: 'demo', r: 'admin', exp: 9999999999 })).toString('base64url');
    expect(verifySessionToken(`${forged}.${s}`, SECRET, 1001)).toBeNull();
    expect(verifySessionToken(`${p}.x`, SECRET, 1001)).toBeNull();
    expect(verifySessionToken(undefined, SECRET)).toBeNull();
    expect(verifySessionToken('a.b.c', SECRET)).toBeNull();
  });
});

describe('permissions', () => {
  it('admin can do everything', () => {
    for (const a of ['experiment:write', 'annotation:create', 'annotation:edit', 'annotation:delete', 'annotation:review'] as const)
      expect(can('admin', a)).toBe(true);
  });
  it('viewer cannot write experiments or review, can annotate, edits only own', () => {
    expect(can('viewer', 'experiment:write')).toBe(false);
    expect(can('viewer', 'annotation:review')).toBe(false);
    expect(can('viewer', 'annotation:create')).toBe(true);
    expect(can('viewer', 'annotation:edit', { owner: 'demo', user: 'demo' })).toBe(true);
    expect(can('viewer', 'annotation:edit', { owner: 'patryk', user: 'demo' })).toBe(false);
    expect(can('viewer', 'annotation:delete', { user: 'demo' })).toBe(false);
  });
});

describe('argon2', () => {
  it('hashes and verifies', async () => {
    const h = await argon2.hash('pw');
    expect(h.startsWith('$argon2')).toBe(true);
    expect(await argon2.verify(h, 'pw')).toBe(true);
    expect(await argon2.verify(h, 'nope')).toBe(false);
  });
});

describe('ingest validation', () => {
  const good = JSON.stringify(generateRun({ ...seedRuns()[0], examples: 1, repetitions: 1, judges: ['j'] })[0]);
  it('accepts kbn-evals shape', () => {
    expect(parseScoreLine(good).ok).toBe(true);
  });
  it('rejects bad JSON and missing fields', () => {
    expect(parseScoreLine('{').ok).toBe(false);
    const bad = JSON.parse(good);
    delete bad.evaluator_model;
    const r = parseScoreLine(JSON.stringify(bad));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/evaluator_model/);
  });
});

describe('seed data', () => {
  it('is deterministic and kbn-evals shaped', () => {
    const a = generateRun(seedRuns()[0]);
    const b = generateRun(seedRuns()[0]);
    expect(a).toEqual(b);
    expect(a[0]).toHaveProperty('evaluator.score');
    expect(a[0]).toHaveProperty('task.repetition_index');
  });
  it('aggregation collapses repetitions', () => {
    const docs = generateRun(seedRuns()[0]);
    expect(aggregateDocs(docs).length).toBe(docs.length / 2); // 2 repetitions
  });
});
