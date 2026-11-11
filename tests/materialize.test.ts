import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadSiteConfig } from '../src/lib/config';
import { splitFrontmatter } from '../src/lib/frontmatter';
import { hashOf } from '../src/lib/glossary';
import { saveLock } from '../src/lib/lock';
import { materialize } from '../src/lib/materialize';
import { readDoc, translatableHash } from '../src/lib/sources';
import { makeSite } from './helpers';

const cfg = loadSiteConfig();

function out(root: string, p: string) {
  return splitFrontmatter(readFileSync(join(root, '.uniblog/content', p), 'utf8'));
}

describe('materialize', () => {
  const jaTrans = '---\ntitle: 日语文章\n---\n\n软件内容\n';
  const root = makeSite({
    'content/posts/hello/index.md': '---\ntitle: 软件\ndate: 2026-01-01\n---\n\n这是-{zh-hans:内存;zh-hant:記憶體}-。\n',
    'content/posts/hello/pic.png': 'PNG',
    'content/posts/hello/index.en-us.md': '---\ntitle: Software\n---\n\nHuman English.\n',
    'content/posts/jp/index.md': '---\ntitle: 日本語\ndate: 2026-01-02\nlang: ja\n---\n\n本文\n',
    'content/posts/solo.md': '---\ntitle: 单篇\ndate: 2026-01-03\ntranslate: false\n---\n\n内容\n',
    'i18n/translations/zh-hans/posts/jp.md': jaTrans,
    'i18n/translations/en-us/posts/jp.md': '---\ntitle: Japanese\n---\n\nOld.\n',
  });
  const jp = readDoc(join(root, 'content/posts/jp/index.md'));
  saveLock(
    {
      version: 1,
      entries: {
        'posts/jp': {
          'zh-Hans': { sourceHash: translatableHash(jp), glossaryHash: 'x', promptVersion: 1, provider: 'mock', translatedAt: 't', outputHash: hashOf(jaTrans) },
          'en-US': { sourceHash: 'sha256:old', glossaryHash: 'x', promptVersion: 1, provider: 'mock', translatedAt: 't', outputHash: 'x' },
        },
      },
    },
    root,
  );
  materialize(cfg, root);

  it('keeps zh-Hans source and strips wiki rules', () => {
    const r = out(root, 'zh-hans/posts/hello/index.md');
    expect(r.body.trim()).toBe('这是内存。');
    expect((r.data.uniblog as any).status).toBe('source');
  });
  it('derives zh-Hant via OpenCC', () => {
    const r = out(root, 'zh-hant/posts/hello/index.md');
    expect(r.data.title).toBe('軟體');
    expect(r.body.trim()).toBe('這是記憶體。');
    expect(r.data.uniblog).toMatchObject({ status: 'source', derivedFrom: 'zh-Hans' });
  });
  it('prefers human versions', () => {
    const r = out(root, 'en-us/posts/hello/index.md');
    expect(r.data.uniblog).toMatchObject({ status: 'human' });
    expect(r.data.date).toBeDefined();
  });
  it('falls back with banner status', () => {
    expect((out(root, 'ja/posts/hello/index.md').data.uniblog as any).status).toBe('fallback');
  });
  it('uses machine translations and derives zh-Hant from them', () => {
    expect((out(root, 'zh-hans/posts/jp/index.md').data.uniblog as any).status).toBe('machine');
    const t = out(root, 'zh-hant/posts/jp/index.md');
    expect(t.data.uniblog).toMatchObject({ status: 'machine', derivedFrom: 'zh-Hans' });
    expect(t.body.trim()).toBe('軟體內容');
  });
  it('marks stale translations', () => {
    expect((out(root, 'en-us/posts/jp/index.md').data.uniblog as any).status).toBe('stale');
  });
  it('honours translate: false but still derives zh variants', () => {
    expect(existsSync(join(root, '.uniblog/content/en-us/posts/solo/index.md'))).toBe(false);
    expect(existsSync(join(root, '.uniblog/content/zh-hant/posts/solo/index.md'))).toBe(true);
  });
  it('links bundle assets', () => {
    expect(readFileSync(join(root, '.uniblog/content/ja/posts/hello/pic.png'), 'utf8')).toBe('PNG');
  });
  it('detects edited translations and removes orphans', () => {
    writeFileSync(join(root, 'i18n/translations/zh-hans/posts/jp.md'), jaTrans + '\n人工修改\n');
    const rep = materialize(cfg, root);
    expect((out(root, 'zh-hans/posts/jp/index.md').data.uniblog as any).status).toBe('reviewed');
    expect(rep.removed).toEqual([]);
  });
});

describe('front matter validation', () => {
  it('reports the file and field', () => {
    const root = makeSite({ 'content/posts/bad/index.md': '---\ntitle: x\n---\n\nbody\n' });
    expect(() => materialize(cfg, root)).toThrow(/bad\/index\.md: invalid front matter — date/);
  });
});
