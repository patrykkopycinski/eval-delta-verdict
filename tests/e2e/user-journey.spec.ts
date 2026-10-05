import { expect, test, type Page } from '@playwright/test';

const ADMIN = { u: 'patryk', p: process.env.EDV_SEED_ADMIN_PASSWORD ?? 'patryk-edv-2026' };
const VIEWER = { u: 'demo', p: process.env.EDV_SEED_VIEWER_PASSWORD ?? 'demo-edv-2026' };

async function login(page: Page, who: { u: string; p: string }) {
  await page.goto('/login');
  await page.getByLabel('Username').fill(who.u);
  await page.getByLabel('Password').fill(who.p);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByTestId('whoami')).toContainText(who.u);
}

test('anonymous users are sent to login; bad password is rejected', async ({ page }) => {
  await page.goto('/experiments');
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel('Username').fill(ADMIN.u);
  await page.getByLabel('Password').fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Invalid username or password')).toBeVisible();
});

// Spec criterion 5: "engineer logs in, selects two runs of a seeded experiment,
// sees verdict REGRESSION with CI".
test('engineer logs in, selects two runs, sees REGRESSION with CI', async ({ page }) => {
  await login(page, ADMIN);

  // D9: home page lands on the verdict — newest runs carry badges.
  await expect(page.getByTestId('latest-runs')).toBeVisible();
  const regressRow = page.locator('[data-testid=run-row][data-run="abc-run-03"]');
  await expect(regressRow.getByTestId('home-verdict')).toHaveAttribute('data-verdict', 'REGRESSION');

  await page.goto('/experiments');
  await page.getByRole('link', { name: 'Agent Builder core' }).click();

  await page.getByTestId('baseline-select').selectOption('abc-run-02');
  await page.getByTestId('candidate-select').selectOption('abc-run-03');
  await page.getByTestId('compare').click();

  await expect(page.getByTestId('overall-verdict')).toHaveAttribute('data-verdict', 'REGRESSION');

  // Per model: model-b regressed on correctness, model-a is noise.
  const modelB = page.locator('[data-testid=model-card][data-model="model-b"]');
  await expect(modelB.getByTestId('model-verdict')).toHaveAttribute('data-verdict', 'REGRESSION');
  const correctness = modelB.locator('[data-testid=cell-row][data-evaluator="correctness"]');
  await expect(correctness).toHaveAttribute('data-verdict', 'REGRESSION');
  // CI is rendered as "mean [low, high]" for both runs.
  await expect(correctness.getByTestId('baseline-ci')).toContainText(/\d\.\d{3} \[\d\.\d{3}, \d\.\d{3}\]/);
  await expect(correctness.getByTestId('candidate-ci')).toContainText(/\d\.\d{3} \[\d\.\d{3}, \d\.\d{3}\]/);

  const modelA = page.locator('[data-testid=model-card][data-model="model-a"]');
  await expect(modelA.getByTestId('model-verdict')).toHaveAttribute('data-verdict', 'NOISE');
});

test('chronically red suite is not reported as a regression', async ({ page }) => {
  await login(page, ADMIN);
  const row = page.locator('[data-testid=run-row][data-run="esql-run-02"]');
  await expect(row.getByTestId('home-verdict')).toHaveAttribute('data-verdict', 'CHRONIC_RED');
});

test('CRUD: admin creates, edits thresholds, deletes an experiment', async ({ page }) => {
  await login(page, ADMIN);
  const name = `E2E exp ${Date.now()}`;
  await page.goto('/experiments/new');
  await page.getByLabel('Display name').fill(name);
  await page.getByLabel(/Suite \(experiment_name/).fill('agent-builder-core');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();

  await page.getByRole('button', { name: 'Edit / thresholds' }).click();
  await page.getByLabel(/Effect size threshold/).fill('1.5');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/experiments\/[0-9a-f-]{36}$/);
  await page.goto('/experiments');
  const row = page.getByTestId('experiment-row').filter({ hasText: name });
  await expect(row).toContainText('1.5');

  await row.getByRole('link', { name }).click();
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page).toHaveURL(/\/experiments$/);
  await expect(page.getByTestId('experiment-row').filter({ hasText: name })).toHaveCount(0);
});

test('annotation workflow: viewer proposes, admin approves; viewer cannot manage experiments', async ({ browser }) => {
  const note = `needs triage ${Date.now()}`;

  const v = await browser.newContext();
  const vp = await v.newPage();
  await login(vp, VIEWER);
  await vp.goto('/experiments/new');
  await expect(vp.getByText('Forbidden').or(vp.getByText(/Application error|This page couldn/))).toBeVisible();
  await vp.goto('/experiments');
  await expect(vp.getByRole('button', { name: 'New experiment' })).toHaveCount(0);

  await vp.getByRole('link', { name: 'Agent Builder core' }).click();
  await vp.getByTestId('baseline-select').selectOption('abc-run-02');
  await vp.getByTestId('candidate-select').selectOption('abc-run-03');
  await vp.getByTestId('compare').click();
  await vp.getByTestId('annotation-input').fill(note);
  await vp.getByTestId('annotation-submit').click();
  const mine = vp.getByTestId('annotation').filter({ hasText: note });
  await expect(mine.getByTestId('annotation-status')).toHaveText('pending');
  await expect(mine.getByRole('button', { name: 'Approve' })).toHaveCount(0);
  await v.close();

  const a = await browser.newContext();
  const ap = await a.newPage();
  await login(ap, ADMIN);
  await ap.goto('/inbox');
  const item = ap.getByTestId('annotation').filter({ hasText: note });
  await expect(item).toBeVisible();
  await item.getByRole('button', { name: 'Approve' }).click();
  await expect(ap.getByTestId('annotation').filter({ hasText: note }).getByTestId('annotation-status')).toHaveText('approved');
  await ap.getByTestId('annotation').filter({ hasText: note }).getByRole('button', { name: 'Delete' }).click();
  await expect(ap.getByTestId('annotation').filter({ hasText: note })).toHaveCount(0);
  await a.close();
});
