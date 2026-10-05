import 'server-only';
import { randomUUID } from 'node:crypto';
import { config } from './config';
import { es } from './es';
import { DEFAULT_THRESHOLDS, type Thresholds, type VerdictClass } from './verdict';

export interface Experiment {
  id: string;
  name: string;
  experiment_name: string;
  description: string;
  owner: string;
  thresholds: Thresholds;
  created_at: string;
  updated_at: string;
}

type Src<T> = Omit<T, 'id'>;

export async function listExperiments(): Promise<Experiment[]> {
  const r = await es().search<Src<Experiment>>({
    index: config.experimentsIndex,
    size: 200,
    sort: [{ name: 'asc' }],
    query: { match_all: {} },
  });
  return r.hits.hits.map((h) => ({ id: h._id as string, ...(h._source as Src<Experiment>) }));
}

export async function getExperiment(id: string): Promise<Experiment | null> {
  try {
    const r = await es().get<Src<Experiment>>({ index: config.experimentsIndex, id });
    return { id: r._id, ...(r._source as Src<Experiment>) };
  } catch {
    return null;
  }
}

export interface ExperimentInput {
  name: string;
  experiment_name: string;
  description: string;
  thresholds: Thresholds;
}

export async function createExperiment(input: ExperimentInput, owner: string): Promise<string> {
  const now = new Date().toISOString();
  const id = randomUUID();
  await es().index({
    index: config.experimentsIndex,
    id,
    refresh: 'wait_for',
    document: { ...input, owner, created_at: now, updated_at: now },
  });
  return id;
}

export async function updateExperiment(id: string, input: ExperimentInput): Promise<void> {
  await es().update({
    index: config.experimentsIndex,
    id,
    refresh: 'wait_for',
    doc: { ...input, updated_at: new Date().toISOString() },
  });
}

export async function deleteExperiment(id: string): Promise<void> {
  await es().delete({ index: config.experimentsIndex, id, refresh: 'wait_for' }).catch(() => undefined);
  await es().deleteByQuery({
    index: config.annotationsIndex,
    query: { term: { experiment_id: id } },
    refresh: true,
    conflicts: 'proceed',
  });
}

export type AnnotationStatus = 'pending' | 'approved' | 'declined';

export interface Annotation {
  id: string;
  experiment_id: string;
  baseline_run: string;
  candidate_run: string;
  verdict: VerdictClass;
  text: string;
  status: AnnotationStatus;
  author: string;
  reviewed_by?: string;
  created_at: string;
  updated_at: string;
}

export async function listAnnotations(filter: { experimentId?: string; status?: AnnotationStatus } = {}): Promise<Annotation[]> {
  const must: object[] = [];
  if (filter.experimentId) must.push({ term: { experiment_id: filter.experimentId } });
  if (filter.status) must.push({ term: { status: filter.status } });
  const r = await es().search<Src<Annotation>>({
    index: config.annotationsIndex,
    size: 500,
    sort: [{ created_at: 'desc' }],
    query: must.length ? { bool: { must } } : { match_all: {} },
  });
  return r.hits.hits.map((h) => ({ id: h._id as string, ...(h._source as Src<Annotation>) }));
}

export async function getAnnotation(id: string): Promise<Annotation | null> {
  try {
    const r = await es().get<Src<Annotation>>({ index: config.annotationsIndex, id });
    return { id: r._id, ...(r._source as Src<Annotation>) };
  } catch {
    return null;
  }
}

export async function createAnnotation(
  a: Pick<Annotation, 'experiment_id' | 'baseline_run' | 'candidate_run' | 'verdict' | 'text'>,
  author: string,
): Promise<string> {
  const now = new Date().toISOString();
  const id = randomUUID();
  await es().index({
    index: config.annotationsIndex,
    id,
    refresh: 'wait_for',
    document: { ...a, status: 'pending', author, created_at: now, updated_at: now },
  });
  return id;
}

export async function updateAnnotationText(id: string, text: string): Promise<void> {
  await es().update({
    index: config.annotationsIndex,
    id,
    refresh: 'wait_for',
    doc: { text, status: 'pending', reviewed_by: null, updated_at: new Date().toISOString() },
  });
}

export async function reviewAnnotation(id: string, status: 'approved' | 'declined', reviewer: string): Promise<void> {
  await es().update({
    index: config.annotationsIndex,
    id,
    refresh: 'wait_for',
    doc: { status, reviewed_by: reviewer, updated_at: new Date().toISOString() },
  });
}

export async function deleteAnnotation(id: string): Promise<void> {
  await es().delete({ index: config.annotationsIndex, id, refresh: 'wait_for' }).catch(() => undefined);
}

export function parseThresholds(get: (k: string) => string | null): Thresholds {
  const num = (k: string, d: number, min: number, max: number) => {
    const v = Number(get(k));
    return Number.isFinite(v) && get(k) !== '' && get(k) !== null ? Math.min(max, Math.max(min, v)) : d;
  };
  return {
    effectSizeThreshold: num('effectSizeThreshold', DEFAULT_THRESHOLDS.effectSizeThreshold, 0, 100),
    redFloor: num('redFloor', DEFAULT_THRESHOLDS.redFloor, 0, 1),
    minExamples: Math.round(num('minExamples', DEFAULT_THRESHOLDS.minExamples, 2, 100000)),
  };
}
