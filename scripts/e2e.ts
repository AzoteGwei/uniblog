/**
 * Offline end-to-end check: copies the project to a temp dir, translates with the mock
 * provider, builds (astro + pagefind), serves dist/ and drives a headless Chromium.
 *
 *   pnpm test:e2e            (CHROMIUM=/path/to/chromium to override the browser)
 */
import { execFileSync, spawn } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright-core';

const repo = resolve(import.meta.dirname, '..');
const dir = mkdtempSync(join(tmpdir(), 'uniblog-e2e-'));
for (const p of ['src', 'cli', 'content', 'i18n', 'public', 'site.yaml', 'astro.config.ts', 'tsconfig.json', 'package.json']) {
  if (existsSync(join(repo, p))) cpSync(join(repo, p), join(dir, p), { recursive: true });
}
rmSync(join(dir, 'i18n/translations'), { recursive: true, force: true });
rmSync(join(dir, 'i18n/state.lock.yaml'), { force: true });
symlinkSync(join(repo, 'node_modules'), join(dir, 'node_modules'));

const tsx = join(repo, 'node_modules/.bin/tsx');
const sh = (args: string[]) => execFileSync(tsx, ['cli/index.ts', ...args], { cwd: dir, stdio: 'inherit' });
sh(['i18n', '-p', 'mock']);
sh(['build', '--no-translate']);

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `  ${detail}`}`);
  if (!ok) failures++;
};
const read = (p: string) => readFileSync(join(dir, 'dist', p), 'utf8');

// Static assertions
for (const l of ['zh-hans', 'zh-hant', 'en-us', 'ja']) check(`dist/${l}/posts/hello-uniblog exists`, existsSync(join(dir, 'dist', l, 'posts/hello-uniblog/index.html')));
check('zh-hant is converted', read('zh-hant/posts/hello-uniblog/index.html').includes('部落格'));
check('machine page has banner', read('en-us/posts/hello-uniblog/index.html').includes('Machine-translated'));
check('human page has no banner', !read('en-us/posts/opencc-notes/index.html').includes('class="banner'));
check('hreflang complete', (read('ja/posts/hello-uniblog/index.html').match(/hreflang="(zh-Hans|zh-Hant|en-US|ja)"/g) ?? []).length >= 4);
check('pagefind index exists', existsSync(join(dir, 'dist/pagefind/pagefind.js')));
check('bundle image published', /_astro\/cover\.[^"]+\.webp/.test(read('ja/posts/shortcodes/index.html')));

// Browser checks
const server = spawn(join(repo, 'node_modules/.bin/astro'), ['preview', '--port', '4391'], { cwd: dir, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const executablePath = process.env.CHROMIUM ?? ['/usr/bin/chromium', '/usr/sbin/chromium', '/usr/bin/google-chrome'].find(existsSync);
const browser = await chromium.launch({ executablePath });
try {
  const page = await browser.newPage();
  await page.goto('http://localhost:4391/zh-hans/posts/hello-uniblog/');
  await page.click('[data-open-palette]');
  await page.fill('dialog.palette input', '繁简');
  await page.waitForSelector('dialog.palette [role=option]', { timeout: 5000 });
  check('search finds the post', (await page.textContent('dialog.palette ul'))!.includes('你好'));
  await page.keyboard.press('Escape');
  if (await page.isVisible('dialog.palette')) await page.keyboard.press('Escape');

  await page.click('.compare-toggle');
  await page.waitForSelector('.duo .pane-right', { timeout: 5000 });
  const rows = await page.$$eval('.duo > .pane-left', (els) => els.length);
  check('compare view aligns sections', rows > 1, `rows=${rows}`);

  await page.click('summary[aria-label="风格"]');
  await page.click('[data-set-style="terminal"]');
  await page.click('[data-set-theme="dark"]');
  await page.reload();
  check('style/theme persist', (await page.getAttribute('html', 'data-style')) === 'terminal' && (await page.getAttribute('html', 'data-theme')) === 'dark');
  await page.screenshot({ path: join(dir, 'terminal-dark.png'), fullPage: false });
  console.log(`screenshot: ${join(dir, 'terminal-dark.png')}`);
} finally {
  await browser.close();
  server.kill();
}
if (failures) {
  console.error(`${failures} check(s) failed (workdir ${dir})`);
  process.exit(1);
}
console.log(`all e2e checks passed (workdir ${dir})`);
