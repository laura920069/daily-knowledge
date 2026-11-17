import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"

/**
 * 每日知識庫 — Quartz 4 設定
 * 文件：https://quartz.jzhao.xyz/configuration
 */
const config: QuartzConfig = {
  configuration: {
    pageTitle: "每日知識庫",
    pageTitleSuffix: "｜每日知識庫",
    enableSPA: true,
    enablePopovers: true,
    analytics: null,
    locale: "zh-TW",
    baseUrl: "laura920069.github.io/daily-knowledge",
    ignorePatterns: ["private", "templates", ".obsidian"],
    defaultDateType: "created",
    theme: {
      fontOrigin: "local",
      cdnCaching: true,
      typography: {
        // 源泉圓體 GenSen Rounded 2 TW（SIL OFL 1.1），建置時自動裁切成網站用到的字
        header: "GenSen Rounded 2 TW",
        body: "GenSen Rounded 2 TW",
        code: "ui-monospace",
      },
      colors: {
        lightMode: {
          light: "#f6f3ee",
          lightgray: "#e2dcd2",
          gray: "#a39b90",
          darkgray: "#3b3734",
          dark: "#161412",
          secondary: "#9a6430",
          tertiary: "#8e8b85",
          highlight: "rgba(201, 151, 82, 0.10)",
          textHighlight: "#f1d9a6aa",
        },
        darkMode: {
          light: "#161513",
          lightgray: "#34312d",
          gray: "#7d766d",
          darkgray: "#d8d2c8",
          dark: "#f3efe8",
          secondary: "#d9a866",
          tertiary: "#b4b0a9",
          highlight: "rgba(217, 168, 102, 0.10)",
          textHighlight: "#8a5a2299",
        },
      },
    },
  },
  plugins: {
    transformers: [
      Plugin.FrontMatter(),
      Plugin.CreatedModifiedDate({
        priority: ["frontmatter", "git", "filesystem"],
      }),
      Plugin.SyntaxHighlighting({
        theme: {
          light: "github-light",
          dark: "github-dark",
        },
        keepBackground: false,
      }),
      Plugin.ObsidianFlavoredMarkdown({ enableInHtmlEmbed: false }),
      Plugin.GitHubFlavoredMarkdown(),
      // 專有名詞第一次出現時自動連到概念卡
      Plugin.AutoLinkConcepts(),
      Plugin.TableOfContents(),
      Plugin.CrawlLinks({ markdownLinkResolution: "shortest", openLinksInNewTab: true }),
      Plugin.Description(),
      Plugin.Latex({ renderEngine: "katex" }),
    ],
    filters: [Plugin.RemoveDrafts()],
    emitters: [
      Plugin.AliasRedirects(),
      Plugin.ComponentResources(),
      Plugin.ContentPage(),
      Plugin.FolderPage(),
      Plugin.TagPage(),
      Plugin.ContentIndex({
        enableSiteMap: true,
        enableRSS: true,
      }),
      Plugin.Assets(),
      Plugin.Static(),
      Plugin.Favicon(),
      Plugin.NotFoundPage(),
    ],
  },
}

export default config
