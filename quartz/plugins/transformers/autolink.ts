import fs from "fs"
import path from "path"
import { Root, Link } from "mdast"
import { findAndReplace } from "mdast-util-find-and-replace"
import { visit } from "unist-util-visit"
import { QuartzTransformerPlugin } from "../types"

/**
 * 每日知識庫：專有名詞自動連到概念卡。
 * 建置時掃描 content/concepts/ 下所有概念卡（檔名＋aliases），
 * 文章中第一次出現的名詞自動變成連到該卡的連結（標題、程式碼、既有連結內不處理）。
 */
type Term = { term: string; target: string }

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function loadTerms(contentDir: string): Term[] {
  const conceptsDir = path.join(contentDir, "concepts")
  const terms: Term[] = []
  if (!fs.existsSync(conceptsDir)) return terms
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
        continue
      }
      if (!entry.name.endsWith(".md") || entry.name === "index.md") continue
      const rel = path.relative(contentDir, full).replace(/\\/g, "/").replace(/\.md$/, "")
      const stem = entry.name.replace(/\.md$/, "")
      const text = fs.readFileSync(full, "utf-8")
      const names = new Set<string>([stem])
      const fm = text.match(/^---\n([\s\S]*?)\n---/)
      if (fm) {
        const al = fm[1].match(/^aliases:\s*\[(.*?)\]/m)
        if (al) {
          for (const a of al[1].split(",")) {
            const v = a.trim().replace(/^['"]|['"]$/g, "")
            if (v) names.add(v)
          }
        }
      }
      for (const n of names) {
        // 太短的名詞容易誤判（例如單一中文字），略過
        if ([...n].length < 2) continue
        terms.push({ term: n, target: rel })
      }
    }
  }
  walk(conceptsDir)
  // 長的先比對，例如「市值型 ETF 與高股息 ETF」優先於「ETF」
  terms.sort((a, b) => b.term.length - a.term.length)
  return terms
}

const isAsciiWord = (c: string | undefined) => !!c && /[A-Za-z0-9]/.test(c)

export const AutoLinkConcepts: QuartzTransformerPlugin = () => {
  return {
    name: "AutoLinkConcepts",
    markdownPlugins(ctx) {
      const contentDir = ctx.argv.directory
      const terms = loadTerms(contentDir)
      if (terms.length === 0) return []
      const byTerm = new Map<string, string>()
      for (const t of terms)
        if (!byTerm.has(t.term.toLowerCase())) byTerm.set(t.term.toLowerCase(), t.target)
      const regex = new RegExp(terms.map((t) => escapeRegExp(t.term)).join("|"), "gi")
      const targets = new Set(terms.map((t) => t.target))
      const stemOf = (t: string) => t.split("/").at(-1)!

      return [
        () => (tree: Root, file) => {
          const slug = (file.data.slug ?? "") as string
          // 首頁與各資料夾索引頁不自動加連結
          if (slug === "index" || slug.endsWith("/index")) return

          // 已經連過的概念（含本頁自己）不重複連
          const linked = new Set<string>()
          if (targets.has(slug)) linked.add(slug)
          visit(tree, "link", (node: Link) => {
            const url = decodeURIComponent(node.url.split("#")[0]).replace(/^\.\//, "")
            for (const t of targets) {
              if (url === t || url === stemOf(t) || url.endsWith("/" + stemOf(t))) linked.add(t)
            }
          })

          findAndReplace(
            tree,
            [
              [
                regex,
                (value: string, match: { index: number; input: string }) => {
                  const target = byTerm.get(value.toLowerCase())
                  if (!target || linked.has(target)) return false
                  // 英文名詞要是完整單字（避免 ETF 連到 ETFs 中間等）
                  const before = match.input[match.index - 1]
                  const after = match.input[match.index + value.length]
                  if (isAsciiWord(value[0]) && isAsciiWord(before)) return false
                  if (isAsciiWord(value[value.length - 1]) && isAsciiWord(after)) return false
                  linked.add(target)
                  return {
                    type: "link",
                    url: target,
                    data: { hProperties: { className: ["auto-concept"] } },
                    children: [{ type: "text", value }],
                  } as Link
                },
              ],
            ],
            { ignore: ["link", "linkReference", "heading", "code", "inlineCode", "html"] },
          )
        },
      ]
    },
  }
}
