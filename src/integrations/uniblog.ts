import type { AstroIntegration } from 'astro';
import { loadSiteConfig } from '../lib/config';
import { materialize } from '../lib/materialize';

/** Keeps `.uniblog/content` in sync with `content/`, `i18n/` and `site.yaml`. */
export default function uniblog(): AstroIntegration {
  return {
    name: 'uniblog',
    hooks: {
      'astro:config:setup': ({ logger }) => {
        const rep = materialize(loadSiteConfig(process.cwd(), true));
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
              const rep = materialize(loadSiteConfig(process.cwd(), true));
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
      },
    },
  };
}
