import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Server-side ES + auth only; nothing exotic.
  reactStrictMode: true,
  // The judge seam is flag-gated (D4). Expose the flag name so the UI can hide it.
  env: {
    EDV_JUDGE_ENABLED: process.env.EDV_JUDGE_ENABLED ?? 'false',
  },
};

export default nextConfig;
