#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { loadSiteConfig } from '../src/lib/config';
import { materialize } from '../src/lib/materialize';
import { existsSync } from 'node:fs';
import { createPost } from './new';
import { planJobs, runJobs } from './translate';
import { resolveLocale } from '../src/lib/locales';
import { statusTable } from './status';

const [cmd = 'help', ...rest] = process.argv.slice(2);

if (existsSync('.env')) process.loadEnvFile('.env');

async function main(): Promise<number> {
  const cfg = loadSiteConfig();
  switch (cmd) {
    case 'new': {
      const { values, positionals } = parseArgs({
        args: rest,
        allowPositionals: true,
        options: {
          title: { type: 'string', short: 't' },
          lang: { type: 'string', short: 'l' },
          page: { type: 'boolean' },
          mdx: { type: 'boolean' },
          single: { type: 'boolean' },
        },
      });
      const slug = positionals[0];
      if (!slug) throw new Error('usage: pnpm new <slug> [--title …] [--lang ja] [--page] [--mdx] [--single]');
      console.log('created', createPost(cfg, { slug, ...values }));
      return 0;
    }
    case 'materialize': {
      const rep = materialize(cfg);
      console.log(`materialized ${rep.items.length} items (${rep.written.length} written, ${rep.removed.length} removed)`);
      return 0;
    }
    case 'status': {
      const { values } = parseArgs({ args: rest, options: { check: { type: 'boolean' } } });
      const rep = materialize(cfg);
      const t = statusTable(rep, Object.keys(cfg.locales));
      console.log(t.text);
      if (values.check && (t.stale || t.fallback)) {
        console.error(`\n${t.stale} stale, ${t.fallback} fallback`);
        return 1;
      }
      return 0;
    }
    case 'i18n': {
      const { values, positionals } = parseArgs({
        args: rest,
        allowPositionals: true,
        options: {
          locale: { type: 'string', short: 'l', multiple: true },
          provider: { type: 'string', short: 'p' },
          force: { type: 'boolean' },
          'dry-run': { type: 'boolean' },
          concurrency: { type: 'string', short: 'j' },
        },
      });
      const locales = values.locale?.map((l) => {
        const c = resolveLocale(cfg, l);
        if (!c) throw new Error(`unknown locale ${l}`);
        return c;
      });
      const { jobs, skipped } = planJobs(cfg, process.cwd(), { keys: positionals, locales, force: values.force });
      for (const s of skipped)
        console.warn(`! skip ${s.item.collection}/${s.item.key} → ${s.locale}: ${s.reason === 'edited-stale' ? 'source changed but translation was edited/reviewed (use --force to overwrite)' : 'translation file has no lock entry (hand-placed)'}`);
      if (!jobs.length) {
        console.log('translations are up to date');
        return 0;
      }
      console.log(`${jobs.length} translation job(s)`);
      const res = await runJobs(cfg, process.cwd(), jobs, {
        provider: values.provider,
        dryRun: values['dry-run'],
        concurrency: values.concurrency ? Number(values.concurrency) : undefined,
        log: (m) => console.log(m),
      });
      materialize(cfg);
      if (res.failed.length) console.error(`${res.failed.length} job(s) failed`);
      return res.failed.length ? 1 : 0;
    }
    default:
      console.log('uniblog <new|materialize|status|i18n|dev|build|ship>');
      return cmd === 'help' ? 0 : 1;
  }
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
