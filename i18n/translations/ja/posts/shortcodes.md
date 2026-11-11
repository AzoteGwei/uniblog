---
title: ショートコードの例
summary: Markdown ディレクティブ構文で実装された Hugo 風ショートコード。
---

通常の段落では、16:9 の比率がディレクティブと誤認されることはありません。

:::note
これは注意事項です。
:::

:::warning[カスタムタイトル]
**メモリ**リークに注意してください。
:::

:::details[クリックで展開]
隠されている内容。
:::

## タブ

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

## 手順

:::steps
### 依存関係のインストール

`pnpm install` を実行します。

### 記事を書く

`pnpm new` を実行します。
:::

## 画像

::figure[ページバンドル内の画像]{src="./cover.png"}

![Markdown 画像](./cover.png)
