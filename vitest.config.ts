import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    // jsdom 27 depends on @asamuzakjp/css-color which uses require() for
    // ESM-only @csstools packages. Node 20 needs this flag to allow it.
    pool: 'forks',
    execArgv: ['--experimental-require-module'],
  },
});
