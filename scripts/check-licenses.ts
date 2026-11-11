/**
 * Fail if a dependency brings in a license outside the allowlist.
 * Weak-copyleft packages that are only used unmodified at build time (never shipped in dist/)
 * are listed explicitly in BUILD_ONLY_EXCEPTIONS.
 */
import { execFileSync } from 'node:child_process';

const ALLOWED = new Set([
  'MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', '0BSD', 'Apache-2.0', 'MIT AND Apache-2.0',
  'MIT OR Apache-2.0', 'OFL-1.1', 'CC0-1.0', 'CC-BY-4.0', 'Unlicense', 'BlueOak-1.0.0', 'Python-2.0', 'Zlib',
]);
const BUILD_ONLY_EXCEPTIONS = new Map([
  ['@img/sharp-libvips', 'LGPL-3.0-or-later (image optimisation via sharp, dynamically linked)'],
  ['lightningcss', 'MPL-2.0 (CSS minifier used by Vite)'],
]);

const out = execFileSync('pnpm', ['licenses', 'list', '--json'], { encoding: 'utf8', maxBuffer: 64 << 20 });
const byLicense = JSON.parse(out) as Record<string, { name: string; versions: string[] }[]>;
const bad: string[] = [];
const excepted: string[] = [];
for (const [license, pkgs] of Object.entries(byLicense)) {
  if (ALLOWED.has(license)) continue;
  for (const p of pkgs) {
    const ex = [...BUILD_ONLY_EXCEPTIONS.keys()].find((k) => p.name.startsWith(k));
    (ex ? excepted : bad).push(`${p.name}@${p.versions.join(',')}  ${license}`);
  }
}
if (excepted.length) console.log(`build-only exceptions:\n  ${excepted.join('\n  ')}`);
if (bad.length) {
  console.error(`\nlicenses outside the allowlist:\n  ${bad.join('\n  ')}`);
  process.exit(1);
}
console.log('license check passed');
