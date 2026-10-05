/** Demo screenshots: login -> verdict home -> compare -> annotate -> inbox. Needs app on :3000 + seeded ES. */
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const OUT = 'docs/screenshots';
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}`, fullPage: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
const page = await ctx.newPage();

await page.goto(`${BASE}/login`);
await page.fill('input[name=username]', 'patryk');
await page.fill('input[name=password]', process.env.EDV_SEED_ADMIN_PASSWORD ?? 'patryk-edv-2026');
await page.click('button[type=submit]');
await page.waitForURL(`${BASE}/`);
await page.waitForLoadState('networkidle');
await shot(page, '01-login-or-home.png');

await page.goto(`${BASE}/experiments`);
await page.getByRole('link', { name: 'Agent Builder core' }).click();
await page.waitForURL(/\/experiments\/[^/]+$/);
await page.selectOption('[data-testid=baseline-select]', 'abc-run-02');
await page.selectOption('[data-testid=candidate-select]', 'abc-run-03');
await page.click('[data-testid=compare]');
await page.waitForSelector('[data-testid=verdict-panel]');
await page.getByTestId('annotation-input').fill('model-b correctness dropped 0.827 -> 0.611 (CI disjoint, d=-13.7) in abc-run-03; bisecting the prompt change before release.');
await shot(page, '02-experiment-compare.png');
await page.click('[data-testid=annotation-submit]');
await page.waitForLoadState('networkidle');
await page.getByTestId('annotation-input').fill('Candidate run-03 change confirmed unrelated to model-a; flagging model-b only.');
await page.click('[data-testid=annotation-submit]');
await page.waitForLoadState('networkidle');

await page.goto(`${BASE}/inbox`);
await page.getByRole('button', { name: 'Approve' }).first().click(); // admin approves one; the other stays pending
await page.waitForLoadState('networkidle');
await page.goto(`${BASE}/inbox`);
await shot(page, '03-annotations-inbox.png');

// 04: terminal-style render of the real CLI output captured in 04-cli-output.txt
// (regenerate with: { echo '$ npm run verdict -- ...'; npm run verdict -- ...; } > docs/screenshots/04-cli-output.txt)
const txt = readFileSync(`${OUT}/04-cli-output.txt`, 'utf8').replace(/&/g, '&amp;').replace(/</g, '&lt;');
const term = await ctx.newPage();
await term.setContent(`<body style="margin:0;background:#0f1115"><div style="margin:24px;border:1px solid #2a2f3a;border-radius:8px;overflow:hidden;background:#0d0f14">
<div style="background:#181b22;padding:8px 14px;color:#8b93a5;font:12px system-ui">edv — zsh</div>
<pre style="margin:0;padding:16px;color:#e6e8ee;font:13px/1.35 ui-monospace,Menlo,Consolas,monospace">${txt}</pre></div></body>`);
await term.screenshot({ path: `${OUT}/04-cli-screenshot.png`, fullPage: true });

await browser.close();
