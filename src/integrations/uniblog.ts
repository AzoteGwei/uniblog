import { copyFileSync, existsSync, mkdirSync, statSync, createReadStream } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { loadSiteConfig, type SiteConfig } from '../lib/config';
import { localePath } from '../lib/locales';
import { materialize, type MaterializeReport } from '../lib/materialize';

let fallbackUrls = new Set<string>();
/** URL dir (e.g. `/ja/posts/foo/`) → bundle asset absolute paths. */
let assetDirs = new Map<string, string[]>();

function routeOf(cfg: SiteConfig, locale: string, collection: string, slug: string): string {
  const base = `/${localePath(cfg, locale)}/`;
  return collection === 'posts' ? `${base}posts/${slug}/` : `${base}${slug}/`;
}

function index(cfg: SiteConfig, rep: MaterializeReport): void {
  fallbackUrls = new Set();
  assetDirs = new Map();
  for (const { item, resolved } of rep.items) {
    for (const r of resolved) {
      const slug = typeof r.doc.data.slug === 'string' ? r.doc.data.slug : item.key;
      const url = routeOf(cfg, r.locale, item.collection, slug);
      if (r.status === 'fallback') fallbackUrls.add(url);
      if (item.assets.length) assetDirs.set(url, item.assets);
    }
  }
}

function run(): MaterializeReport {
  const cfg = loadSiteConfig(process.cwd(), true);
  const rep = materialize(cfg);
  index(cfg, rep);
  return rep;
}

/** Used by the sitemap filter: fallback pages are noindex and excluded. */
export function isFallbackUrl(page: string): boolean {
  return fallbackUrls.has(new URL(page).pathname);
}

const MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
};

/** Keeps `.uniblog/content` in sync with `content/`, `i18n/` and `site.yaml`; publishes bundle assets. */
export default function uniblog(): AstroIntegration {
  return {
    name: 'uniblog',
    hooks: {
      'astro:config:setup': ({ logger }) => {
        const rep = run();
        logger.info(`materialized ${rep.items.length} items (${rep.written.length} written)`);
      },
      'astro:server:setup': ({ server, logger }) => {
        const watched = /\/(content|i18n)\/|\/site\.yaml$/;
        let timer: NodeJS.Timeout | undefined;
        const onChange = (file: string) => {
          if (!watched.test(file) || file.includes('/.uniblog/')) return;
          clearTimeout(timer);
          timer = setTimeout(() => {
            try {
              const rep = run();
              if (rep.written.length || rep.removed.length)
                logger.info(`re-materialized: ${[...rep.written, ...rep.removed].length} file(s)`);
            } catch (e) {
              logger.error(String(e));
            }
          }, 80);
        };
        server.watcher.add(['content', 'i18n', 'site.yaml']);
        server.watcher.on('add', onChange);
        server.watcher.on('change', onChange);
        server.watcher.on('unlink', onChange);
        // Serve page-bundle assets (PDFs, downloads, raw images) next to their page.
        server.middlewares.use((req, res, next) => {
          const path = decodeURIComponent((req.url ?? '').split('?')[0]!);
          const dir = path.slice(0, path.lastIndexOf('/') + 1);
          const file = assetDirs.get(dir)?.find((a) => basename(a) === path.slice(dir.length));
          if (!file || !existsSync(file) || statSync(file).isDirectory()) return next();
          res.setHeader('Content-Type', MIME[extname(file).toLowerCase()] ?? 'application/octet-stream');
          createReadStream(file).pipe(res);
        });
      },
      'astro:build:done': ({ dir, logger }) => {
        const out = fileURLToPath(dir);
        let n = 0;
        for (const [url, assets] of assetDirs) {
          const target = join(out, url);
          if (!existsSync(target)) continue;
          for (const a of assets) {
            if (statSync(a).isDirectory()) continue;
            mkdirSync(target, { recursive: true });
            copyFileSync(a, join(target, basename(a)));
            n++;
          }
        }
        if (n) logger.info(`copied ${n} bundle asset(s)`);
      },
    },
  };
}
