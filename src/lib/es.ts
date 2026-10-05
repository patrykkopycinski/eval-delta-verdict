import { Client } from '@elastic/elasticsearch';
import { config } from './config';

const g = globalThis as unknown as { __edvEs?: Client };

export function es(): Client {
  if (!g.__edvEs) g.__edvEs = new Client({ node: config.esUrl });
  return g.__edvEs;
}

/** Mapping for kbn-evals `.evaluation-scores*` docs (exact field names). */
export const SCORES_MAPPING = {
  properties: {
    '@timestamp': { type: 'date' },
    experiment_name: { type: 'keyword' },
    experiment_id: { type: 'keyword' },
    example: { properties: { id: { type: 'keyword' } } },
    task: { properties: { repetition_index: { type: 'integer' } } },
    evaluator: { properties: { name: { type: 'keyword' }, score: { type: 'double' } } },
    evaluator_model: { properties: { id: { type: 'keyword' } } },
    task_model: { properties: { id: { type: 'keyword' } } },
  },
};

const USERS_MAPPING = {
  properties: {
    username: { type: 'keyword' },
    role: { type: 'keyword' },
    password_hash: { type: 'keyword', index: false },
    created_at: { type: 'date' },
  },
};

const EXPERIMENTS_MAPPING = {
  properties: {
    name: { type: 'keyword' },
    description: { type: 'text' },
    owner: { type: 'keyword' },
    thresholds: {
      properties: {
        effectSizeThreshold: { type: 'double' },
        redFloor: { type: 'double' },
        minExamples: { type: 'integer' },
      },
    },
    created_at: { type: 'date' },
    updated_at: { type: 'date' },
  },
};

const ANNOTATIONS_MAPPING = {
  properties: {
    experiment_name: { type: 'keyword' },
    baseline_run: { type: 'keyword' },
    candidate_run: { type: 'keyword' },
    verdict: { type: 'keyword' },
    text: { type: 'text' },
    status: { type: 'keyword' },
    author: { type: 'keyword' },
    reviewed_by: { type: 'keyword' },
    created_at: { type: 'date' },
    updated_at: { type: 'date' },
  },
};

export async function ensureIndex(index: string, mappings: object): Promise<void> {
  const exists = await es().indices.exists({ index });
  if (exists) return;
  try {
    await es().indices.create({ index, mappings: mappings as never });
  } catch (e) {
    const type = (e as { meta?: { body?: { error?: { type?: string } } } })?.meta?.body?.error?.type;
    if (type !== 'resource_already_exists_exception') throw e;
  }
}

export async function ensureAllIndices(): Promise<void> {
  await ensureIndex(config.scoresIndex, SCORES_MAPPING);
  await ensureIndex(config.usersIndex, USERS_MAPPING);
  await ensureIndex(config.experimentsIndex, EXPERIMENTS_MAPPING);
  await ensureIndex(config.annotationsIndex, ANNOTATIONS_MAPPING);
}
