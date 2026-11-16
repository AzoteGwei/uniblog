import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { parse, stringify } from 'yaml';
import { parseSiteConfig, type SiteConfig } from '../src/lib/config';

const FIXTURE = join(import.meta.dirname, 'fixtures/site.yaml');

/** The fixture config every test site starts from. */
export const fixtureConfig: SiteConfig = parseSiteConfig(readFileSync(FIXTURE, 'utf8'));

/** Creates a temp site root with the fixture site.yaml plus the given files. */
export function makeSite(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'uniblog-'));
  cpSync(FIXTURE, join(root, 'site.yaml'));
  for (const [p, c] of Object.entries(files)) {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, p), c);
  }
  return root;
}

/** Rewrites the site's site.yaml through `edit` and returns the parsed result. */
export function editSite(root: string, edit: (raw: any) => void): SiteConfig {
  const file = join(root, 'site.yaml');
  const raw = parse(readFileSync(file, 'utf8'));
  edit(raw);
  const text = stringify(raw);
  writeFileSync(file, text);
  return parseSiteConfig(text);
}
