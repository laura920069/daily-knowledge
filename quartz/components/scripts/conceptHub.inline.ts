// 概念卡首頁：常看的卡（本機紀錄）、查字典、翻卡複習
type Card = {
  slug: string
  href: string
  title: string
  domain: string
  def: string
  aliases: string[]
  date: string
}

const VIEWS_KEY = "dk-concept-views"
const FLASH_KEY = "dk-flash-status"
const DOMAIN_LABEL: Record<string, string> = {
  ai: "AI",
  invest: "投資理財",
  fitness: "健身",
  hr: "人資",
}
const DAY = 24 * 60 * 60 * 1000

function readJSON<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 私密瀏覽等情況無法儲存，略過
  }
}

// 每個頁面都會執行：記錄這支手機看過哪些概念卡（只存在本機）
function recordView(slug: string) {
  if (!/^concepts\/[^/]+\/.+/.test(slug) || slug.endsWith("index")) return
  const views = readJSON<Record<string, number[]>>(VIEWS_KEY, {})
  const now = Date.now()
  const list = (views[slug] ?? []).filter((t) => now - t < 60 * DAY)
  list.push(now)
  views[slug] = list.slice(-50)
  writeJSON(VIEWS_KEY, views)
}

function popularity(slug: string, views: Record<string, number[]>): number {
  const now = Date.now()
  // 最近 30 天的次數為主，越近權重越高
  return (views[slug] ?? []).reduce((sum, t) => {
    const age = now - t
    return age < 30 * DAY ? sum + 1 + (age < 7 * DAY ? 0.5 : 0) : sum
  }, 0)
}

function makeTile(c: Card): HTMLAnchorElement {
  const a = document.createElement("a")
  a.className = `hub-tile d-${c.domain}`
  a.href = c.href
  a.dataset.slug = c.slug
  const d = document.createElement("span")
  d.className = "hub-tile-domain"
  d.textContent = DOMAIN_LABEL[c.domain] ?? ""
  const t = document.createElement("span")
  t.className = "hub-tile-title"
  t.textContent = c.title
  const def = document.createElement("span")
  def.className = "hub-tile-def"
  def.textContent = c.def
  a.append(d, t, def)
  return a
}

const norm = (s: string) => s.toLowerCase().replace(/[\s\-_・·、，,。()（）「」]/g, "")

function searchCards(cards: Card[], q: string): Card[] {
  const nq = norm(q)
  if (!nq) return []
  const scored: [number, Card][] = []
  for (const c of cards) {
    const names = [c.title, ...c.aliases].map(norm)
    let score = 0
    for (const n of names) {
      if (n === nq) score = Math.max(score, 100)
      else if (n.startsWith(nq)) score = Math.max(score, 60)
      else if (n.includes(nq)) score = Math.max(score, 40)
      else if (nq.length >= 2 && nq.includes(n) && n.length >= 2) score = Math.max(score, 30)
    }
    if (score === 0 && norm(c.def).includes(nq)) score = 10
    if (score > 0) scored.push([score, c])
  }
  return scored
    .sort((a, b) => b[0] - a[0])
    .map(([, c]) => c)
    .slice(0, 12)
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function setupHub(root: HTMLElement) {
  const dataEl = root.querySelector(".concept-hub-data")
  if (!dataEl) return
  const cards = JSON.parse(dataEl.textContent || "[]") as Card[]
  if (cards.length === 0) return

  // ---- 🔥 常看的卡 ----
  const views = readJSON<Record<string, number[]>>(VIEWS_KEY, {})
  const row = root.querySelector(".hub-popular .hub-row") as HTMLElement | null
  if (row) {
    const ranked = cards
      .map((c) => [popularity(c.slug, views), c] as [number, Card])
      .filter(([p]) => p > 0)
      .sort((a, b) => b[0] - a[0])
      .map(([, c]) => c)
    // 不足 5 張時用最新的卡補滿（cards 已依日期新→舊排序）
    const picked = [...ranked]
    for (const c of cards) {
      if (picked.length >= 5) break
      if (!picked.includes(c)) picked.push(c)
    }
    row.replaceChildren(...picked.slice(0, 5).map(makeTile))
  }

  // ---- 🔍 查字典 ----
  const input = root.querySelector(".hub-search") as HTMLInputElement | null
  const results = root.querySelector(".hub-results") as HTMLElement | null
  const empty = root.querySelector(".hub-empty") as HTMLElement | null
  if (input && results && empty) {
    const onInput = () => {
      const q = input.value.trim()
      const found = searchCards(cards, q)
      results.replaceChildren(...found.map(makeTile))
      empty.hidden = !(q && found.length === 0)
    }
    input.addEventListener("input", onInput)
    window.addCleanup(() => input.removeEventListener("input", onInput))
  }

  // ---- 🃏 翻卡複習 ----
  const flash = root.querySelector(".hub-flash") as HTMLElement | null
  if (!flash) return
  const cardEl = flash.querySelector(".flash-card") as HTMLElement
  const domainEl = flash.querySelector(".flash-domain") as HTMLElement
  const termEl = flash.querySelector(".flash-term") as HTMLElement
  const defEl = flash.querySelector(".flash-def") as HTMLElement
  const linkEl = flash.querySelector(".flash-link") as HTMLAnchorElement
  const progressEl = flash.querySelector(".flash-progress") as HTMLElement
  const againBtn = flash.querySelector(".flash-again") as HTMLButtonElement
  const knownBtn = flash.querySelector(".flash-known") as HTMLButtonElement
  const rangeBtns = [...flash.querySelectorAll<HTMLButtonElement>(".flash-ranges button")]

  let status = readJSON<Record<string, "known" | "again">>(FLASH_KEY, {})
  let range = "all"
  let deck: Card[] = []
  let idx = 0

  function buildDeck() {
    const now = Date.now()
    const pool = cards.filter((c) => {
      if (range === "all") return true
      if (range === "recent") return c.date && now - new Date(c.date).getTime() <= 7 * DAY
      return c.domain === range
    })
    // 先排還沒記住的（再複習、沒看過），記住的放最後
    const notKnown = shuffle(pool.filter((c) => status[c.slug] !== "known"))
    const known = shuffle(pool.filter((c) => status[c.slug] === "known"))
    deck = [...notKnown, ...known]
    idx = 0
    show()
  }

  function show() {
    cardEl.classList.remove("flipped")
    const c = deck[idx]
    const knownCount = deck.filter((x) => status[x.slug] === "known").length
    if (!c) {
      domainEl.textContent = ""
      termEl.textContent = deck.length === 0 ? "這個範圍還沒有卡片" : "🎉 這一輪複習完了"
      defEl.textContent = ""
      linkEl.hidden = true
      cardEl.className = "flash-card"
      progressEl.textContent = deck.length ? `共 ${deck.length} 張・已記住 ${knownCount} 張` : ""
      againBtn.textContent = "🔀 重新洗牌"
      knownBtn.hidden = true
      return
    }
    cardEl.className = `flash-card d-${c.domain}`
    domainEl.textContent = DOMAIN_LABEL[c.domain] ?? ""
    termEl.textContent = c.title
    defEl.textContent = c.def || "（這張卡還沒有一句話定義）"
    linkEl.hidden = false
    linkEl.href = c.href
    againBtn.textContent = "🔁 再複習"
    knownBtn.hidden = false
    progressEl.textContent = `第 ${idx + 1} / ${deck.length} 張・已記住 ${knownCount} 張`
  }

  function mark(s: "known" | "again") {
    const c = deck[idx]
    if (!c) {
      buildDeck()
      return
    }
    status = { ...status, [c.slug]: s }
    writeJSON(FLASH_KEY, status)
    idx += 1
    show()
  }

  const flip = (e: Event) => {
    if ((e.target as HTMLElement).closest(".flash-link")) return
    if (deck[idx]) cardEl.classList.toggle("flipped")
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      flip(e)
    }
  }
  const onAgain = () => mark("again")
  const onKnown = () => mark("known")
  cardEl.addEventListener("click", flip)
  cardEl.addEventListener("keydown", onKey)
  againBtn.addEventListener("click", onAgain)
  knownBtn.addEventListener("click", onKnown)
  const rangeHandlers = rangeBtns.map((btn) => {
    const h = () => {
      range = btn.dataset.range ?? "all"
      rangeBtns.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)))
      buildDeck()
    }
    btn.addEventListener("click", h)
    return [btn, h] as const
  })
  window.addCleanup(() => {
    cardEl.removeEventListener("click", flip)
    cardEl.removeEventListener("keydown", onKey)
    againBtn.removeEventListener("click", onAgain)
    knownBtn.removeEventListener("click", onKnown)
    rangeHandlers.forEach(([b, h]) => b.removeEventListener("click", h))
  })

  buildDeck()
}

document.addEventListener("nav", () => {
  const slug = document.body.dataset.slug ?? ""
  recordView(slug)
  const root = document.querySelector(".concept-hub") as HTMLElement | null
  if (root) setupHub(root)
})
