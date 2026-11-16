import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Only our own tests: tool working copies (.jj/run, worktrees…) would otherwise be picked up too.
  test: { include: ['tests/**/*.test.ts'] },
});
