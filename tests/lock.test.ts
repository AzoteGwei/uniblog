import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findOrphans, planJobs, pruneOrphans, runJobs } from '../cli/translate';
import { loadSiteConfig } from '../src/lib/config';
import { loadLock } from '../src/lib/lock';
import { makeSite } from './helpers';

const cfg = loadSiteConfig(process.cwd(), true);

describe('lock under overlapping runs', () => {
  it('keeps entries written by a concurrent run (e.g. dev toolbar + pnpm i18n)', async () => {
    const root = makeSite({
      'content/posts/hello-world/index.md': '---\ntitle: 你好\ndate: 2026-01-01\n---\n\n你好世界\n',
      'content/posts/other/index.md': '---\ntitle: 其他\ndate: 2026-01-01\n---\n\n其他\n',
    });
    const a = planJobs(cfg, root, { keys: ['hello-world'] }).jobs;
    const b = planJobs(cfg, root, { keys: ['other'] }).jobs;
    await Promise.all([runJobs(cfg, root, a, { provider: 'mock' }), runJobs(cfg, root, b, { provider: 'mock' })]);
    expect(Object.keys(loadLock(root).entries).sort()).toEqual(['posts/hello-world', 'posts/other']);
    expect(planJobs(cfg, root).skipped).toEqual([]);
  });
});

describe('orphans', () => {
  it('prunes translations and lock entries of deleted sources only', async () => {
    const root = makeSite({
      'content/posts/keep/index.md': '---\ntitle: 留\ndate: 2026-01-01\n---\n\n留\n',
      'content/posts/gone/index.md': '---\ntitle: 删\ndate: 2026-01-01\n---\n\n删\n',
    });
    await runJobs(cfg, root, planJobs(cfg, root).jobs, { provider: 'mock' });
    rmSync(join(root, 'content/posts/gone'), { recursive: true });
    const o = findOrphans(cfg, root);
    expect(o.lockIds).toEqual(['posts/gone']);
    expect(o.files).toEqual(['i18n/translations/en-us/posts/gone.md', 'i18n/translations/ja/posts/gone.md']);
    pruneOrphans(cfg, root);
    expect(Object.keys(loadLock(root).entries)).toEqual(['posts/keep']);
    expect(existsSync(join(root, 'i18n/translations/ja/posts/gone.md'))).toBe(false);
    expect(existsSync(join(root, 'i18n/translations/ja/posts/keep.md'))).toBe(true);
    expect(findOrphans(cfg, root)).toEqual({ files: [], lockIds: [] });
  });
});
