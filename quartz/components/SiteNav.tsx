import { pathToRoot, joinSegments } from "../util/path"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

// 頂部導覽列：品牌名稱＋主要分類＋管理後台
const links: { label: string; path: string; external?: boolean }[] = [
  { label: "每日推播", path: "daily/" },
  { label: "學習路徑", path: "path/" },
  { label: "概念卡", path: "concepts/" },
  { label: "每週回顧", path: "weekly/" },
  { label: "我的筆記", path: "notes/" },
  { label: "管理後台", path: "admin/", external: true },
]

const SiteNav: QuartzComponent = ({ fileData }: QuartzComponentProps) => {
  const base = pathToRoot(fileData.slug!)
  const slug = fileData.slug ?? ""
  return (
    <nav class="site-nav" aria-label="主要導覽">
      <a class="site-brand" href={base}>
        <span class="site-brand-mark">＊</span>每日知識庫
      </a>
      <ul class="site-links">
        {links.map((l) => {
          const active = !l.external && slug.startsWith(l.path)
          return (
            <li>
              <a
                href={joinSegments(base, l.path)}
                class={active ? "active" : ""}
                {...(l.external ? { "data-router-ignore": true } : {})}
              >
                {l.label}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

SiteNav.css = `
.site-nav {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1.5rem;
  width: 100%;
  padding: 0.4rem 0 1.1rem;
  border-bottom: 1px solid var(--dark);
}

.site-brand {
  font-family: var(--headerFont);
  font-size: 1.35rem;
  font-weight: 600;
  color: var(--dark) !important;
  background: none !important;
  white-space: nowrap;
  letter-spacing: 0.04em;
}

.site-brand-mark {
  color: var(--secondary);
  margin-right: 0.15rem;
}

.site-links {
  display: flex;
  gap: 1.4rem;
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.site-links::-webkit-scrollbar {
  display: none;
}

.site-links a {
  font-size: 0.9rem;
  color: var(--darkgray) !important;
  background: none !important;
  white-space: nowrap;
  font-weight: 400;
  padding: 0.2rem 0;
  border-bottom: 1px solid transparent;
  transition: color 0.2s, border-color 0.2s;
}

.site-links a:hover,
.site-links a.active {
  color: var(--secondary) !important;
  border-bottom-color: var(--secondary);
}

@media all and (max-width: 800px) {
  .site-nav {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.6rem;
    padding-bottom: 0.7rem;
  }
  .site-links {
    gap: 1.1rem;
    width: 100%;
    padding-bottom: 0.2rem;
  }
  .site-links a {
    font-size: 0.95rem;
  }
}
`

export default (() => SiteNav) satisfies QuartzComponentConstructor
