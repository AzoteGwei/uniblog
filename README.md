# uniblog

本地優先的多語博客模板：Astro 7 + pnpm，開箱部署到 Cloudflare Pages。

- 源文可用任何語言撰寫，其餘語言由可插拔的翻譯引擎（DeepSeek / OpenAI 兼容、Gemini、Claude、DeepL、Google）生成，**譯文進 Git**，可以手改、校對。
- 繁簡由 OpenCC 在建置期派生，支持維基式 `-{…}-` 手動轉換。
- GitHub Actions 自動翻譯、把譯文提交回倉庫、部署到 Cloudflare Pages；PR 自動生成預覽站。
- 四種主題風格 × 明暗模式、命令面板全文搜索（Pagefind）、雙語對照閱讀、每語 RSS / sitemap / hreflang。

授權：

- 代碼：MIT（`LICENSE`）。主題為 clean-room 實現，僅參考 [pgsty/oink](https://github.com/pgsty/oink) 的視覺方向，未使用其代碼。
- 內容與譯文：CC BY 4.0（`content/LICENSE`，範圍見 `REUSE.toml`）。

---

## 從模板開始

需要：Node.js ≥ 22.12、pnpm（`corepack enable` 即可，版本由 `package.json` 的 `packageManager` 指定）、一個 GitHub 帳號；部署需要 Cloudflare 帳號（免費方案即可）。

### 1. 建立自己的倉庫

在 GitHub 上點 **Use this template → Create a new repository**，然後：

```bash
git clone https://github.com/<you>/<your-blog>.git
cd <your-blog>
pnpm install
```

第一次 push 時 Actions 就會運行；在配置 Cloudflare 之前它只建置、不部署，不會報錯。

### 2. 修改站點配置 `site.yaml`

| 欄位 | 說明 |
| --- | --- |
| `title` / `description` | 各語言的站名與簡介；缺少的語言回退到 `defaultLocale` |
| `author` | 頁腳版權署名 |
| `url` | **正式域名**（canonical、sitemap、RSS、hreflang 都依賴它）。還沒有域名就先填 `https://<project>.pages.dev` |
| `defaultLocale` / `locales` | 語言列表與 URL 路徑；以繁體為主見[繁簡轉換](#繁簡轉換) |
| `translate.default` | 翻譯引擎，默認 DeepSeek（OpenAI 兼容接口），見[翻譯](#翻譯) |
| `theme.style` | 默認風格：`paper` / `slate` / `ink` / `terminal`（默認 `ink`） |
| `deploy.project` | Cloudflare Pages 項目名，首次部署時自動創建 |
| `deploy.productionBranch` | 生產分支，默認 `main` |
| `contentLicense` | 文章授權，顯示在頁腳 |

### 3. 換成自己的內容

- `content/posts/hello-world/`：示例文章，演示寫作方式、短代碼和繁簡轉換。看完直接刪掉整個目錄。
- `content/pages/about/index.md`：關於頁，改成自己的介紹。
- `i18n/taxonomy.yaml`：tag / category 的各語顯示名；`i18n/glossary.yaml`：術語表。
- `LICENSE`、`REUSE.toml` 裡的版權人 `Azote` 改成你自己；如果文章不想用 CC BY 4.0，同時改 `content/LICENSE`、`REUSE.toml` 和 `site.yaml` 的 `contentLicense`。

刪除或改名文章後運行一次 `pnpm i18n`，它會順帶清理舊文章留下的譯文和 lock 條目。

### 4. 配置翻譯引擎（本地）

```bash
cp .env.example .env     # 填入 OPENAI_API_KEY（默認引擎 DeepSeek 的 key）
pnpm i18n                # 翻譯所有缺失 / 過期的文章
pnpm dev                 # http://localhost:4321
```

不想用 DeepSeek，就改 `site.yaml` 的 `translate.default` 並在 `.env` 填對應的 key。完全不配置也能用：未翻譯的語言會顯示源文並帶提示橫幅。

### 5. 部署到 Cloudflare Pages

1. **建立 API Token**：Cloudflare 控制台 → My Profile → API Tokens → Create Token → Create Custom Token，權限選 **Account · Cloudflare Pages · Edit**，Account Resources 選你的帳號。
2. **找到 Account ID**：控制台 Workers & Pages 頁面右側欄，或本地運行 `pnpm exec wrangler whoami`。
3. **添加 GitHub Secrets**：倉庫 Settings → Secrets and variables → Actions → New repository secret：

   | Secret | 必需 | 說明 |
   | --- | --- | --- |
   | `CLOUDFLARE_API_TOKEN` | 是 | 第 1 步的 token |
   | `CLOUDFLARE_ACCOUNT_ID` | 是 | 第 2 步的 ID |
   | `OPENAI_API_KEY` | 否 | 配置後 CI 會自動翻譯並提交譯文；其他引擎用對應名字（`GEMINI_API_KEY`、`ANTHROPIC_API_KEY`、`DEEPL_API_KEY`、`GOOGLE_TRANSLATE_API_KEY`） |

4. push 到 `main`。Actions 頁面的 deploy 任務結束後，日誌裡會給出 `https://<project>.pages.dev` 地址（名稱被佔用時 Cloudflare 會加後綴，以日誌為準）。

詳細行為與自定義域名見[部署](#部署)。

### 6. 日常寫作

```bash
pnpm new my-post --title "我的文章"    # 建立草稿 content/posts/my-post/index.md
pnpm dev                               # 邊寫邊看
# 寫完把 draft: true 刪掉或改成 false
git add . && git commit -m "new post" && git push
```

配置了翻譯 key 的話，CI 會翻譯、提交譯文、部署；也可以 push 前在本地 `pnpm i18n`，翻完自己檢查一遍再提交。

---

## 命令

```bash
pnpm new <slug> [--title …] [--lang ja] [--page] [--mdx] [--single]   # 新文章 / 頁面（默認草稿）
pnpm dev                       # 本地預覽；不自動翻譯，只提示缺失 / 過期
pnpm i18n [slug…] [-l en-US] [-p <engine>] [--force] [--dry-run]       # 翻譯缺失 / 過期的文章，清理孤兒譯文
pnpm i18n:status [--check]     # 翻譯狀態矩陣；--check 在有 stale / fallback 時返回非零
pnpm build [--strict]          # 補翻（僅本地）→ astro build → pagefind；--strict 有 stale / fallback 時失敗
pnpm ship [--branch <name>]    # build 後部署到 Cloudflare Pages
pnpm preview                   # 預覽 dist/
```

> `pnpm publish` / `pnpm deploy` 是 pnpm 內建命令，所以發佈命令叫 `pnpm ship`。

## 目錄

```text
site.yaml                 站點配置：語言、路由、翻譯引擎、主題、部署
content/posts/<slug>/     page bundle：index.md(x) + 圖片等資源
content/posts/<slug>/index.en-us.md   可選：人工撰寫的他語版本（優先於機翻）
content/pages/<slug>/     獨立頁面（about 等）
i18n/translations/<locale>/<collection>/<slug>.md   機翻產物（進 Git，可手改）
i18n/state.lock.yaml      翻譯狀態（源文 hash、引擎、輸出 hash）；隨譯文一起提交
i18n/glossary.yaml        術語表 + OpenCC 自定義詞
i18n/ui/*.yaml            界面字串；zh-Hant 由 OpenCC 派生，可在 zh-Hant.yaml 覆寫
i18n/taxonomy.yaml        tag / category 穩定 key → 各語顯示名
public/_headers           Cloudflare Pages 響應頭（安全頭、靜態資源快取）
.github/workflows/deploy.yml   翻譯 → 提交 → 測試 → 部署
.uniblog/                 物化後的內容（gitignored，Astro 只讀這裡）
```

## 寫作

Front matter（Hugo 式語義）：

```yaml
title: 標題
date: 2026-11-11T10:00:00Z
lang: zh-Hans            # 源語言；省略時為 site.yaml 的 defaultLocale
draft: true              # 草稿只在 pnpm dev 中顯示
tags: [security]         # 穩定 key，顯示名見 i18n/taxonomy.yaml
categories: [notes]
summary: 摘要
slug: custom-url         # 可選，默認為目錄名
translate: true          # false = 不翻譯；或列表 [en-US]
glossary:                # 本篇額外術語
  - { zh-Hans: 金丝雀, en-US: canary }
translatorNotes: 語氣輕鬆   # 給 LLM 的提示
menu: 10                 # 僅 pages：出現在頂部導航，數字小者在前
```

Shortcode（remark-directive）：

```md
:::note[可選標題]          （note | tip | info | warning | danger | caution）
內容
:::

:::details[摘要]
:::

::::tabs                    外層冒號要比內層多
:::tab[pnpm]
:::
::::

:::steps
### 第一步
:::

::figure[圖說（會被翻譯）]{src="./cover.png"}
::youtube{id="dQw4w9WgXcQ"}
```

`.mdx` 也可用；翻譯時 JSX / import / 表達式會被佔位符保護。

### 繁簡轉換

- 簡體源文 → 繁體由 OpenCC `s2twp` 生成；繁體源文（`lang: zh-Hant`）→ 簡體默認用 `tw2sp`（含詞彙，如 記憶體→内存），可在 `site.yaml` 改成只轉字形的 `tw2s`。
- 以繁體為主時，`site.yaml` 改三處即可：

  ```yaml
  defaultLocale: zh-Hant
  locales:
    zh-Hans: { path: zh-hans, label: 简体中文, derive: { from: zh-Hant, opencc: tw2sp } }  # 或 tw2s
    zh-Hant: { path: zh-hant, label: 繁體中文 }
  translate:
    zhPivot: zh-Hant        # 日/英源文先機翻成繁體，再 OpenCC 派生簡體
  ```

  界面字串同理：`i18n/ui/` 裡只要有一個中文變體的完整檔案，另一個就自動派生，自己的檔案只需寫覆寫項。
- `-{zh-hans:内存;zh-hant:記憶體;}-` 按變體取值；`-{原樣}-` 不轉換。
- 全局詞對寫在 `i18n/glossary.yaml` 的 `opencc:`。
- 代碼、行內代碼、連結地址、HTML 標籤不轉換。

## 翻譯

狀態優先序：源文 > 人工版本 > 已校對機翻 > 機翻 > 過期機翻 > 回退到源文（顯示橫幅、`noindex`、canonical 指向源文、不進 sitemap 與搜索）。

- 非中文源文只翻譯到 `translate.zhPivot`（默認 zh-Hans），另一中文變體由 OpenCC 派生。
- 改了源文 → `stale`；手改過譯文（或 `reviewed: true`）→ 不會被覆蓋，除非 `pnpm i18n --force`。
- 刪除 / 改名文章後，`pnpm i18n` 會刪除舊 slug 的譯文和 lock 條目（`--dry-run` 只列出）；改名前手改過的譯文可從 Git 歷史找回。
- `pnpm dev` 時，Astro dev toolbar 的 **Translations** 面板可查看並觸發本頁翻譯。
- `i18n/state.lock.yaml` 記錄每篇譯文對應的源文版本，**一定要和譯文一起提交**；合併衝突時不要只保留一邊。

引擎（`site.yaml` 的 `translate.default`，可用 `overrides` 按語言覆寫，或 `pnpm i18n -p <id>` 臨時指定）：

| id | 方式 | 憑證 |
| --- | --- | --- |
| `openai` | 任意 OpenAI-compatible endpoint（DeepSeek、OpenRouter、Ollama…），`options.baseURL` 指定地址 | `OPENAI_API_KEY` |
| `gemini` | `@google/genai`，整篇 + 佔位符 | `GEMINI_API_KEY` |
| `anthropic` | `@anthropic-ai/sdk`，默認 `claude-opus-5-5`，開啟 server-side refusal fallback | `ANTHROPIC_API_KEY` 或 `ant auth login` |
| `deepl` | DeepL v2，逐行 + XML 標籤 | `DEEPL_API_KEY` |
| `google` | Cloud Translation Basic v2，逐行 + HTML | `GOOGLE_TRANSLATE_API_KEY` |
| `mock` | 離線偽翻譯（測試用） | — |

例：

```yaml
translate:
  default: { provider: openai, model: deepseek-flash, options: { baseURL: https://api.deepseek.com } }
  overrides:
    ja: { provider: anthropic }          # 日文單獨用 Claude
```

LLM 引擎使用術語表（只注入命中原文的條目）；DeepL / Google 只支持 `dnt: true` 的不翻譯詞。新引擎實現 `TranslationProvider` 並在 `cli/translate/providers/index.ts` 註冊即可。

## 主題

四種風格（paper / slate / ink / terminal，默認 ink，見 `site.yaml` 的 `theme.style`）與明暗模式獨立切換並記憶；TOC rail、麵包屑、上/下篇、tags / categories / archive、每語 RSS、sitemap、hreflang；`/` 或 ⌘K 打開命令面板（Pagefind 全文搜索、最近訪問、切換語言/風格）；文章頁「雙語對照」按標題逐節並排。

頂部導航：文章、歸檔、標籤、分類，再加上 front matter 帶 `menu` 的獨立頁面。

## 部署

`.github/workflows/deploy.yml` 使用 GitHub Actions + `wrangler pages deploy`（Cloudflare Pages 的 Direct Upload）。配置步驟見[從模板開始 · 5](#5-部署到-cloudflare-pages)。

### 流程

| 觸發 | 翻譯 | 部署到 |
| --- | --- | --- |
| push 到 `main` | 有翻譯 key 時：`pnpm i18n` → 有新譯文就以 `github-actions[bot]` 提交並推回 | 生產環境 |
| 同倉庫的 PR | 否 | 預覽：`https://<branch>.<project>.pages.dev` |
| 來自 fork 的 PR | 否 | 不部署（拿不到 secrets），只建置與測試 |
| 手動（Actions → deploy → Run workflow） | 同 push | 所選分支 |

- 推回的提交帶 `[skip ci]`，且 `GITHUB_TOKEN` 的推送本身不會觸發新的 workflow，不會循環。
- 翻譯失敗不阻斷部署，相應頁面暫時回退到源文，下次 push 重試。
- 推回時若 `main` 已有新提交且與 lock 衝突，本次不推送（只給 warning），下次 push 會重新翻譯。
- 倉庫變量（Settings → Secrets and variables → Actions → Variables）`UNIBLOG_CI_TRANSLATE=false` 可關閉 CI 翻譯，只在本地翻。
- `pnpm build` / `pnpm ship` 偵測到 `CI` 或 `CF_PAGES` 時不做建置期翻譯（結果無處保存），需要時加 `--translate`。

### 自定義域名

Cloudflare 控制台 → Workers & Pages → 你的項目 → Custom domains → Set up a custom domain。綁定後把 `site.yaml` 的 `url` 改成這個域名並提交。

### 從本地部署

```bash
pnpm exec wrangler login     # 或在 .env 填 CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID
pnpm ship                    # 生產
pnpm ship --branch preview   # 預覽
```

本地 `pnpm ship` 與 CI 部署到同一個項目，可以混用。

### 常見設置問題

- **分支不叫 `main`**：同時改 `deploy.yml` 的 `on.push.branches` 和 `site.yaml` 的 `deploy.productionBranch`。後者只在首次創建項目時生效，之後要在 Cloudflare 項目設置裡改。
- **`main` 開了分支保護 / ruleset**：機器人推不回譯文。把 GitHub Actions 加入 bypass 列表，或設 `UNIBLOG_CI_TRANSLATE=false` 改為本地翻譯。
- **組織倉庫推送失敗（403）**：組織策略可能禁止 `GITHUB_TOKEN` 寫入；在組織 Settings → Actions → General → Workflow permissions 放開，或關閉 CI 翻譯。
- **Token 報權限錯誤**：確認權限是 Account 級的 Cloudflare Pages · Edit，且 Account Resources 包含 `CLOUDFLARE_ACCOUNT_ID` 對應的帳號。

<details>
<summary>改用 Cloudflare Pages 的 Git 集成</summary>

在 Cloudflare 控制台連接倉庫：Build command `pnpm build`，Output directory `dist`，環境變量 `NODE_VERSION=22`。建置時不會翻譯（偵測到 `CF_PAGES`），譯文需在本地 `pnpm i18n` 後提交。

注意：Git 集成項目與 Direct Upload 項目不能互轉。選了 Git 集成就刪掉 `deploy.yml` 或不配置 `CLOUDFLARE_API_TOKEN`，也不要再對該項目用 `pnpm ship`。

</details>

## 跟進模板更新

用模板建立的倉庫與本倉庫沒有 fork 關係，不會自動同步。需要時手動合併：

```bash
git remote add upstream https://github.com/<template-owner>/uniblog.git
git fetch upstream
git merge upstream/main --allow-unrelated-histories   # 第一次需要這個參數
```

衝突通常集中在 `site.yaml`、`content/`、`i18n/`，保留你自己的版本即可。

## 疑難排解

- **`! skip … translation file has no lock entry (hand-placed)`**：譯文檔案存在，但 lock 裡沒有它的記錄，所以不敢覆蓋。常見原因：譯文提交了但 `state.lock.yaml` 沒提交 / 合併時丟了條目；改了 `site.yaml` 裡的語言代碼（lock 按代碼記錄，檔案按路徑查找）；或者真的是手放的檔案。用 `pnpm i18n --force <slug>` 重新翻譯並寫入 lock。
- **修改 remark/rehype 插件後輸出沒變**：Astro 的內容層會快取渲染結果，刪除 `node_modules/.astro` 再建置。
- **頁面顯示「本文暫無 … 版本，以下為 … 原文」橫幅**：該語言還沒翻譯，運行 `pnpm i18n` 或在 GitHub Secrets 配置翻譯 key。

## 開發與檢查

```bash
pnpm test            # vitest：轉換、保護、物化、翻譯管線、lock
pnpm test:e2e        # 臨時目錄 mock 翻譯 → 建置 → headless Chromium 驗證（需要本機 Chromium，或設 CHROMIUM=路徑）
pnpm check           # astro check + 依賴授權白名單
```
