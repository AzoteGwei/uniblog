import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse, stringify } from 'yaml';
import { z } from 'zod';

export const lockEntry = z.object({
  sourceHash: z.string(),
  glossaryHash: z.string(),
  promptVersion: z.number(),
  provider: z.string(),
  model: z.string().optional(),
  translatedAt: z.string(),
  outputHash: z.string(),
  edited: z.boolean().optional(),
});
export type LockEntry = z.infer<typeof lockEntry>;

const lockSchema = z.object({
  version: z.literal(1).default(1),
  entries: z.record(z.string(), z.record(z.string(), lockEntry)).default({}),
});
export type Lock = z.infer<typeof lockSchema>;

export const LOCK_PATH = 'i18n/state.lock.yaml';

export function loadLock(root = process.cwd()): Lock {
  const f = resolve(root, LOCK_PATH);
  if (!existsSync(f)) return { version: 1, entries: {} };
  return lockSchema.parse(parse(readFileSync(f, 'utf8')) ?? {});
}

export function saveLock(lock: Lock, root = process.cwd()): void {
  const sorted: Lock = {
    version: 1,
    entries: Object.fromEntries(
      Object.keys(lock.entries)
        .sort()
        .map((k) => [k, Object.fromEntries(Object.entries(lock.entries[k]!).sort(([a], [b]) => a.localeCompare(b)))]),
    ),
  };
  writeFileSync(
    resolve(root, LOCK_PATH),
    '# Managed by `pnpm i18n`. Tracks machine translations; commit this file.\n' + stringify(sorted, { lineWidth: 0 }),
  );
}

export function lockKey(collection: string, key: string): string {
  return `${collection}/${key}`;
}
