import fs from "fs"
import path from "path"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { resolveRelative, FullSlug } from "../util/path"
// @ts-ignore
import script from "./scripts/conceptHub.inline"
import style from "./styles/conceptHub.scss"

/**
 * 概念卡首頁（concepts/index）：常看的卡、查字典、翻卡複習、全部卡片色塊。
 * 常看的卡依「這支手機」的瀏覽紀錄（localStorage），不上傳任何資料。
 */
const DOMAINS: [string, string][] = [
  ["ai", "AI"],
  ["invest", "投資理財"],
  ["fitness", "健身"],
  ["hr", "人資"],
]

export type HubCard = {
  slug: string
  href: string
  title: string
  domain: string
  def: string
  aliases: string[]
  date: string
}

function cleanMd(s: string): string {
  return s
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, (_m, a: string) => a.split("/").at(-1)!)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function readDefinition(fp: string | undefined): string {
  if (!fp) return ""
  const candidates = [fp, path.resolve(fp), path.join("content", fp)]
  for (const c of candidates) {
    if (!fs.existsSync(c)) continue
    const raw = fs.readFileSync(c, "utf-8").replace(/^---\n[\s\S]*?\n---\n/, "")
    const m = raw.match(/##\s*一句話定義\s*\n([\s\S]*?)(?=\n##\s|$)/)
    if (m) return cleanMd(m[1])
    // 沒有該段就取第一段文字
    const para = raw.split(/\n\s*\n/).find((p) => p.trim() && !p.trim().startsWith("#"))
    return para ? cleanMd(para) : ""
  }
  return ""
}

function toList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String)
  if (typeof v === "string" && v.trim()) return [v]
  return []
}

export default (() => {
  const ConceptHub: QuartzComponent = ({ fileData, allFiles }: QuartzComponentProps) => {
    const here = fileData.slug as FullSlug
    const cards: HubCard[] = allFiles
      .filter((f) => {
        const s = f.slug ?? ""
        return s.startsWith("concepts/") && !s.endsWith("index")
      })
      .map((f) => {
        const s = f.slug as FullSlug
        const d = s.split("/")[1] ?? ""
        const date = f.frontmatter?.date
        return {
          slug: s,
          href: resolveRelative(here, s),
          title: f.frontmatter?.title ?? s.split("/").at(-1)!,
          domain: d,
          def: readDefinition(f.filePath as string | undefined),
          aliases: toList(f.frontmatter?.aliases),
          date: date ? String(date).slice(0, 10) : "",
        }
      })
      .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title, "zh-Hant"))

    const tile = (c: HubCard) => (
      <a class={`hub-tile d-${c.domain}`} href={c.href} data-slug={c.slug}>
        <span class="hub-tile-domain">{DOMAINS.find(([k]) => k === c.domain)?.[1] ?? ""}</span>
        <span class="hub-tile-title">{c.title}</span>
        <span class="hub-tile-def">{c.def}</span>
      </a>
    )

    return (
      <div class="concept-hub">
        <script
          type="application/json"
          class="concept-hub-data"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(cards).replace(/</g, "\\u003c") }}
        />

        <section class="hub-section hub-popular">
          <h2>🔥 常看的卡</h2>
          <div class="hub-tiles hub-row">{cards.slice(0, 5).map(tile)}</div>
          <p class="hub-note">依這支手機的瀏覽紀錄排序；還沒有紀錄時先顯示最新的卡。</p>
        </section>

        <section class="hub-section hub-dict">
          <h2>🔍 查字典</h2>
          <input
            class="hub-search"
            type="search"
            placeholder="輸入名詞、英文、縮寫或同義詞，例如 POLC、LLM"
            aria-label="查字典"
          />
          <div class="hub-tiles hub-results"></div>
          <p class="hub-empty" hidden>
            找不到相符的卡，換個說法試試看。
          </p>
        </section>

        <section class="hub-section hub-flash">
          <h2>🃏 翻卡複習</h2>
          <div class="flash-ranges" role="group" aria-label="複習範圍">
            <button data-range="all" aria-pressed="true">
              全部
            </button>
            {DOMAINS.map(([k, label]) => (
              <button data-range={k} aria-pressed="false">
                {label}
              </button>
            ))}
            <button data-range="recent" aria-pressed="false">
              最近 7 天
            </button>
          </div>
          <div class="flash-card" tabindex={0} role="button" aria-label="點一下翻面">
            <div class="flash-inner">
              <div class="flash-face flash-front">
                <span class="flash-domain"></span>
                <span class="flash-term"></span>
                <span class="flash-tip">點一下翻面</span>
              </div>
              <div class="flash-face flash-back">
                <span class="flash-def"></span>
                <a class="flash-link" href="#">
                  看完整卡 →
                </a>
              </div>
            </div>
          </div>
          <div class="flash-actions">
            <button class="flash-again">🔁 再複習</button>
            <button class="flash-known">✅ 記住了</button>
          </div>
          <p class="flash-progress"></p>
        </section>

        <section class="hub-section hub-all">
          <h2>📚 全部概念卡</h2>
          {DOMAINS.map(([k, label]) => {
            const list = cards
              .filter((c) => c.domain === k)
              .sort((a, b) => a.title.localeCompare(b.title, "zh-Hant"))
            if (list.length === 0) return null
            return (
              <div class="hub-group">
                <h3 class={`d-${k}`}>
                  {label}
                  <span class="hub-count">{list.length}</span>
                </h3>
                <div class="hub-tiles hub-grid">{list.map(tile)}</div>
              </div>
            )
          })}
        </section>
      </div>
    )
  }

  ConceptHub.css = style
  ConceptHub.afterDOMLoaded = script
  return ConceptHub
}) satisfies QuartzComponentConstructor
