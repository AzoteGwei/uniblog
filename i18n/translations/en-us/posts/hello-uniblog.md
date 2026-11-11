---
title: Hello, uniblog
summary: This is a multilingual blog built with Astro; source articles can be written in any language.
---

The source articles for this blog live in the `content/` directory, and translations go in `i18n/translations/`; both are checked into Git.

## How writing works

Like Hugo and Hexo, each post is a directory (page bundle), with images stored in the same directory.

```bash
pnpm new my-post --title "我的文章"
```

## Simplified/Traditional Chinese conversion

Simplified Chinese source text is automatically converted to Traditional Chinese via OpenCC; for example, “软件”, “内存”, and “鼠标” are converted to Taiwanese terminology.
You can also specify it manually: 服务器, or use 不转换 to keep the original text as-is.

### Code is not converted

Inline code such as `内存`, as well as Chinese text in code blocks, is left unchanged.

## Blog licensing

Content is licensed under CC BY 4.0, and code under the MIT license.
