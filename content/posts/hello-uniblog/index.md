---
title: 你好，uniblog
date: 2026-11-11T10:00:00Z
lang: zh-Hans
tags: [meta, i18n]
categories: [notes]
summary: 这是一个用 Astro 搭建的多语言博客，源文可以用任何语言撰写。
---

这个博客的源文章放在 `content/` 目录里，翻译结果放在 `i18n/translations/`，两者都进入 Git。

## 写作方式

和 Hugo、Hexo 一样，每篇文章是一个目录（page bundle），图片放在同一个目录下。

```bash
pnpm new my-post --title "我的文章"
```

## 繁简转换

简体源文会通过 OpenCC 自动生成繁体版本，比如“软件”“内存”“鼠标”会被转换成台湾用语。
也可以手动指定：-{zh-hans:服务器;zh-hant:伺服器主機;}-，或者用 -{不转换}- 保持原样。

### 代码不会被转换

`内存` 这样的行内代码以及代码块里的中文都会保持原样。

## 博客的授权

内容采用 CC BY 4.0 授权，代码采用 MIT 授权。
