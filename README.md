# uniblog

English | [简体中文](./README.zh-Hans.md) | [繁體中文](./README.zh-Hant.md)

A multilingual blog template built with Astro 7 and pnpm, configured for Cloudflare Pages.

- Posts can be written in any language and translated via pluggable providers (DeepSeek / OpenAI-compatible APIs, Gemini, Claude, DeepL, Google Translate). Translations are stored in `i18n/translations/` and tracked in Git for manual review and editing.
- Simplified and Traditional Chinese variants are generated at build time via OpenCC, with support for inline `-{…}-` conversion rules and custom glossaries.
- GitHub Actions translates new content, commits translations back to the repository, and deploys to Cloudflare Pages. Pull requests build preview deployments.
- Four built-in styles (`paper`, `slate`, `ink`, `terminal`) with light/dark mode, full-text search via Pagefind (`/` or `⌘K`), side-by-side bilingual comparison, and per-locale RSS feeds, sitemaps, and `hreflang` tags.

**License**

- **Code**: MIT ([`LICENSE`](./LICENSE)). Clean-room theme implementation inspired by the visual style of [pgsty/oink](https://github.com/pgsty/oink); no code is shared.
- **Content & translations**: CC BY 4.0 ([`content/LICENSE`](./content/LICENSE); see [`REUSE.toml`](./REUSE.toml) for file scope).

---

## Quick Start

**Requirements**: Node.js ≥ 22.12, pnpm (enable via `corepack enable`; version is pinned in `package.json`), a GitHub account, and a Cloudflare account.

### 1. Create a Repository

On GitHub, click **Use this template → Create a new repository**, then clone it:

```bash
git clone https://github.com/<you>/<your-blog>.git
cd <your-blog>
pnpm install
```

GitHub Actions runs on the first push. Before Cloudflare credentials are configured, the workflow only runs the build and tests and skips deployment.

### 2. Configure `site.yaml`

| Field | Description |
| --- | --- |
| `title` / `description` | Site title and description per locale. Missing locales fall back to `defaultLocale`. |
| `author` | Copyright author shown in the footer. |
| `url` | Production site URL (used for canonical URLs, sitemap, RSS, and `hreflang`). Use `https://<project>.pages.dev` before setting up a custom domain. |
| `defaultLocale` / `locales` | Enabled locales and URL path prefixes. See [Chinese Variant Conversion](#chinese-variant-conversion) to use Traditional Chinese as the default. |
| `translate.default` | Default translation provider (defaults to DeepSeek via an OpenAI-compatible endpoint). See [Translation](#translation). |
| `theme.style` | Default style: `paper`, `slate`, `ink`, or `terminal` (default: `ink`). |
| `deploy.project` | Cloudflare Pages project name (created on first deploy if it does not exist). |
| `deploy.productionBranch` | Production branch (default: `main`). |
| `contentLicense` | Content license shown in the footer. |

### 3. Replace Sample Content

- `content/posts/hello-world/`: Sample post demonstrating directory structure, shortcodes, and Chinese conversion. Delete the directory when no longer needed.
- `content/pages/about/index.md`: About page.
- `i18n/taxonomy.yaml`: Localized display names for tags and categories.
- `i18n/glossary.yaml`: Translation glossary and OpenCC custom terms.
- Update the copyright holder `Azote` in `LICENSE` and `REUSE.toml`. To use a different content license, update `content/LICENSE`, `REUSE.toml`, and `contentLicense` in `site.yaml`.

After deleting or renaming a post, run `pnpm i18n` to remove obsolete translation files and lock entries.

### 4. Local Translation

```bash
cp .env.example .env     # Set OPENAI_API_KEY (for the default DeepSeek provider)
pnpm i18n                # Translate missing or outdated posts
pnpm dev                 # Start dev server at http://localhost:4321
```

To use another provider, update `translate.default` in `site.yaml` and set the corresponding API key in `.env`. Without an API key, untranslated pages fall back to the source language and display a notice banner.

### 5. Deploy to Cloudflare Pages

1. **Create an API Token**: In the Cloudflare dashboard, go to **My Profile → API Tokens → Create Token → Create Custom Token**. Select **Account · Cloudflare Pages · Edit** and scope **Account Resources** to your account.
2. **Find your Account ID**: Copy it from the right sidebar of **Workers & Pages** in the dashboard, or run `pnpm exec wrangler whoami`.
3. **Add GitHub Secrets**: In your repository, go to **Settings → Secrets and variables → Actions → New repository secret**:

   | Secret | Required | Description |
   | --- | --- | --- |
   | `CLOUDFLARE_API_TOKEN` | Yes | Token created in Step 1. |
   | `CLOUDFLARE_ACCOUNT_ID` | Yes | Account ID from Step 2. |
   | `OPENAI_API_KEY` | No | If set, CI translates new posts and commits translations back. Other providers use `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `DEEPL_API_KEY`, or `GOOGLE_TRANSLATE_API_KEY`. |

4. Push to `main`. After the `deploy` job finishes, the deployment URL (`https://<project>.pages.dev`) is printed in the workflow logs.

See [Deployment](#deployment) for custom domains and CI options.

### 6. Writing Posts

```bash
pnpm new my-post --title "Post Title"    # Create content/posts/my-post/index.md
pnpm dev                                 # Preview at http://localhost:4321
# Remove `draft: true` (or set it to false) before publishing
git add . && git commit -m "new post" && git push
```

When a translation API key is configured in CI, pushing to `main` translates the post, commits the output, and deploys. You can also run `pnpm i18n` locally and review the files under `i18n/translations/` before committing.

---

## Commands

```bash
pnpm new <slug> [--title …] [--lang ja] [--page] [--mdx] [--single]   # Create a post or page (draft by default)
pnpm dev                       # Start local dev server (does not run automatic translation)
pnpm i18n [slug…] [-l en-US] [-p <engine>] [--force] [--dry-run]       # Translate missing/outdated posts and clean up removed posts
pnpm i18n:status [--check]     # Show translation status table (--check exits non-zero on stale/fallback)
pnpm build [--strict]          # Translate missing (local only) → astro build → pagefind (--strict fails on stale/fallback)
pnpm ship [--branch <name>]    # Build and deploy to Cloudflare Pages
pnpm preview                   # Preview dist/ locally
```

> `pnpm publish` and `pnpm deploy` are built-in pnpm commands, so the deployment script is named `pnpm ship`.

## Directory Structure

```text
site.yaml                 Site configuration: locales, routing, translation, theme, deployment
content/posts/<slug>/     Post bundle: index.md(x) and co-located assets
content/posts/<slug>/index.en-us.md   Optional hand-written translation (takes precedence over machine translation)
content/pages/<slug>/     Standalone pages (e.g. about)
i18n/translations/<locale>/<collection>/<slug>.md   Generated translations (tracked in Git; editable)
i18n/state.lock.yaml      Translation state (source hash, provider, output hash); commit alongside translations
i18n/glossary.yaml        Translation glossary and OpenCC custom terms
i18n/ui/*.yaml            UI strings; zh-Hant is derived via OpenCC and can be overridden in zh-Hant.yaml
i18n/taxonomy.yaml        Tag and category keys mapped to localized names
public/_headers           Cloudflare Pages response headers (security headers, asset caching)
.github/workflows/deploy.yml   CI workflow: translate → commit → test → deploy
.uniblog/                 Generated per-locale content directory (gitignored; read by Astro)
```

## Writing

Front matter follows Hugo conventions:

```yaml
title: Post Title
date: 2026-11-11T10:00:00Z
lang: zh-Hans            # Source language; defaults to defaultLocale in site.yaml
draft: true              # Shown only during `pnpm dev`
tags: [security]         # Tag keys; display names are defined in i18n/taxonomy.yaml
categories: [notes]
summary: Post summary
slug: custom-url         # Optional; defaults to the directory name
translate: true          # false = disable translation; or an array of locales like [en-US]
glossary:                # Per-post glossary terms
  - { zh-Hans: 金丝雀, en-US: canary }
translatorNotes: Concise technical tone   # Instructions passed to LLM providers
menu: 10                 # Pages only: include in top navigation (sorted ascending)
```

Shortcodes (implemented via `remark-directive`):

```md
:::note[Optional Title]     (note | tip | info | warning | danger | caution)
Content
:::

:::details[Summary]
Content
:::

::::tabs                    Outer container requires more colons than inner blocks
:::tab[pnpm]
:::
::::

:::steps
### Step 1
:::

::figure[Caption (translated with the post)]{src="./cover.png"}
::youtube{id="dQw4w9WgXcQ"}
```

`.mdx` is supported. JSX elements, `import` statements, and expressions are replaced with placeholders during translation.

### Chinese Variant Conversion

- **Simplified source → Traditional**: Converted via OpenCC `s2twp`.
- **Traditional source (`lang: zh-Hant`) → Simplified**: Converted via `tw2sp` by default (includes regional vocabulary such as `記憶體` → `内存`); can be changed to `tw2s` (character-only) in `site.yaml`.
- **Using Traditional Chinese as the default locale**: Update three settings in `site.yaml`:

  ```yaml
  defaultLocale: zh-Hant
  locales:
    zh-Hans: { path: zh-hans, label: 简体中文, derive: { from: zh-Hant, opencc: tw2sp } }  # or tw2s
    zh-Hant: { path: zh-hant, label: 繁體中文 }
  translate:
    zhPivot: zh-Hant        # Translate non-Chinese sources to zh-Hant first, then derive zh-Hans via OpenCC
  ```

  UI strings in `i18n/ui/` follow the same rule: only one complete Chinese variant file is required, while the other is derived automatically and only needs override entries.
- **Inline syntax**: Use `-{zh-hans:内存;zh-hant:記憶體;}-` for variant-specific terms, or `-{text}-` to prevent conversion.
- **Global terms**: Add custom pairs under `opencc:` in `i18n/glossary.yaml`.
- Code blocks, inline code, URLs, and HTML tags are not converted.

## Translation

Resolution order per locale:
**Source > Hand-written file (`index.<locale>.md`) > Reviewed/edited translation > Machine translation > Outdated (`stale`) translation > Source fallback** (renders a notice banner, sets `noindex`, points `canonical` to the source URL, and excludes the page from sitemaps and search).

- Non-Chinese posts are translated only into `translate.zhPivot` (default: `zh-Hans`); the other Chinese variant is derived via OpenCC.
- Modifying the source post marks existing machine translations as `stale`. Hand-edited translations (or files with `reviewed: true` in front matter) are not overwritten unless `pnpm i18n --force` is used.
- Running `pnpm i18n` removes translation files and lock entries for deleted or renamed posts (`--dry-run` lists files without deleting).
- During `pnpm dev`, the **Translations** panel in the Astro dev toolbar shows translation status and can trigger translation for the current page.
- `i18n/state.lock.yaml` records the source and output hashes for each translation. **Always commit `state.lock.yaml` together with `i18n/translations/`**; when resolving merge conflicts, keep entries from both sides.

### Providers

Configure the default provider in `site.yaml` (`translate.default`), override per locale with `translate.overrides`, or pass `-p <id>` to `pnpm i18n`:

| ID | Method | Environment Variable |
| --- | --- | --- |
| `openai` | Any OpenAI-compatible endpoint (DeepSeek, OpenRouter, OpenAI, Ollama, etc.); set endpoint via `options.baseURL` | `OPENAI_API_KEY` |
| `gemini` | `@google/genai`, full-document translation with placeholders | `GEMINI_API_KEY` |
| `anthropic` | `@anthropic-ai/sdk`, defaults to `claude-opus-5-5` with refusal fallback | `ANTHROPIC_API_KEY` |
| `deepl` | DeepL API v2, line-by-line with XML tag protection | `DEEPL_API_KEY` |
| `google` | Cloud Translation Basic v2, line-by-line with HTML protection | `GOOGLE_TRANSLATE_API_KEY` |
| `mock` | Offline pseudo-translation (for testing) | — |

Example:

```yaml
translate:
  default: { provider: openai, model: deepseek-flash, options: { baseURL: https://api.deepseek.com } }
  overrides:
    ja: { provider: anthropic }          # Use Claude for Japanese
```

LLM providers inject matching glossary terms from `i18n/glossary.yaml`; `deepl` and `google` only apply `dnt: true` (do-not-translate) terms. Custom providers can be added by implementing `TranslationProvider` and registering them in `cli/translate/providers/index.ts`.

## Theme

Four styles (`paper`, `slate`, `ink`, `terminal`, configured via `theme.style` in `site.yaml`) and light/dark mode can be toggled independently; preferences are stored in `localStorage`.

Includes a table of contents sidebar, breadcrumbs, previous/next links, tag/category/archive pages, per-locale RSS feeds, sitemap, and `hreflang` links. Press `/` or `⌘K` to open the command palette (Pagefind search, recent pages, language/style switcher). Translated posts include a side-by-side bilingual toggle aligned by section heading.

Top navigation displays Posts, Archive, Tags, Categories, and any standalone page with a `menu` field in front matter.

## Deployment

`.github/workflows/deploy.yml` uses GitHub Actions and `wrangler pages deploy` (Cloudflare Pages Direct Upload). See [Quick Start · Step 5](#5-deploy-to-cloudflare-pages) for setup instructions.

### Workflow Behavior

| Trigger | Translation | Target |
| --- | --- | --- |
| Push to `main` | When API key is set: runs `pnpm i18n`, commits new translations as `github-actions[bot]`, and pushes | Production |
| Pull request (same repo) | No | Preview (`https://<branch>.<project>.pages.dev`) |
| Pull request (fork) | No | Build and test only (no access to secrets) |
| Manual (`workflow_dispatch`) | Same as push | Selected branch |

- Commits pushed by the bot include `[skip ci]` and use `GITHUB_TOKEN`, preventing recursive workflow runs.
- Translation errors do not block deployment; untranslated pages fall back to the source post and are retried on the next push.
- If `main` receives new commits during translation and conflicts on the lockfile, the push step is skipped with a warning and retried on the next run.
- Set the repository variable `UNIBLOG_CI_TRANSLATE=false` (**Settings → Secrets and variables → Actions → Variables**) to disable CI translation.
- `pnpm build` and `pnpm ship` skip build-time translation when `CI` or `CF_PAGES` is detected (pass `--translate` to override).

### Custom Domain

In the Cloudflare dashboard, go to **Workers & Pages → `<project>` → Custom domains → Set up a custom domain**. After binding the domain, update `url` in `site.yaml` and commit.

### Local Deployment

```bash
pnpm exec wrangler login     # Or set CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID in .env
pnpm ship                    # Deploy to production
pnpm ship --branch preview   # Deploy to preview
```

Local `pnpm ship` and CI deploy to the same Cloudflare Pages project.

### Common Issues

- **Default branch is not `main`**: Update both `on.push.branches` in `.github/workflows/deploy.yml` and `deploy.productionBranch` in `site.yaml`. `deploy.productionBranch` only takes effect when creating the project; for existing projects, change it in the Cloudflare dashboard.
- **Branch protection / rulesets on `main`**: Prevents `github-actions[bot]` from pushing translation commits. Add GitHub Actions to the bypass list, or set `UNIBLOG_CI_TRANSLATE=false` and translate locally.
- **403 error when pushing in an organization repository**: Enable **Read and write permissions** under **Settings → Actions → General → Workflow permissions**, or disable CI translation.
- **Cloudflare token permission error**: Verify the token has **Account · Cloudflare Pages · Edit** permission and **Account Resources** includes the account matching `CLOUDFLARE_ACCOUNT_ID`.

<details>
<summary>Using Cloudflare Pages Git integration instead</summary>

Connect the repository in the Cloudflare dashboard with Build command `pnpm build`, Output directory `dist`, and environment variable `NODE_VERSION=22`. Build-time translation is disabled when `CF_PAGES` is set, so run `pnpm i18n` locally and commit translations before pushing.

Note: Direct Upload projects and Git integration projects cannot be converted into each other. If using Git integration, remove `.github/workflows/deploy.yml` (or leave `CLOUDFLARE_API_TOKEN` unset) and do not use `pnpm ship`.

</details>

## Updating from the Template

Repositories created from a GitHub template do not share commit history with the template repository. To merge upstream changes:

```bash
git remote add upstream https://github.com/<template-owner>/uniblog.git
git fetch upstream
git merge upstream/main --allow-unrelated-histories   # Required on the first merge only
```

Conflicts typically occur in `site.yaml`, `content/`, and `i18n/`; keep your local changes for those files.

## Troubleshooting

- **`! skip … translation file has no lock entry (hand-placed)`**: A translation file exists under `i18n/translations/`, but has no corresponding entry in `i18n/state.lock.yaml`, so `pnpm i18n` skips it to avoid overwriting manual files. This happens when a translation file was committed without `state.lock.yaml`, lock entries were dropped during a merge, or a locale code in `site.yaml` was renamed. Run `pnpm i18n --force <slug>` to re-translate and update the lockfile.
- **Changes to remark/rehype plugins do not take effect**: Delete the Astro content cache at `node_modules/.astro` and rebuild.
- **Fallback banner ("This post is not yet available in…") appears on pages**: The locale has not been translated yet. Run `pnpm i18n` locally or configure a translation API key in GitHub Secrets.

## Development & Checks

```bash
pnpm test            # Vitest unit tests: OpenCC, placeholder protection, content generation, translation, lockfile
pnpm test:e2e        # End-to-end test in a temp directory: mock translation → build → headless Chromium (set CHROMIUM=/path/to/chromium to override)
pnpm check           # astro check + dependency license allowlist check
```
