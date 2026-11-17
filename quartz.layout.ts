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
    // 概念卡首頁：常看的卡、查字典、翻卡複習、全部卡片色塊
    Component.ConditionalRender({
      component: Component.ConceptHub(),
      condition: (page) => page.fileData.slug === "concepts/index",
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
      // 關係網只顯示概念卡；局部圖 1 層、最多 12 個節點，名稱常駐，領域配色
      localGraph: {
        depth: 1,
        showTags: false,
        repelForce: 0.8,
        linkDistance: 55,
        fontSize: 0.8,
        focusOnHover: true,
      },
      globalGraph: { showTags: false, repelForce: 0.7, linkDistance: 55, fontSize: 0.75 },
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
