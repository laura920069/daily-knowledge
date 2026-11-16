import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

// 文章資料夾（首頁「最新知識」只列這些）
const ARTICLE_FOLDERS = ["ai/", "invest/", "fitness/", "hr/"]

const isArticle = (slug?: string) =>
  !!slug && ARTICLE_FOLDERS.some((f) => slug.startsWith(f)) && !slug.endsWith("/index")

// 側邊欄目錄排序：依指定順序排資料夾；日期開頭的檔案新的在前
const explorer = Component.Explorer({
  title: "目錄",
  folderDefaultState: "collapsed",
  folderClickBehavior: "link",
  sortFn: (a, b) => {
    const order = ["daily", "ai", "invest", "fitness", "hr", "concepts", "path", "weekly", "notes"]
    if (a.isFolder && b.isFolder) {
      const ia = order.indexOf(a.slugSegment)
      const ib = order.indexOf(b.slugSegment)
      if (ia !== -1 || ib !== -1) {
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
      }
      return a.displayName.localeCompare(b.displayName, "zh-Hant")
    }
    if (!a.isFolder && !b.isFolder) {
      const da = /^\d{4}-\d{2}-\d{2}/.test(a.slugSegment)
      const db = /^\d{4}-\d{2}-\d{2}/.test(b.slugSegment)
      if (da && db) return b.slugSegment.localeCompare(a.slugSegment)
      return a.displayName.localeCompare(b.displayName, "zh-Hant", { numeric: true })
    }
    return a.isFolder ? -1 : 1
  },
})

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [Component.SiteNav()],
  afterBody: [
    Component.ConditionalRender({
      component: Component.RecentNotes({
        title: "最新知識",
        limit: 10,
        showTags: true,
        filter: (f) => isArticle(f.slug),
      }),
      condition: (page) => page.fileData.slug === "index",
    }),
  ],
  footer: Component.Footer({ links: {} }),
}

// 單篇文章頁
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.ConditionalRender({
      component: Component.Breadcrumbs(),
      condition: (page) => page.fileData.slug !== "index",
    }),
    Component.ConditionalRender({
      component: Component.ArticleTitle(),
      condition: (page) => page.fileData.slug !== "index",
    }),
    Component.ConditionalRender({
      component: Component.ContentMeta(),
      condition: (page) => page.fileData.slug !== "index",
    }),
    Component.TagList(),
  ],
  left: [
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        { Component: Component.Search(), grow: true },
        { Component: Component.Darkmode() },
        { Component: Component.ReaderMode() },
      ],
    }),
    explorer,
  ],
  right: [
    Component.Graph({
      localGraph: { depth: 2, showTags: false, repelForce: 0.6, linkDistance: 40 },
      globalGraph: { showTags: false, repelForce: 0.5, linkDistance: 40 },
    }),
    Component.DesktopOnly(Component.TableOfContents()),
    Component.Backlinks(),
  ],
}

// 列表頁（資料夾、標籤）
export const defaultListPageLayout: PageLayout = {
  beforeBody: [Component.Breadcrumbs(), Component.ArticleTitle(), Component.ContentMeta()],
  left: [
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        { Component: Component.Search(), grow: true },
        { Component: Component.Darkmode() },
      ],
    }),
    explorer,
  ],
  right: [],
}
