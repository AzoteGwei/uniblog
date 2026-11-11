import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { planJobs, runJobs, translationTargets } from '../cli/translate';
import { loadSiteConfig, parseSiteConfig } from '../src/lib/config';
import { splitFrontmatter } from '../src/lib/frontmatter';
import { openccPreset } from '../src/lib/locales';
import { materialize } from '../src/lib/materialize';
import { discoverSources } from '../src/lib/sources';
import { makeSite } from './helpers';

const cfg = loadSiteConfig();
const read = (root: string, p: string) => splitFrontmatter(readFileSync(join(root, '.uniblog/content', p), 'utf8'));

/** site.yaml with Traditional Chinese as the primary variant. */
function hantFirst(root: string, zhHans: string) {
  const yaml = readFileSync(join(root, 'site.yaml'), 'utf8')
    .replace(/defaultLocale: zh-Hans/, 'defaultLocale: zh-Hant')
    .replace(/  zh-Hans: \{ path: zh-hans, label: 简体中文 \}/, `  zh-Hans: ${zhHans}`)
    .replace(/  zh-Hant: \{[^\n]*\}/, '  zh-Hant: { path: zh-hant, label: 繁體中文 }')
    .replace(/zhPivot: zh-Hans/, 'zhPivot: zh-Hant');
  writeFileSync(join(root, 'site.yaml'), yaml);
  return parseSiteConfig(yaml);
}

describe('Traditional Chinese source', () => {
  it('picks tw2sp by default and honours an explicit derive preset', () => {
    expect(openccPreset(cfg, 'zh-Hant', 'zh-Hans')).toBe('tw2sp');
    const root = makeSite({});
    const c = hantFirst(root, '{ path: zh-hans, label: 简体中文, derive: { from: zh-Hant, opencc: tw2s } }');
    expect(openccPreset(c, 'zh-Hant', 'zh-Hans')).toBe('tw2s');
  });

  it('derives zh-Hans from a zh-Hant post with rules and glossary terms', () => {
    const root = makeSite({
      'content/posts/t/index.md':
        '---\ntitle: 軟體與記憶體\ndate: 2026-01-01\nlang: zh-Hant\n---\n\n滑鼠、部落格、-{zh-hans:服务器;zh-hant:伺服器}-、-{軟體}-、`記憶體`。\n',
      'i18n/glossary.yaml': 'opencc:\n  - { zh-hans: 博客, zh-hant: 部落格 }\n',
    });
    materialize(cfg, root);
    const hans = read(root, 'zh-hans/posts/t/index.md');
    expect(hans.data.title).toBe('软件与内存');
    expect(hans.body.trim()).toBe('鼠标、博客、服务器、軟體、`記憶體`。');
    expect(hans.data.uniblog).toMatchObject({ status: 'source', derivedFrom: 'zh-Hant' });
    const hant = read(root, 'zh-hant/posts/t/index.md');
    expect(hant.body.trim()).toBe('滑鼠、部落格、伺服器、軟體、`記憶體`。');
  });

  it('uses character-only tw2s when configured', () => {
    const root = makeSite({ 'content/posts/t/index.md': '---\ntitle: 記憶體\ndate: 2026-01-01\nlang: zh-Hant\n---\n\n軟體\n' });
    const c = hantFirst(root, '{ path: zh-hans, label: 简体中文, derive: { from: zh-Hant, opencc: tw2s } }');
    materialize(c, root);
    expect(read(root, 'zh-hans/posts/t/index.md').data.title).toBe('记忆体');
  });

  it('translates non-zh sources into a zh-Hant pivot and derives zh-Hans', async () => {
    const root = makeSite({ 'content/posts/j/index.md': '---\ntitle: 日本語\ndate: 2026-01-01\nlang: ja\n---\n\n本文\n' });
    const c = hantFirst(root, '{ path: zh-hans, label: 简体中文 }');
    expect(translationTargets(c, discoverSources(c, root)[0]!)).toEqual(['zh-Hant', 'en-US']);
    const zhHantSource = discoverSources(c, root);
    expect(translationTargets(c, { ...zhHantSource[0]!, lang: 'zh-Hant' })).toEqual(['en-US', 'ja']);
    const res = await runJobs(c, root, planJobs(c, root).jobs, { provider: 'mock' });
    expect(res.failed).toEqual([]);
    materialize(c, root);
    expect(read(root, 'zh-hans/posts/j/index.md').data.uniblog).toMatchObject({ status: 'machine', derivedFrom: 'zh-Hant' });
  });
});

describe('UI strings for a Traditional-first site', () => {
  const cwd = process.cwd();
  afterEach(() => {
    process.chdir(cwd);
    vi.resetModules();
  });

  it('derives zh-Hans UI from zh-Hant.yaml (and still works the other way round)', async () => {
    const root = makeSite({
      'i18n/ui/en-US.yaml': 'nav.archive: Archive\npost.published: Published\n',
      'i18n/ui/zh-Hant.yaml': 'nav.archive: 歸檔\npost.published: 發佈於\n',
    });
    hantFirst(root, '{ path: zh-hans, label: 简体中文 }');
    process.chdir(root);
    vi.resetModules();
    const { t } = await import('../src/lib/ui');
    expect(t('zh-Hans', 'nav.archive')).toBe('归档');
    expect(t('zh-Hant', 'post.published')).toBe('發佈於');

    writeFileSync(join(root, 'i18n/ui/zh-Hans.yaml'), 'nav.archive: 存档\n');
    vi.resetModules();
    const again = await import('../src/lib/ui');
    expect(again.t('zh-Hans', 'nav.archive')).toBe('存档'); // own file still wins
    expect(again.t('zh-Hans', 'post.published')).toBe('发布于');
  });
});
