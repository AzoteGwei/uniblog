import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { planJobs, runJobs, translationTargets } from '../cli/translate';
import { chunkBody, decode, encode } from '../cli/translate/llm';
import { loadSiteConfig } from '../src/lib/config';
import { splitFrontmatter } from '../src/lib/frontmatter';
import { materialize } from '../src/lib/materialize';
import { discoverSources } from '../src/lib/sources';
import { makeSite } from './helpers';

const cfg = loadSiteConfig();

describe('llm envelope', () => {
  it('encodes and decodes fields and body', () => {
    const enc = encode({ title: 'T', summary: 'S' }, '# H\n\nbody ⟦0⟧\n');
    expect(decode(enc, ['title', 'summary'])).toEqual({ fields: { title: 'T', summary: 'S' }, body: '# H\n\nbody ⟦0⟧' });
    expect(() => decode('=====BODY=====\nx', ['title'])).toThrow(/missing fields/);
  });
  it('chunks at h2 boundaries', () => {
    const body = '## a\n' + 'x'.repeat(60) + '\n## b\n' + 'y'.repeat(60) + '\n';
    const chunks = chunkBody(body, 80);
    expect(chunks).toHaveLength(2);
    expect(chunks.join('')).toBe(body);
  });
});

describe('translation pipeline (mock)', () => {
  const root = makeSite({
    'content/posts/a/index.md': '---\ntitle: 软件\ndate: 2026-01-01\n---\n\n## 标题\n\n正文-{zh-hans:内存;zh-hant:記憶體}-和 `code`。\n',
    'content/posts/b/index.md': '---\ntitle: 日本語\ndate: 2026-01-01\nlang: ja\n---\n\n本文\n',
  });

  it('targets non-zh locales for zh sources and only the zh pivot for others', () => {
    const [a, b] = discoverSources(cfg, root);
    expect(translationTargets(cfg, a!)).toEqual(['en-US', 'ja']);
    expect(translationTargets(cfg, b!)).toEqual(['zh-Hans', 'en-US']);
  });

  it('translates, locks, materializes and detects staleness', async () => {
    const { jobs } = planJobs(cfg, root);
    expect(jobs).toHaveLength(4);
    const res = await runJobs(cfg, root, jobs, { provider: 'mock' });
    expect(res.failed).toEqual([]);
    const en = splitFrontmatter(readFileSync(join(root, 'i18n/translations/en-us/posts/a.md'), 'utf8'));
    expect(en.data.title).toBe('[en-US] 软件');
    expect(en.body).toContain('## [en-US] 标题');
    expect(en.body).toContain('正文内存和 `code`'); // wiki rule resolved to the source variant, code kept
    expect(planJobs(cfg, root).jobs).toHaveLength(0);

    materialize(cfg, root);
    const hant = splitFrontmatter(readFileSync(join(root, '.uniblog/content/zh-hant/posts/b/index.md'), 'utf8'));
    expect(hant.data.uniblog).toMatchObject({ status: 'machine', derivedFrom: 'zh-Hans' });

    // Source edit → stale; edited translation → skipped unless forced.
    const src = join(root, 'content/posts/a/index.md');
    writeFileSync(src, readFileSync(src, 'utf8') + '\n新段落\n');
    writeFileSync(join(root, 'i18n/translations/ja/posts/a.md'), 'hand fixed\n');
    const plan = planJobs(cfg, root);
    expect(plan.jobs.map((j) => `${j.locale}:${j.reason}`)).toEqual(['en-US:stale']);
    expect(plan.skipped.map((s) => `${s.locale}:${s.reason}`)).toEqual(['ja:edited-stale']);
    expect(planJobs(cfg, root, { force: true, keys: ['a'] }).jobs).toHaveLength(2);
  });
});
