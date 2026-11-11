---
title: 短代码示例
date: 2026-11-08T08:00:00Z
lang: zh-Hans
tags: [meta]
categories: [notes]
summary: 用 Markdown 指令语法实现的 Hugo 式短代码。
---

普通段落，比例 16:9 不会被误认为指令。

:::note
这是一个注意事项。
:::

:::warning[自定义标题]
小心**内存**泄漏。
:::

:::details[点击展开]
隐藏的内容。
:::

## 选项卡

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

## 步骤

:::steps
### 安装依赖

运行 `pnpm install`。

### 写文章

运行 `pnpm new`。
:::

## 图片

::figure{src="./cover.png" alt="封面" caption="页面包里的图片"}

![Markdown 图片](./cover.png)
