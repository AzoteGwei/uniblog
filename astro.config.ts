import { defineConfig } from 'astro/config';
import uniblog from './src/integrations/uniblog';
import { loadSiteConfig } from './src/lib/config';

const site = loadSiteConfig();

export default defineConfig({
  site: site.url,
  trailingSlash: 'always',
  integrations: [uniblog()],
  markdown: {
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: false,
    },
  },
});
