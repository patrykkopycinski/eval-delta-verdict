/** Re-seed ES to a known state before the E2E run. */
import { execFileSync } from 'node:child_process';

export default async function globalSetup() {
  execFileSync('npx', ['tsx', 'scripts/seed.ts'], { stdio: 'inherit', env: process.env });
}
