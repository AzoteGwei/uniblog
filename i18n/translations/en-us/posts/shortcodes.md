---
title: Shortcode Examples
summary: Hugo-style shortcodes implemented with Markdown directive syntax.
---

An ordinary paragraph with a 16:9 aspect ratio won't be mistaken for a directive.

:::note
This is a note.
:::

:::warning[Custom title]
Watch out for **memory** leaks.
:::

:::details[Click to expand]
Hidden content.
:::

## Tabs

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

## Steps

:::steps
### Install dependencies

Run `pnpm install`.

### Write a post

Run `pnpm new`.
:::

## Images

::figure[Image from the page bundle]{src="./cover.png"}

![Markdown image](./cover.png)
