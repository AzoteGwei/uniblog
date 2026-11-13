---
title: Hello World
date: 2026-11-13T00:00:00Z
lang: zh-Hans
tags: [meta, i18n]
categories: [notes]
summary: 欢迎使用 uniblog。这是第一篇示例文章，演示写作方式、短代码和繁简转换；读完就可以删掉它。
---

欢迎使用 uniblog！这是一篇示例文章。源文章放在 `content/` 目录里，机器翻译的结果放在 `i18n/translations/`，两者都进入 Git。

:::tip[读完就删]
删除 `content/posts/hello-world/` 这个目录，然后运行 `pnpm i18n` 清理即可开始写自己的博客。
:::

## 写一篇新文章

和 Hugo、Hexo 一样，每篇文章是一个目录（page bundle），图片放在同一个目录下。

:::steps
### 创建文章

```bash
pnpm new my-post --title "我的文章"
```

### 本地预览

运行 `pnpm dev`，在浏览器里打开 `http://localhost:4321`。新文章默认是草稿（`draft: true`），只在本地显示。

### 翻译并发布

运行 `pnpm i18n` 生成其他语言的版本，把 `draft` 改成 `false`，然后提交并推送到 GitHub。
:::

## 短代码

用 Markdown 指令语法实现 Hugo 式短代码，普通段落里的 16:9 不会被误认为指令。

:::note
这是一个注意事项。
:::

:::warning[自定义标题]
小心**内存**泄漏。
:::

:::details[点击展开]
隐藏的内容。
:::

::::tabs
:::tab[pnpm]
```bash
pnpm add astro
```
:::
:::tab[npm]
```bash
npm i astro
```
:::
::::

## 图片

图片和文章放在同一个目录，构建时会自动优化。

::figure[页面包里的图片]{src="./cover.png"}

## 繁简转换

简体源文会通过 OpenCC 自动生成繁体版本，比如“博客”“软件”“内存”“鼠标”会被转换成台湾用语。
也可以手动指定：-{zh-hans:服务器;zh-hant:伺服器主機;}-，或者用 -{不转换}- 保持原样。

### 代码不会被转换

`内存` 这样的行内代码以及代码块里的中文都会保持原样。

## 授权

内容采用 CC BY 4.0 授权，代码采用 MIT 授权。
