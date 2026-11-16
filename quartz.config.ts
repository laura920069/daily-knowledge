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
      fontOrigin: "googleFonts",
      cdnCaching: true,
      typography: {
        header: "Noto Sans TC",
        body: "Noto Sans TC",
        code: "IBM Plex Mono",
      },
      colors: {
        lightMode: {
          light: "#fbfaf7",
          lightgray: "#e7e3dc",
          gray: "#a8a29e",
          darkgray: "#3f3f46",
          dark: "#1f2937",
          secondary: "#2f6f5e",
          tertiary: "#d08c3c",
          highlight: "rgba(47, 111, 94, 0.10)",
          textHighlight: "#fde68a99",
        },
        darkMode: {
          light: "#141615",
          lightgray: "#2e3230",
          gray: "#6b7280",
          darkgray: "#d6d3d1",
          dark: "#f5f5f4",
          secondary: "#7cc4ad",
          tertiary: "#e9a961",
          highlight: "rgba(124, 196, 173, 0.12)",
          textHighlight: "#b4530988",
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
