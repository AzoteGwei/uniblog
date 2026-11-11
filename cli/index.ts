#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { loadSiteConfig } from '../src/lib/config';
import { materialize } from '../src/lib/materialize';
import { createPost } from './new';
import { statusTable } from './status';

const [cmd = 'help', ...rest] = process.argv.slice(2);

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
