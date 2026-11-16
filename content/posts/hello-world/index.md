---
title: Hello World
date: 2026-11-13T00:00:00Z
lang: zh-Hans
tags: [meta, i18n]
categories: [notes]
summary: 欢迎使用 uniblog。本文简要介绍文章创建、扩展语法与繁简转换的用法，阅读后可直接删除。
---

欢迎使用 uniblog。本文是默认生成的示例文章，用于演示写作流程、扩展语法与繁简转换。

源文章存放在 `content/` 目录下，生成的译文存放在 `i18n/translations/`，两者均纳入 Git 版本控制。如需移除本文，删除 `content/posts/hello-world/` 目录并运行 `pnpm i18n` 即可。

## 快速开始

每篇文章默认采用目录结构（Page Bundle），正文为 `index.md`，同目录下的图片等资源会随文章一起打包。

:::steps
### 创建新文章

```bash
pnpm new my-post --title "我的新文章"
```

生成的文章位于 `content/posts/my-post/index.md`，默认带有 `draft: true`。

### 启动本地预览

```bash
pnpm dev
```

在浏览器访问 `http://localhost:4321` 即可预览（包含草稿文章）。

### 翻译与发布

```bash
pnpm i18n
```

将 front matter 中的 `draft: true` 删除或改为 `false`，提交代码并推送到 GitHub。若在 CI 中配置了翻译密钥，也可直接推送，由 GitHub Actions 自动执行翻译与部署。
:::

## 扩展语法

支持基于 `remark-directive` 的块级与行内指令（普通正文中的 `16:9` 等冒号不受影响）。

提示框支持 `note`、`tip`、`info`、`warning`、`danger`：

:::note
省略标题时，使用当前语言的默认标题。
:::

:::warning[自定义标题]
排查问题时注意连接池与**内存**占用。
:::

折叠块与选项卡：

:::details[查看目录说明]
构建时，源文章与各语言译文会生成至 `.uniblog/` 目录，随后由 Astro 构建静态页面并生成 Pagefind 搜索索引。
:::

::::tabs
:::tab[pnpm]
```bash
pnpm i18n
pnpm build
```
:::
:::tab[tsx]
```bash
pnpm exec tsx cli/index.ts status
```
:::
::::

## 图片引用

将图片放在文章同目录下，使用相对路径引用，构建时会自动转换为 WebP 格式：

::figure[同目录下的示例图片（图注随正文一起翻译）]{src="./cover.png"}

## 繁简转换

简体原文在构建时通过 OpenCC（`s2twp`）自动生成繁体页面，“博客”、“软件”、“内存”、“鼠标”等词汇会转换为台湾常用词。

如需手动指定转换规则，可使用维基百科风格的转换语法：

- 按简繁分别指定：`-{zh-hans:服务器;zh-hant:伺服器主機;}-`（渲染结果：-{zh-hans:服务器;zh-hant:伺服器主機;}-）
- 保持原样不转换：`-{不转换文本}-`（渲染结果：-{不转换文本}-）

### 代码保护

行内代码（如 `内存`）、代码块及链接地址在繁简转换与机器翻译时均保持原样。

## 许可协议

代码采用 MIT 协议，文章内容与译文默认采用 CC BY 4.0 协议。
