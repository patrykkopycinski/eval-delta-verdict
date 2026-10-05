export const config = {
  esUrl: process.env.ELASTICSEARCH_URL ?? 'http://localhost:19200',
  /** Default write target for seed/ingest. */
  scoresIndex: process.env.EDV_SCORES_INDEX ?? '.evaluation-scores-edv',
  /** Read pattern: matches real kbn-evals exports (`.evaluation-scores-2026.10`) too. */
  scoresPattern: process.env.EDV_SCORES_PATTERN ?? '.evaluation-scores*',
  usersIndex: process.env.EDV_USERS_INDEX ?? 'edv-users',
  experimentsIndex: process.env.EDV_EXPERIMENTS_INDEX ?? 'edv-experiments',
  annotationsIndex: process.env.EDV_ANNOTATIONS_INDEX ?? 'edv-annotations',
  sessionSecret: process.env.SESSION_SECRET ?? 'dev-only-change-me',
  /** D4: judge seam is OFF by default. */
  judgeEnabled: process.env.EDV_JUDGE_ENABLED === 'true',
};

export const SESSION_COOKIE = 'edv_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 8;
