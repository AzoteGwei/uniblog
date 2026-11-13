/**
 * Offline end-to-end check: copies the project to a temp dir, translates with the mock
 * provider, builds (astro + pagefind), serves dist/ and drives a headless Chromium.
 *
 *   pnpm test:e2e            (CHROMIUM=/path/to/chromium to override the browser)
 */
import { execFileSync, spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer, type AddressInfo } from 'node:net';
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
// Fixture with a hand-written English version, so the check doesn't depend on sample content.
mkdirSync(join(dir, 'content/posts/e2e-human'), { recursive: true });
writeFileSync(join(dir, 'content/posts/e2e-human/index.md'), '---\ntitle: 人工翻译\ndate: 2026-01-01\n---\n\n正文\n');
writeFileSync(join(dir, 'content/posts/e2e-human/index.en-us.md'), '---\ntitle: Human translation\n---\n\nBody\n');

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
for (const l of ['zh-hans', 'zh-hant', 'en-us', 'ja']) check(`dist/${l}/posts/hello-world exists`, existsSync(join(dir, 'dist', l, 'posts/hello-world/index.html')));
check('zh-hant is converted', read('zh-hant/posts/hello-world/index.html').includes('部落格'));
check('machine page has banner', read('en-us/posts/hello-world/index.html').includes('Machine-translated'));
check('human page has no banner', !read('en-us/posts/e2e-human/index.html').includes('class="banner'));
check('hreflang complete', (read('ja/posts/hello-world/index.html').match(/hreflang="(zh-Hans|zh-Hant|en-US|ja)"/g) ?? []).length >= 4);
check('about page is in the nav', ['zh-hans', 'zh-hant', 'en-us', 'ja'].every((l) => read(`${l}/index.html`).includes(`href="/${l}/about/"`)));
check('pagefind index exists', existsSync(join(dir, 'dist/pagefind/pagefind.js')));
check('bundle image published', /_astro\/cover\.[^"]+\.webp/.test(read('ja/posts/hello-world/index.html')));

// Browser checks
// Free port + own process group: the node_modules/.bin shim forks node, so killing only the
// shim leaks a preview server, and astro silently moves to the next port when one is busy —
// later runs would then test a stale site.
const port = await new Promise<number>((ok) => {
  const srv = createServer().listen(0, () => {
    const { port } = srv.address() as AddressInfo;
    srv.close(() => ok(port));
  });
});
const base = `http://localhost:${port}`;
const server = spawn(join(repo, 'node_modules/.bin/astro'), ['preview', '--port', String(port)], { cwd: dir, stdio: 'ignore', detached: true });
const stopServer = () => {
  try {
    process.kill(-server.pid!, 'SIGTERM');
  } catch {}
};
process.on('exit', stopServer);
for (let i = 0; ; i++) {
  try {
    const res = await fetch(`${base}/zh-hans/posts/hello-world/`);
    if (res.ok && (await res.text()).includes('<title>Hello World')) break;
  } catch {}
  if (i > 60) throw new Error(`astro preview did not serve this build on ${base}`);
  await new Promise((r) => setTimeout(r, 250));
}
const executablePath = process.env.CHROMIUM ?? ['/usr/bin/chromium', '/usr/sbin/chromium', '/usr/bin/google-chrome'].find(existsSync);
const browser = await chromium.launch({ executablePath });
try {
  const page = await browser.newPage();
  await page.goto(`${base}/zh-hans/posts/hello-world/`);
  await page.click('[data-open-palette]');
  await page.fill('dialog.palette input', '繁简');
  await page.waitForSelector('dialog.palette [role=option]', { timeout: 5000 });
  check('search finds the post', (await page.textContent('dialog.palette ul'))!.includes('Hello World'));
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
  stopServer();
}
if (failures) {
  console.error(`${failures} check(s) failed (workdir ${dir})`);
  process.exit(1);
}
console.log(`all e2e checks passed (workdir ${dir})`);
