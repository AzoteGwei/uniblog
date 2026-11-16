# uniblog

[English](./README.md) | [简体中文](./README.zh-Hans.md) | 繁體中文

基於 Astro 7 與 pnpm 的多語系部落格範本，預設配置 Cloudflare Pages 部署。

- 原文可使用任意語言撰寫，其餘語言透過可插拔的翻譯介面（DeepSeek / OpenAI 相容介面、Gemini、Claude、DeepL、Google Translate）產生。譯文存放於 `i18n/translations/` 並納入 Git 版本控制，可直接手動修改與校對。
- 繁簡版本由 OpenCC 在建置時轉換產生，支援維基百科風格的 `-{…}-` 行內轉換語法與自訂詞表。
- GitHub Actions 自動執行翻譯、將譯文提交回儲存庫並部署至 Cloudflare Pages；Pull Request 自動產生預覽環境。
- 內建四種主題風格（`paper`、`slate`、`ink`、`terminal`）與深淺色模式、Pagefind 全文搜尋（`/` 或 `⌘K`）、雙語對照閱讀，以及依語言產生的 RSS、sitemap 與 `hreflang`。

**授權條款**

- **程式碼**：MIT（[`LICENSE`](./LICENSE)）。主題為 clean-room 實作，僅參考 [pgsty/oink](https://github.com/pgsty/oink) 的視覺方向，未使用其程式碼。
- **內容與譯文**：CC BY 4.0（[`content/LICENSE`](./content/LICENSE)，路徑範圍見 [`REUSE.toml`](./REUSE.toml)）。

---

## 快速開始

**環境需求**：Node.js ≥ 22.12、pnpm（執行 `corepack enable` 啟用，版本由 `package.json` 的 `packageManager` 欄位指定）、GitHub 帳號，部署需 Cloudflare 帳號。

### 1. 建立儲存庫

在 GitHub 上點選 **Use this template → Create a new repository**，然後 clone 到本機：

```bash
git clone https://github.com/<you>/<your-blog>.git
cd <your-blog>
pnpm install
```

首次推送時 GitHub Actions 即會執行；未設定 Cloudflare 憑證前僅執行建置與測試，跳過部署步驟。

### 2. 設定 `site.yaml`

| 欄位 | 說明 |
| --- | --- |
| `title` / `description` | 各語言的網站標題與簡介；缺省時退回使用 `defaultLocale` |
| `author` | 頁尾版權署名 |
| `url` | 正式網域（用於產生 canonical、sitemap、RSS 與 `hreflang`）。未綁定自訂網域時可先填 `https://<project>.pages.dev` |
| `defaultLocale` / `locales` | 語言列表與 URL 路徑前綴；以繁體中文為主的設定方式見[繁簡轉換](#繁簡轉換) |
| `translate.default` | 預設翻譯引擎，預設為 DeepSeek（OpenAI 相容介面），詳見[翻譯](#翻譯) |
| `theme.style` | 預設主題風格：`paper` / `slate` / `ink` / `terminal`（預設 `ink`） |
| `deploy.project` | Cloudflare Pages 專案名稱，首次部署時自動建立 |
| `deploy.productionBranch` | 正式環境分支，預設 `main` |
| `contentLicense` | 頁尾顯示的內容授權條款 |

### 3. 替換範例內容

- `content/posts/hello-world/`：範例文章，示範目錄結構、擴充語法與繁簡轉換。閱後可直接刪除該目錄。
- `content/pages/about/index.md`：關於頁面。
- `i18n/taxonomy.yaml`：標籤（tags）與分類（categories）的各語言顯示名稱。
- `i18n/glossary.yaml`：翻譯術語表與 OpenCC 自訂詞對。
- 將 `LICENSE`、`REUSE.toml` 中的版權人 `Azote` 改為你的署名；如需更換內容授權條款，同步修改 `content/LICENSE`、`REUSE.toml` 及 `site.yaml` 的 `contentLicense`。

刪除或重新命名文章後，執行一次 `pnpm i18n` 以清理殘留的舊譯文檔案與 lock 記錄。

### 4. 設定本機翻譯

```bash
cp .env.example .env     # 填入 OPENAI_API_KEY（預設 DeepSeek 引擎使用）
pnpm i18n                # 翻譯缺失或已過期的文章
pnpm dev                 # 啟動本機預覽 http://localhost:4321
```

如需更換翻譯引擎，修改 `site.yaml` 的 `translate.default` 並在 `.env` 中填入對應金鑰。未設定金鑰時亦可正常開發與建置，未翻譯的語言頁面會顯示原文並附帶提示橫幅。

### 5. 部署至 Cloudflare Pages

1. **建立 API Token**：Cloudflare 控制台 → **My Profile → API Tokens → Create Token → Create Custom Token**，權限選擇 **Account · Cloudflare Pages · Edit**，**Account Resources** 選擇對應帳號。
2. **取得 Account ID**：在控制台 **Workers & Pages** 頁面右側欄查看，或在本機執行 `pnpm exec wrangler whoami`。
3. **新增 GitHub Secrets**：儲存庫 **Settings → Secrets and variables → Actions → New repository secret**：

   | Secret | 必需 | 說明 |
   | --- | --- | --- |
   | `CLOUDFLARE_API_TOKEN` | 是 | 第 1 步建立的 Token |
   | `CLOUDFLARE_ACCOUNT_ID` | 是 | 第 2 步取得的 Account ID |
   | `OPENAI_API_KEY` | 否 | 設定後 CI 會自動翻譯並提交譯文；其他引擎使用對應變數名稱（`GEMINI_API_KEY`、`ANTHROPIC_API_KEY`、`DEEPL_API_KEY`、`GOOGLE_TRANSLATE_API_KEY`） |

4. 推送至 `main` 分支。Actions 中的 `deploy` 工作完成後，建置日誌會輸出 `https://<project>.pages.dev` 網址（若名稱已被使用，Cloudflare 會自動加上後綴，以日誌輸出為準）。

自訂網域與 CI 詳情見[部署](#部署)。

### 6. 日常寫作

```bash
pnpm new my-post --title "文章標題"    # 建立草稿 content/posts/my-post/index.md
pnpm dev                               # 本機預覽
# 發佈前將 draft: true 刪除或改為 false
git add . && git commit -m "new post" && git push
```

若設定了翻譯金鑰，CI 會自動翻譯、提交譯文並部署；也可在推送前先在本機執行 `pnpm i18n`，檢查或修改譯文後再一併提交。

---

## 指令說明

```bash
pnpm new <slug> [--title …] [--lang ja] [--page] [--mdx] [--single]   # 建立文章或頁面（預設為草稿）
pnpm dev                       # 啟動本機開發伺服器（不自動執行翻譯）
pnpm i18n [slug…] [-l en-US] [-p <engine>] [--force] [--dry-run]       # 翻譯缺失/過期的文章，清理已刪除文章的譯文
pnpm i18n:status [--check]     # 查看翻譯狀態表；--check 在存在 stale / fallback 時回傳非零結束碼
pnpm build [--strict]          # 補齊翻譯（僅本機）→ astro build → pagefind；--strict 在存在 stale / fallback 時報錯結束
pnpm ship [--branch <name>]    # 建置並部署至 Cloudflare Pages
pnpm preview                   # 本機預覽 dist/
```

> `pnpm publish` 與 `pnpm deploy` 為 pnpm 內建指令，因此部署指令命名為 `pnpm ship`。

## 目錄結構

```text
site.yaml                 網站設定：語言、路由、翻譯引擎、主題、部署
content/posts/<slug>/     文章目錄（Page Bundle）：index.md(x) 及同目錄圖片等資源
content/posts/<slug>/index.en-us.md   選用：手寫的其他語言版本（優先順序高於機器翻譯）
content/pages/<slug>/     獨立頁面（如 about）
i18n/translations/<locale>/<collection>/<slug>.md   機器翻譯檔案（納入 Git，可手動編輯）
i18n/state.lock.yaml      翻譯狀態記錄（原文 hash、引擎、輸出 hash），需與譯文一併提交
i18n/glossary.yaml        術語表與 OpenCC 自訂詞對
i18n/ui/*.yaml            介面文字；zh-Hant 由 OpenCC 派生，可在 zh-Hant.yaml 中覆寫
i18n/taxonomy.yaml        tag / category 識別 key 與各語言顯示名稱的對應
public/_headers           Cloudflare Pages 回應標頭（安全標頭、靜態資源快取）
.github/workflows/deploy.yml   CI 工作流程：翻譯 → 提交 → 測試 → 部署
.uniblog/                 建置時產生的各語言內容目錄（gitignored，供 Astro 讀取）
```

## 寫作

Front matter（採用 Hugo 慣例）：

```yaml
title: 標題
date: 2026-11-11T10:00:00Z
lang: zh-Hans            # 原文語言；省略時使用 site.yaml 的 defaultLocale
draft: true              # 草稿僅在 pnpm dev 下顯示
tags: [security]         # 識別 key，顯示名稱設定於 i18n/taxonomy.yaml
categories: [notes]
summary: 摘要
slug: custom-url         # 選用，預設為目錄名稱
translate: true          # false = 不翻譯；或指定語言列表如 [en-US]
glossary:                # 僅作用於本文的術語
  - { zh-Hans: 金丝雀, en-US: canary }
translatorNotes: 語氣平實   # 傳給 LLM 的翻譯提示
menu: 10                 # 僅用於 pages：顯示在頂部導覽列，依數值遞增排列
```

擴充語法（基於 `remark-directive`）：

```md
:::note[選用標題]          （note | tip | info | warning | danger | caution）
內容
:::

:::details[摘要]
內容
:::

::::tabs                    外層冒號數量需多於內層
:::tab[pnpm]
:::
::::

:::steps
### 第一步
:::

::figure[圖說（隨內文一起翻譯）]{src="./cover.png"}
::youtube{id="dQw4w9WgXcQ"}
```

支援 `.mdx`；翻譯時 JSX、import 敘述與運算式會以佔位符保護。

### 繁簡轉換

- 簡體原文 → 繁體預設透過 OpenCC `s2twp` 產生；繁體原文（`lang: zh-Hant`）→ 簡體預設使用 `tw2sp`（包含詞彙轉換，如「記憶體」→「内存」），可在 `site.yaml` 中改為僅轉字形的 `tw2s`。
- 以繁體作為預設語言時，修改 `site.yaml` 三處設定：

  ```yaml
  defaultLocale: zh-Hant
  locales:
    zh-Hans: { path: zh-hans, label: 简体中文, derive: { from: zh-Hant, opencc: tw2sp } }  # 或 tw2s
    zh-Hant: { path: zh-hant, label: 繁體中文 }
  translate:
    zhPivot: zh-Hant        # 非中文原文先翻譯為繁體，再由 OpenCC 派生簡體
  ```

  介面文字同理：`i18n/ui/` 中只需維護一個中文變體的完整檔案，另一變體自動派生，對應檔案中僅需填寫覆寫項目。
- 行內語法：`-{zh-hans:内存;zh-hant:記憶體;}-` 依變體分別指定；`-{原文}-` 保持原樣不轉換。
- 全域自訂詞對寫在 `i18n/glossary.yaml` 的 `opencc:` 下。
- 程式碼區塊、行內程式碼、連結網址與 HTML 標籤不進行轉換。

## 翻譯

各語言內容依以下優先順序解析：
**原文 > 手寫譯文（`index.<locale>.md`） > 已校對/手動編輯過的譯文 > 機器譯文 > 過期譯文（`stale`） > 退回至原文**（顯示提示橫幅、加上 `noindex`、`canonical` 指向原文，且不列入 sitemap 與搜尋索引）。

- 非中文原文僅翻譯至 `translate.zhPivot`（預設 `zh-Hans`），另一中文變體由 OpenCC 派生。
- 修改原文後，對應機器譯文狀態變為 `stale`；手動編輯過的譯文（或 front matter 含 `reviewed: true`）不會被自動覆蓋，除非使用 `pnpm i18n --force`。
- 刪除或重新命名文章後，執行 `pnpm i18n` 會清理舊 slug 對應的譯文檔案與 lock 項目（`--dry-run` 僅列出不刪除）。
- `pnpm dev` 模式下，可透過 Astro dev toolbar 的 **Translations** 面板查看目前頁面狀態並觸發翻譯。
- `i18n/state.lock.yaml` 記錄每篇譯文對應的原文與輸出 hash，**必須與譯文檔案一併提交**；處理合併衝突時請同時保留雙方項目。

### 翻譯引擎

在 `site.yaml` 的 `translate.default` 中設定預設引擎，可透過 `overrides` 依語言覆寫，或使用 `pnpm i18n -p <id>` 臨時指定：

| ID | 方式 | 環境變數 |
| --- | --- | --- |
| `openai` | 任意 OpenAI 相容介面（DeepSeek、OpenRouter、OpenAI、Ollama 等），透過 `options.baseURL` 指定端點 | `OPENAI_API_KEY` |
| `gemini` | `@google/genai`，整篇翻譯 + 佔位符保護 | `GEMINI_API_KEY` |
| `anthropic` | `@anthropic-ai/sdk`，預設 `claude-opus-5-5`，附帶伺服器端拒答退回處理 | `ANTHROPIC_API_KEY` |
| `deepl` | DeepL API v2，逐段切分 + XML 標籤保護 | `DEEPL_API_KEY` |
| `google` | Cloud Translation Basic v2，逐段切分 + HTML 保護 | `GOOGLE_TRANSLATE_API_KEY` |
| `mock` | 離線偽翻譯（測試用） | — |

設定範例：

```yaml
translate:
  default: { provider: openai, model: deepseek-flash, options: { baseURL: https://api.deepseek.com } }
  overrides:
    ja: { provider: anthropic }          # 日文單獨使用 Claude
```

LLM 引擎會自動注入命中的術語表項目（`i18n/glossary.yaml`）；DeepL 與 Google 僅支援 `dnt: true` 的不翻譯詞。新增引擎需實作 `TranslationProvider` 介面並在 `cli/translate/providers/index.ts` 中註冊。

## 主題

提供四種排版風格（`paper`、`slate`、`ink`、`terminal`，預設 `ink`，於 `site.yaml` 的 `theme.style` 設定），支援與深淺色模式獨立切換並儲存於 `localStorage`。

包含側邊目錄（TOC）、麵包屑導覽、上下篇連結、標籤/分類/歸檔頁，以及各語言的 RSS、sitemap 與 `hreflang`。按 `/` 或 `⌘K` 開啟命令面板（Pagefind 全文搜尋、最近瀏覽、切換語言與風格）；文章頁支援開啟「雙語對照」，依章節標題並排對齊原文與譯文。

頂部導覽列包含：文章、歸檔、標籤、分類，以及 front matter 中帶有 `menu` 欄位的獨立頁面。

## 部署

`.github/workflows/deploy.yml` 使用 GitHub Actions 與 `wrangler pages deploy`（Cloudflare Pages Direct Upload）進行部署。初次設定步驟見[快速開始 · 5](#5-部署至-cloudflare-pages)。

### 工作流程行為

| 觸發條件 | 翻譯 | 部署目標 |
| --- | --- | --- |
| 推送至 `main` | 設定了翻譯金鑰時：執行 `pnpm i18n`，將新譯文以 `github-actions[bot]` 提交並推回儲存庫 | 正式環境 |
| 同儲存庫的 PR | 否 | 預覽環境：`https://<branch>.<project>.pages.dev` |
| 來自 Fork 的 PR | 否 | 不部署（無權讀取 secrets），僅執行建置與測試 |
| 手動觸發（`workflow_dispatch`） | 同 push | 所選分支 |

- 自動推回的提交包含 `[skip ci]` 且使用 `GITHUB_TOKEN`，不會觸發循環建置。
- 翻譯介面報錯不會中斷部署，對應頁面暫時退回顯示原文，下次推送時重試。
- 推回譯文時若 `main` 分支已有新提交且與 lock 檔案衝突，本次跳過推送（輸出 warning），下次推送時重新翻譯。
- 設定儲存庫變數 `UNIBLOG_CI_TRANSLATE=false`（**Settings → Secrets and variables → Actions → Variables**）可關閉 CI 自動翻譯，僅在本機翻譯。
- `pnpm build` 與 `pnpm ship` 偵測到 `CI` 或 `CF_PAGES` 環境變數時預設跳過建置期翻譯（需強制開啟時傳入 `--translate`）。

### 自訂網域

Cloudflare 控制台 → **Workers & Pages → 你的專案 → Custom domains → Set up a custom domain**。綁定後將 `site.yaml` 中的 `url` 更新為正式網域並提交。

### 本機部署

```bash
pnpm exec wrangler login     # 或在 .env 中填寫 CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID
pnpm ship                    # 部署至正式環境
pnpm ship --branch preview   # 部署至預覽環境
```

本機 `pnpm ship` 與 CI 部署指向同一個 Cloudflare Pages 專案。

### 常見設定問題

- **預設分支不是 `main`**：同時修改 `.github/workflows/deploy.yml` 的 `on.push.branches` 與 `site.yaml` 的 `deploy.productionBranch`。後者僅在首次建立專案時生效，既有專案需在 Cloudflare 控制台的專案設定中修改。
- **`main` 開啟了分支保護 / ruleset**：導致機器人無法推回譯文。可將 GitHub Actions 加入 bypass 清單，或設定 `UNIBLOG_CI_TRANSLATE=false` 改為本機翻譯。
- **組織儲存庫推送報 403**：組織原則可能限制了 `GITHUB_TOKEN` 寫入權限。在 **Settings → Actions → General → Workflow permissions** 中開啟 **Read and write permissions**，或關閉 CI 翻譯。
- **Cloudflare Token 報權限錯誤**：確認權限為 Account 層級的 **Cloudflare Pages · Edit**，且 **Account Resources** 包含 `CLOUDFLARE_ACCOUNT_ID` 對應的帳號。

<details>
<summary>改用 Cloudflare Pages 的 Git 整合</summary>

在 Cloudflare 控制台直接連結儲存庫：Build command 填 `pnpm build`，Output directory 填 `dist`，環境變數新增 `NODE_VERSION=22`。因建置環境包含 `CF_PAGES` 變數，建置時不會自動翻譯，需在本機執行 `pnpm i18n` 並提交譯文後再推送。

注意：Direct Upload 專案與 Git 整合專案無法互相轉換。若使用 Git 整合，請刪除 `.github/workflows/deploy.yml`（或不設定 `CLOUDFLARE_API_TOKEN`），且不要對該專案執行 `pnpm ship`。

</details>

## 同步範本更新

透過範本建立的儲存庫與上游無共同 Git 歷史，如需合併後續更新：

```bash
git remote add upstream https://github.com/<template-owner>/uniblog.git
git fetch upstream
git merge upstream/main --allow-unrelated-histories   # 僅首次合併需要此參數
```

衝突通常集中在 `site.yaml`、`content/` 與 `i18n/`，保留本機版本即可。

## 疑難排解

- **`! skip … translation file has no lock entry (hand-placed)`**：`i18n/translations/` 下存在譯文檔案，但 `i18n/state.lock.yaml` 中無對應記錄，因此跳過覆蓋。常見原因為提交譯文時漏交了 `state.lock.yaml`、合併時遺失了 lock 項目、修改了 `site.yaml` 的語言代碼（locale code），或該檔案確為手動新增。執行 `pnpm i18n --force <slug>` 可強制重新翻譯並更新 lock。
- **修改 remark/rehype 外掛後未生效**：Astro 內容層會快取渲染結果，刪除 `node_modules/.astro` 後重新建置。
- **頁面頂部顯示「本文暫無 … 版本，以下為 … 原文」橫幅**：該語言尚未翻譯。在本機執行 `pnpm i18n` 或在 GitHub Secrets 中設定翻譯金鑰。

## 開發與檢查

```bash
pnpm test            # Vitest 單元測試：繁簡轉換、語法保護、目錄產生、翻譯流程、lock
pnpm test:e2e        # 端對端測試：暫存目錄 mock 翻譯 → 建置 → 無頭 Chromium 驗證（可透過 CHROMIUM=路徑 指定瀏覽器）
pnpm check           # astro check 型別檢查 + 相依套件開源授權白名單檢查
```
