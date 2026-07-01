import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Deterministic defaults so config/env warnings and JWT verification behave
    // the same on every machine and in CI.
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!',
      JWT_REFRESH_SECRET: 'test-refresh-secret-at-least-32-characters!!',
    },
  },
});
