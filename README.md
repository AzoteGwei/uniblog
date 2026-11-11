# uniblog

本地優先的多語博客：Astro 7 + pnpm。源文可用任何語言撰寫，其餘語言由可插拔的翻譯引擎生成並進 Git；繁簡由 OpenCC 在建置期派生，支持維基式 `-{…}-` 手動轉換。

- 代碼：MIT（`LICENSE`）。主題為 clean-room 實現，僅參考 [pgsty/oink](https://github.com/pgsty/oink) 的視覺方向，未使用其代碼。
- 內容與譯文：CC BY 4.0（`content/LICENSE`，範圍見 `REUSE.toml`）。

## 快速開始

```bash
pnpm install
cp .env.example .env          # 填入要用的翻譯引擎 key
pnpm new my-post --title "我的文章"            # content/posts/my-post/index.md
pnpm new kotoba --lang ja                      # 日文源文
pnpm dev                       # 本地預覽；不自動翻譯，只提示 stale
pnpm i18n                      # 翻譯缺失 / 過期的文章
pnpm build                     # 補翻 stale → astro build → pagefind
pnpm ship                      # build 後 wrangler pages deploy（Cloudflare Pages）
```

> `pnpm publish` / `pnpm deploy` 是 pnpm 內建命令，所以發佈命令叫 `pnpm ship`。

## 目錄

```text
site.yaml                 站點配置：語言、路由、翻譯引擎、主題、部署
content/posts/<slug>/     page bundle：index.md(x) + 圖片等資源
content/posts/<slug>/index.en-us.md   可選：人工撰寫的他語版本（優先於機翻）
content/pages/<slug>/     獨立頁面（about 等）
i18n/translations/<locale>/<collection>/<slug>.md   機翻產物（進 Git，可手改）
i18n/state.lock.yaml      翻譯狀態（源文 hash、引擎、輸出 hash）
i18n/glossary.yaml        術語表 + OpenCC 自定義詞
i18n/ui/*.yaml            界面字串；zh-Hant 由 OpenCC 派生，可在 zh-Hant.yaml 覆寫
i18n/taxonomy.yaml        tag / category 穩定 key → 各語顯示名
.uniblog/                   物化後的內容（gitignored，Astro 只讀這裡）
```

## 寫作

Front matter（Hugo 式語義）：

```yaml
title: 標題
date: 2026-11-11T10:00:00Z
lang: zh-Hans            # 源語言；省略時為 site.yaml 的 defaultLocale
draft: true
tags: [security]         # 穩定 key，顯示名見 i18n/taxonomy.yaml
categories: [notes]
summary: 摘要
slug: custom-url         # 可選
translate: true          # false = 不翻譯；或列表 [en-US]
glossary:                # 本篇額外術語
  - { zh-Hans: 金丝雀, en-US: canary }
translatorNotes: 語氣輕鬆   # 給 LLM 的提示
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
- `pnpm i18n:status` 查看矩陣；`--check` 有 stale / fallback 時返回非零。
- `pnpm dev` 時，Astro dev toolbar 的 **Translations** 面板可查看並觸發本頁翻譯。

引擎（`site.yaml` 的 `translate.default`，可用 `overrides` 按語言覆寫，或 `pnpm i18n -p <id>` 臨時指定）：

| id | 方式 | 憑證 |
| --- | --- | --- |
| `gemini` | `@google/genai`，整篇 + 佔位符 | `GEMINI_API_KEY` |
| `anthropic` | `@anthropic-ai/sdk`，默認 `claude-opus-5-5`，開啟 server-side refusal fallback | `ANTHROPIC_API_KEY` 或 `ant auth login` |
| `openai` | 任意 OpenAI-compatible endpoint（DeepSeek、OpenRouter、Ollama…） | `OPENAI_API_KEY`，`options.baseURL` |
| `deepl` | DeepL v2，逐行 + XML 標籤 | `DEEPL_API_KEY` |
| `google` | Cloud Translation Basic v2，逐行 + HTML | `GOOGLE_TRANSLATE_API_KEY` |
| `mock` | 離線偽翻譯（測試用） | — |

LLM 引擎使用術語表（只注入命中原文的條目）；DeepL / Google 只支持 `dnt: true` 的不翻譯詞。新引擎實現 `TranslationProvider` 並在 `cli/translate/providers/index.ts` 註冊即可。

## 主題

四種風格（paper / slate / ink / terminal）與明暗模式獨立切換並記憶；TOC rail、麵包屑、上/下篇、tags / categories / archive、每語 RSS、sitemap、hreflang；`/` 或 ⌘K 打開命令面板（Pagefind 全文搜索、最近訪問、切換語言/風格）；文章頁「雙語對照」按標題逐節並排。

## 檢查

```bash
pnpm test            # vitest：轉換、保護、物化、翻譯管線
pnpm test:e2e        # 臨時目錄 mock 翻譯 → 建置 → headless Chromium 驗證
pnpm check           # astro check + 依賴授權白名單
```

注意：Astro 的內容層會快取渲染結果；修改 remark/rehype 插件後如輸出未變，刪除 `node_modules/.astro` 再建置。
