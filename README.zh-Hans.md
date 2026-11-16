# uniblog

[English](./README.md) | 简体中文 | [繁體中文](./README.zh-Hant.md)

基于 Astro 7 与 pnpm 的多语言博客模板，默认配置 Cloudflare Pages 部署。

- 原文可使用任意语言撰写，其余语言通过可插拔的翻译接口（DeepSeek / OpenAI 兼容接口、Gemini、Claude、DeepL、Google Translate）生成。译文存放在 `i18n/translations/` 并纳入 Git 版本控制，可直接手动修改和校对。
- 繁简版本由 OpenCC 在构建时转换生成，支持维基百科风格的 `-{…}-` 行内转换语法与自定义词表。
- GitHub Actions 自动执行翻译、将译文提交回仓库并部署到 Cloudflare Pages；Pull Request 自动生成预览环境。
- 内置四种主题风格（`paper`、`slate`、`ink`、`terminal`）与明暗模式、Pagefind 全文搜索（`/` 或 `⌘K`）、双语对照阅读，以及按语言生成的 RSS、sitemap 与 `hreflang`。

**许可协议**

- **代码**：MIT（[`LICENSE`](./LICENSE)）。主题为 clean-room 实现，仅参考 [pgsty/oink](https://github.com/pgsty/oink) 的视觉方向，未使用其代码。
- **内容与译文**：CC BY 4.0（[`content/LICENSE`](./content/LICENSE)，路径范围见 [`REUSE.toml`](./REUSE.toml)）。

---

## 快速开始

**环境要求**：Node.js ≥ 22.12、pnpm（执行 `corepack enable` 启用，版本由 `package.json` 的 `packageManager` 字段指定）、GitHub 账号，部署需 Cloudflare 账号。

### 1. 创建仓库

在 GitHub 上点击 **Use this template → Create a new repository**，然后克隆到本地：

```bash
git clone https://github.com/<you>/<your-blog>.git
cd <your-blog>
pnpm install
```

首次推送时 GitHub Actions 即会运行；未配置 Cloudflare 凭证前仅执行构建与测试，跳过部署步骤。

### 2. 配置 `site.yaml`

| 字段 | 说明 |
| --- | --- |
| `title` / `description` | 各语言的站点标题与简介；缺省时回退到 `defaultLocale` |
| `author` | 页脚版权署名 |
| `url` | 正式域名（用于生成 canonical、sitemap、RSS 和 `hreflang`）。未绑定自定义域名时可先填 `https://<project>.pages.dev` |
| `defaultLocale` / `locales` | 语言列表与 URL 路径前缀；以繁体中文为主的配置方式见[繁简转换](#繁简转换) |
| `translate.default` | 默认翻译引擎，默认为 DeepSeek（OpenAI 兼容接口），详见[翻译](#翻译) |
| `theme.style` | 默认主题风格：`paper` / `slate` / `ink` / `terminal`（默认 `ink`） |
| `deploy.project` | Cloudflare Pages 项目名，首次部署时自动创建 |
| `deploy.productionBranch` | 生产分支，默认 `main` |
| `contentLicense` | 页脚显示的内容许可协议 |

### 3. 替换示例内容

- `content/posts/hello-world/`：示例文章，演示目录结构、扩展语法与繁简转换。阅后可直接删除该目录。
- `content/pages/about/index.md`：关于页面。
- `i18n/taxonomy.yaml`：标签（tags）与分类（categories）的各语言显示名。
- `i18n/glossary.yaml`：翻译术语表与 OpenCC 自定义词对。
- 将 `LICENSE`、`REUSE.toml` 中的版权人 `Azote` 改为你的署名；如需更换内容许可协议，同步修改 `content/LICENSE`、`REUSE.toml` 及 `site.yaml` 的 `contentLicense`。

删除或重命名文章后，运行一次 `pnpm i18n` 以清理残留的旧译文文件和 lock 记录。

### 4. 配置本地翻译

```bash
cp .env.example .env     # 填入 OPENAI_API_KEY（默认 DeepSeek 引擎使用）
pnpm i18n                # 翻译缺失或已过期的文章
pnpm dev                 # 启动本地预览 http://localhost:4321
```

如需更换翻译引擎，修改 `site.yaml` 的 `translate.default` 并在 `.env` 中填入对应密钥。未配置密钥时亦可正常开发与构建，未翻译的语言页面会显示原文并附带提示横幅。

### 5. 部署到 Cloudflare Pages

1. **创建 API Token**：Cloudflare 控制台 → **My Profile → API Tokens → Create Token → Create Custom Token**，权限选择 **Account · Cloudflare Pages · Edit**，**Account Resources** 选择对应账号。
2. **获取 Account ID**：在控制台 **Workers & Pages** 页面右侧栏查看，或在本地运行 `pnpm exec wrangler whoami`。
3. **添加 GitHub Secrets**：仓库 **Settings → Secrets and variables → Actions → New repository secret**：

   | Secret | 必需 | 说明 |
   | --- | --- | --- |
   | `CLOUDFLARE_API_TOKEN` | 是 | 第 1 步创建的 Token |
   | `CLOUDFLARE_ACCOUNT_ID` | 是 | 第 2 步获取的 Account ID |
   | `OPENAI_API_KEY` | 否 | 配置后 CI 会自动翻译并提交译文；其他引擎使用对应变量名（`GEMINI_API_KEY`、`ANTHROPIC_API_KEY`、`DEEPL_API_KEY`、`GOOGLE_TRANSLATE_API_KEY`） |

4. 推送至 `main` 分支。Actions 中的 `deploy` 任务完成后，构建日志会输出 `https://<project>.pages.dev` 访问地址（若名称已被占用，Cloudflare 会自动追加后缀，以日志输出为准）。

自定义域名与 CI 详情见[部署](#部署)。

### 6. 日常写作

```bash
pnpm new my-post --title "文章标题"    # 创建草稿 content/posts/my-post/index.md
pnpm dev                               # 本地预览
# 发布前将 draft: true 删除或改为 false
git add . && git commit -m "new post" && git push
```

若配置了翻译密钥，CI 会自动翻译、提交译文并部署；也可在推送前先在本地运行 `pnpm i18n`，检查或修改译文后再一并提交。

---

## 命令说明

```bash
pnpm new <slug> [--title …] [--lang ja] [--page] [--mdx] [--single]   # 创建文章或页面（默认为草稿）
pnpm dev                       # 启动本地开发服务器（不自动执行翻译）
pnpm i18n [slug…] [-l en-US] [-p <engine>] [--force] [--dry-run]       # 翻译缺失/过期的文章，清理已删除文章的译文
pnpm i18n:status [--check]     # 查看翻译状态表；--check 在存在 stale / fallback 时返回非零退出码
pnpm build [--strict]          # 补齐翻译（仅本地）→ astro build → pagefind；--strict 在存在 stale / fallback 时报错退出
pnpm ship [--branch <name>]    # 构建并部署到 Cloudflare Pages
pnpm preview                   # 本地预览 dist/
```

> `pnpm publish` 与 `pnpm deploy` 为 pnpm 内置命令，因此部署命令命名为 `pnpm ship`。

## 目录结构

```text
site.yaml                 站点配置：语言、路由、翻译引擎、主题、部署
content/posts/<slug>/     文章目录（Page Bundle）：index.md(x) 及同目录图片等资源
content/posts/<slug>/index.en-us.md   可选：手写的其他语言版本（优先级高于机器翻译）
content/pages/<slug>/     独立页面（如 about）
i18n/translations/<locale>/<collection>/<slug>.md   机器翻译文件（纳入 Git，可手动编辑）
i18n/state.lock.yaml      翻译状态记录（原文 hash、引擎、输出 hash），需与译文一并提交
i18n/glossary.yaml        术语表与 OpenCC 自定义词对
i18n/ui/*.yaml            界面文本；zh-Hant 由 OpenCC 派生，可在 zh-Hant.yaml 中覆盖
i18n/taxonomy.yaml        tag / category 标识与各语言显示名的映射
public/_headers           Cloudflare Pages 响应头（安全头、静态资源缓存）
.github/workflows/deploy.yml   CI 工作流：翻译 → 提交 → 测试 → 部署
.uniblog/                 构建时生成的各语言内容目录（gitignored，供 Astro 读取）
```

## 写作

Front matter（采用 Hugo 约定）：

```yaml
title: 标题
date: 2026-11-11T10:00:00Z
lang: zh-Hans            # 原文语言；省略时使用 site.yaml 的 defaultLocale
draft: true              # 草稿仅在 pnpm dev 下显示
tags: [security]         # 标识 key，显示名配置于 i18n/taxonomy.yaml
categories: [notes]
summary: 摘要
slug: custom-url         # 可选，默认为目录名
translate: true          # false = 不翻译；或指定语言列表如 [en-US]
glossary:                # 仅作用于本文的术语
  - { zh-Hans: 金丝雀, en-US: canary }
translatorNotes: 语气平实   # 传给 LLM 的翻译提示
menu: 10                 # 仅用于 pages：显示在顶部导航，按数值升序排列
```

扩展语法（基于 `remark-directive`）：

```md
:::note[可选标题]          （note | tip | info | warning | danger | caution）
内容
:::

:::details[摘要]
内容
:::

::::tabs                    外层冒号数量需多于内层
:::tab[pnpm]
:::
::::

:::steps
### 第一步
:::

::figure[图注（随正文一起翻译）]{src="./cover.png"}
::youtube{id="dQw4w9WgXcQ"}
```

支持 `.mdx`；翻译时 JSX、import 语句与表达式会以占位符保护。

### 繁简转换

- 简体原文 → 繁体默认通过 OpenCC `s2twp` 生成；繁体原文（`lang: zh-Hant`）→ 简体默认使用 `tw2sp`（包含词汇转换，如“記憶體”→“内存”），可在 `site.yaml` 中改为仅转字形的 `tw2s`。
- 以繁体作为默认语言时，修改 `site.yaml` 三处配置：

  ```yaml
  defaultLocale: zh-Hant
  locales:
    zh-Hans: { path: zh-hans, label: 简体中文, derive: { from: zh-Hant, opencc: tw2sp } }  # 或 tw2s
    zh-Hant: { path: zh-hant, label: 繁體中文 }
  translate:
    zhPivot: zh-Hant        # 非中文原文先翻译为繁体，再由 OpenCC 派生简体
  ```

  界面文本同理：`i18n/ui/` 中只需维护一个中文变体的完整文件，另一变体自动派生，对应文件中仅需填写覆盖项。
- 行内语法：`-{zh-hans:内存;zh-hant:記憶體;}-` 按变体分别指定；`-{原文}-` 保持原样不转换。
- 全局自定义词对写在 `i18n/glossary.yaml` 的 `opencc:` 下。
- 代码块、行内代码、链接地址与 HTML 标签不进行转换。

## 翻译

各语言内容按以下优先级解析：
**原文 > 手写译文（`index.<locale>.md`） > 已校对/手动编辑过的译文 > 机器译文 > 过期译文（`stale`） > 回退至原文**（显示提示横幅、添加 `noindex`、`canonical` 指向原文，且不计入 sitemap 与搜索索引）。

- 非中文原文仅翻译至 `translate.zhPivot`（默认 `zh-Hans`），另一中文变体由 OpenCC 派生。
- 修改原文后，对应机器译文状态变为 `stale`；手动编辑过的译文（或 front matter 含 `reviewed: true`）不会被自动覆盖，除非使用 `pnpm i18n --force`。
- 删除或重命名文章后，运行 `pnpm i18n` 会清理旧 slug 对应的译文文件和 lock 条目（`--dry-run` 仅列出不删除）。
- `pnpm dev` 模式下，可通过 Astro dev toolbar 的 **Translations** 面板查看当前页状态并触发翻译。
- `i18n/state.lock.yaml` 记录每篇译文对应的原文与输出 hash，**必须与译文文件一并提交**；处理合并冲突时请同时保留双方条目。

### 翻译引擎

在 `site.yaml` 的 `translate.default` 中配置默认引擎，可通过 `overrides` 按语言覆盖，或使用 `pnpm i18n -p <id>` 临时指定：

| ID | 方式 | 环境变量 |
| --- | --- | --- |
| `openai` | 任意 OpenAI 兼容接口（DeepSeek、OpenRouter、OpenAI、Ollama 等），通过 `options.baseURL` 指定地址 | `OPENAI_API_KEY` |
| `gemini` | `@google/genai`，整篇翻译 + 占位符保护 | `GEMINI_API_KEY` |
| `anthropic` | `@anthropic-ai/sdk`，默认 `claude-opus-5-5`，带服务端拒答回退 | `ANTHROPIC_API_KEY` |
| `deepl` | DeepL API v2，按段切分 + XML 标签保护 | `DEEPL_API_KEY` |
| `google` | Cloud Translation Basic v2，按段切分 + HTML 保护 | `GOOGLE_TRANSLATE_API_KEY` |
| `mock` | 离线伪翻译（测试用） | — |

配置示例：

```yaml
translate:
  default: { provider: openai, model: deepseek-flash, options: { baseURL: https://api.deepseek.com } }
  overrides:
    ja: { provider: anthropic }          # 日语单独使用 Claude
```

LLM 引擎会自动注入命中的术语表条目（`i18n/glossary.yaml`）；DeepL 与 Google 仅支持 `dnt: true` 的不翻译词。新增引擎需实现 `TranslationProvider` 接口并在 `cli/translate/providers/index.ts` 中注册。

## 主题

提供四种排版风格（`paper`、`slate`、`ink`、`terminal`，默认 `ink`，在 `site.yaml` 的 `theme.style` 中设置），支持与明暗模式独立切换并保存在 `localStorage`。

包含侧边目录（TOC）、面包屑导航、上下篇链接、标签/分类/归档页，以及各语言的 RSS、sitemap 和 `hreflang`。按 `/` 或 `⌘K` 打开命令面板（Pagefind 全文搜索、最近访问、切换语言与风格）；文章页支持开启“双语对照”，按章节标题并排对齐原文与译文。

顶部导航包含：文章、归档、标签、分类，以及 front matter 中带有 `menu` 字段的独立页面。

## 部署

`.github/workflows/deploy.yml` 使用 GitHub Actions 与 `wrangler pages deploy`（Cloudflare Pages Direct Upload）进行部署。初次配置步骤见[快速开始 · 5](#5-部署到-cloudflare-pages)。

### 工作流行为

| 触发条件 | 翻译 | 部署目标 |
| --- | --- | --- |
| 推送至 `main` | 配置了翻译密钥时：运行 `pnpm i18n`，将新译文以 `github-actions[bot]` 提交并推回仓库 | 生产环境 |
| 同仓库的 PR | 否 | 预览环境：`https://<branch>.<project>.pages.dev` |
| 来自 Fork 的 PR | 否 | 不部署（无权读取 secrets），仅执行构建与测试 |
| 手动触发（`workflow_dispatch`） | 同 push | 所选分支 |

- 自动推回的提交包含 `[skip ci]` 且使用 `GITHUB_TOKEN`，不会触发循环构建。
- 翻译接口报错不会中断部署，对应页面暂时回退显示原文，下次推送时重试。
- 推回译文时若 `main` 分支已有新提交且与 lock 文件冲突，本次跳过推送（输出 warning），下次推送时重新翻译。
- 设置仓库变量 `UNIBLOG_CI_TRANSLATE=false`（**Settings → Secrets and variables → Actions → Variables**）可关闭 CI 自动翻译，仅在本地翻译。
- `pnpm build` 与 `pnpm ship` 检测到 `CI` 或 `CF_PAGES` 环境变量时默认跳过构建期翻译（需强制开启时传 `--translate`）。

### 自定义域名

Cloudflare 控制台 → **Workers & Pages → 你的项目 → Custom domains → Set up a custom domain**。绑定后将 `site.yaml` 中的 `url` 更新为正式域名并提交。

### 本地部署

```bash
pnpm exec wrangler login     # 或在 .env 中填写 CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID
pnpm ship                    # 部署到生产环境
pnpm ship --branch preview   # 部署到预览环境
```

本地 `pnpm ship` 与 CI 部署指向同一个 Cloudflare Pages 项目。

### 常见配置问题

- **默认分支不是 `main`**：同时修改 `.github/workflows/deploy.yml` 的 `on.push.branches` 与 `site.yaml` 的 `deploy.productionBranch`。后者仅在首次创建项目时生效，已有项目需在 Cloudflare 控制台的项目设置中修改。
- **`main` 开启了分支保护 / ruleset**：导致机器人无法推回译文。可将 GitHub Actions 加入 bypass 列表，或设置 `UNIBLOG_CI_TRANSLATE=false` 改为本地翻译。
- **组织仓库推送报 403**：组织策略可能限制了 `GITHUB_TOKEN` 写入权限。在 **Settings → Actions → General → Workflow permissions** 中开启 **Read and write permissions**，或关闭 CI 翻译。
- **Cloudflare Token 报权限错误**：确认权限为 Account 级别的 **Cloudflare Pages · Edit**，且 **Account Resources** 包含 `CLOUDFLARE_ACCOUNT_ID` 对应的账号。

<details>
<summary>改用 Cloudflare Pages 的 Git 集成</summary>

在 Cloudflare 控制台直接连接仓库：Build command 填 `pnpm build`，Output directory 填 `dist`，环境变量添加 `NODE_VERSION=22`。因构建环境包含 `CF_PAGES` 变量，构建时不会自动翻译，需在本地运行 `pnpm i18n` 并提交译文后再推送。

注意：Direct Upload 项目与 Git 集成项目无法互相转换。若使用 Git 集成，请删除 `.github/workflows/deploy.yml`（或不配置 `CLOUDFLARE_API_TOKEN`），且不要对该项目执行 `pnpm ship`。

</details>

## 同步模板更新

通过模板创建的仓库与上游无共同 Git 历史，如需合并后续更新：

```bash
git remote add upstream https://github.com/<template-owner>/uniblog.git
git fetch upstream
git merge upstream/main --allow-unrelated-histories   # 仅首次合并需要此参数
```

冲突通常集中在 `site.yaml`、`content/` 和 `i18n/`，保留本地版本即可。

## 故障排查

- **`! skip … translation file has no lock entry (hand-placed)`**：`i18n/translations/` 下存在译文文件，但 `i18n/state.lock.yaml` 中无对应记录，因此跳过覆盖。常见原因为提交译文时漏交了 `state.lock.yaml`、合并时丢失了 lock 条目、修改了 `site.yaml` 的语言代码，或该文件确为手动添加。运行 `pnpm i18n --force <slug>` 可强制重新翻译并更新 lock。
- **修改 remark/rehype 插件后未生效**：Astro 内容层会缓存渲染结果，删除 `node_modules/.astro` 后重新构建。
- **页面顶部显示“本文暂无 … 版本，以下为 … 原文”横幅**：该语言尚未翻译。在本地运行 `pnpm i18n` 或在 GitHub Secrets 中配置翻译密钥。

## 开发与检查

```bash
pnpm test            # Vitest 单元测试：繁简转换、语法保护、目录生成、翻译流程、lock
pnpm test:e2e        # 端到端测试：临时目录 mock 翻译 → 构建 → 无头 Chromium 验证（可通过 CHROMIUM=路径 指定浏览器）
pnpm check           # astro check 类型检查 + 依赖开源协议白名单检查
```
