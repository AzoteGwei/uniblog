import { cpSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export function makeSite(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'uniblog-'));
  cpSync('site.yaml', join(root, 'site.yaml'));
  for (const [p, c] of Object.entries(files)) {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, p), c);
  }
  return root;
}
