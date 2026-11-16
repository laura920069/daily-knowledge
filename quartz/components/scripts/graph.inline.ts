import type { ContentDetails } from "../../plugins/emitters/contentIndex"
import {
  SimulationNodeDatum,
  SimulationLinkDatum,
  Simulation,
  forceSimulation,
  forceManyBody,
  forceCenter,
  forceLink,
  forceCollide,
  forceRadial,
  zoomIdentity,
  select,
  drag,
  zoom,
} from "d3"
import { Text, Graphics, Application, Container, Circle } from "pixi.js"
import { Group as TweenGroup, Tween as Tweened } from "@tweenjs/tween.js"
import { registerEscapeHandler, removeAllChildren } from "./util"
import { FullSlug, SimpleSlug, getFullSlug, resolveRelative, simplifySlug } from "../../util/path"
import { D3Config } from "../Graph"

type GraphicsInfo = {
  color: string
  gfx: Graphics
  alpha: number
  active: boolean
}

type NodeData = {
  id: SimpleSlug
  text: string
  tags: string[]
} & SimulationNodeDatum

type SimpleLinkData = {
  source: SimpleSlug
  target: SimpleSlug
}

type LinkData = {
  source: NodeData
  target: NodeData
} & SimulationLinkDatum<NodeData>

type LinkRenderData = GraphicsInfo & {
  simulationData: LinkData
}

type NodeRenderData = GraphicsInfo & {
  simulationData: NodeData
  label: Text
}

const localStorageKey = "graph-visited"
function getVisited(): Set<SimpleSlug> {
  return new Set(JSON.parse(localStorage.getItem(localStorageKey) ?? "[]"))
}

function addToVisited(slug: SimpleSlug) {
  const visited = getVisited()
  visited.add(slug)
  localStorage.setItem(localStorageKey, JSON.stringify([...visited]))
}

// ---- 每日知識庫：領域配色與工具 ----
const DOMAINS = { ai: "AI", invest: "投資", fitness: "健身", hr: "人資" } as const
type Domain = keyof typeof DOMAINS
// [淺色主題, 深色主題]
const DOMAIN_COLORS: Record<Domain, [string, string]> = {
  ai: ["#4f7aa3", "#8fb4d6"],
  invest: ["#b07a1e", "#e0b45e"],
  fitness: ["#5e8a4a", "#9cc488"],
  hr: ["#b45a4c", "#e39488"],
}
const MAX_LOCAL_NODES = 12
const isConcept = (s: string) =>
  s.startsWith("concepts/") && !s.endsWith("/") && !s.endsWith("/index")
function domainOf(s: string): Domain | null {
  const m = s.match(/^(?:concepts\/)?(ai|invest|fitness|hr)\//)
  return m ? (m[1] as Domain) : null
}
function domainColor(s: string, fallback: string): string {
  const d = domainOf(s)
  if (!d) return fallback
  const dark = document.documentElement.getAttribute("saved-theme") === "dark"
  return DOMAIN_COLORS[d][dark ? 1 : 0]
}

type GraphOpts = {
  domain?: Domain | null
  relatedEl?: HTMLElement | null
  hintEl?: HTMLElement | null
}

type TweenNode = {
  update: (time: number) => void
  stop: () => void
}

async function renderGraph(graph: HTMLElement, fullSlug: FullSlug, opts: GraphOpts = {}) {
  const slug = simplifySlug(fullSlug)
  removeAllChildren(graph)

  let {
    drag: enableDrag,
    zoom: enableZoom,
    depth,
    scale,
    repelForce,
    centerForce,
    linkDistance,
    fontSize,
    removeTags,
    showTags,
    focusOnHover,
    enableRadial,
  } = JSON.parse(graph.dataset["cfg"]!) as D3Config

  const data: Map<SimpleSlug, ContentDetails> = new Map(
    Object.entries<ContentDetails>(await fetchData).map(([k, v]) => [
      simplifySlug(k as FullSlug),
      v,
    ]),
  )
  const links: SimpleLinkData[] = []
  const tags: SimpleSlug[] = []
  // 關係網只顯示知識點（概念卡）：排除每日總覽、文章、首頁、週回顧、資料夾索引等網站架構頁
  const validLinks = new Set(
    [...data.keys()].filter((k) => isConcept(k) && (!opts.domain || domainOf(k) === opts.domain)),
  )

  const tweens = new Map<string, TweenNode>()
  for (const [source, details] of data.entries()) {
    if (!validLinks.has(source)) continue
    const outgoing = details.links ?? []

    for (const dest of outgoing) {
      if (validLinks.has(dest)) {
        links.push({ source: source, target: dest })
      }
    }

    if (showTags) {
      const localTags = details.tags
        .filter((tag) => !removeTags.includes(tag))
        .map((tag) => simplifySlug(("tags/" + tag) as FullSlug))

      tags.push(...localTags.filter((tag) => !tags.includes(tag)))

      for (const tag of localTags) {
        links.push({ source: source, target: tag })
      }
    }
  }

  const neighbourhood = new Set<SimpleSlug>()
  // 在概念卡上以自己為中心；在文章／總覽頁則以該頁（及其連到的文章）提到的概念卡為中心
  const seedSet = new Set<SimpleSlug>()
  if (validLinks.has(slug)) {
    seedSet.add(slug)
  } else {
    for (const l of data.get(slug)?.links ?? []) {
      if (validLinks.has(l)) seedSet.add(l)
      else for (const l2 of data.get(l)?.links ?? []) if (validLinks.has(l2)) seedSet.add(l2)
    }
  }
  const seeds = [...seedSet]
  const wl: (SimpleSlug | "__SENTINEL")[] = [...seeds, "__SENTINEL"]
  if (depth >= 0) {
    while (depth >= 0 && wl.length > 0) {
      // compute neighbours
      const cur = wl.shift()!
      if (cur === "__SENTINEL") {
        depth--
        wl.push("__SENTINEL")
      } else {
        neighbourhood.add(cur)
        const outgoing = links.filter((l) => l.source === cur)
        const incoming = links.filter((l) => l.target === cur)
        wl.push(...outgoing.map((l) => l.target), ...incoming.map((l) => l.source))
      }
    }
  } else {
    validLinks.forEach((id) => neighbourhood.add(id))
    if (showTags) tags.forEach((tag) => neighbourhood.add(tag))
  }

  // 連結數（用來決定節點大小與保留順序）
  const degree = (id: string) => links.filter((l) => l.source === id || l.target === id).length
  // 局部圖節點上限：保留中心，再依連結數多寡挑選，避免越長越密
  if (depth >= 0 && neighbourhood.size > MAX_LOCAL_NODES) {
    const keep = [
      ...seeds,
      ...[...neighbourhood].filter((n) => !seeds.includes(n)).sort((a, b) => degree(b) - degree(a)),
    ].slice(0, MAX_LOCAL_NODES)
    neighbourhood.clear()
    keep.forEach((n) => neighbourhood.add(n))
  }

  // 圖下方的「相關知識點」清單
  if (opts.relatedEl) {
    const el = opts.relatedEl
    removeAllChildren(el)
    const related = [...neighbourhood]
      .filter((n) => n !== slug)
      .sort((a, b) => Number(seeds.includes(b)) - Number(seeds.includes(a)) || degree(b) - degree(a))
    if (related.length === 0) {
      const p = document.createElement("p")
      p.className = "graph-related-empty"
      p.textContent = "這頁還沒有連到知識點，點右上角圖示看全部"
      el.appendChild(p)
    } else {
      for (const id of related) {
        const a = document.createElement("a")
        a.className = "graph-chip internal"
        a.href = resolveRelative(fullSlug, id)
        a.textContent = data.get(id)?.title ?? id
        a.style.setProperty("--chip-color", domainColor(id, "var(--gray)"))
        el.appendChild(a)
      }
    }
  }

  const nodes = [...neighbourhood].map((url) => {
    const text = url.startsWith("tags/") ? "#" + url.substring(5) : (data.get(url)?.title ?? url)
    return {
      id: url,
      text,
      tags: data.get(url)?.tags ?? [],
    }
  })
  const graphData: { nodes: NodeData[]; links: LinkData[] } = {
    nodes,
    links: links
      .filter((l) => neighbourhood.has(l.source) && neighbourhood.has(l.target))
      .map((l) => ({
        source: nodes.find((n) => n.id === l.source)!,
        target: nodes.find((n) => n.id === l.target)!,
      })),
  }

  const width = graph.offsetWidth
  const height = Math.max(graph.offsetHeight, 250)

  // we virtualize the simulation and use pixi to actually render it
  const simulation: Simulation<NodeData, LinkData> = forceSimulation<NodeData>(graphData.nodes)
    .force("charge", forceManyBody().strength(-100 * repelForce))
    .force("center", forceCenter().strength(centerForce))
    .force("link", forceLink(graphData.links).distance(linkDistance))
    .force("collide", forceCollide<NodeData>((n) => nodeRadius(n) + 14).iterations(3))

  const radius = (Math.min(width, height) / 2) * 0.8
  if (enableRadial) simulation.force("radial", forceRadial(radius).strength(0.2))

  // precompute style prop strings as pixi doesn't support css variables
  const cssVars = [
    "--secondary",
    "--tertiary",
    "--gray",
    "--light",
    "--lightgray",
    "--dark",
    "--darkgray",
    "--bodyFont",
  ] as const
  const computedStyleMap = cssVars.reduce(
    (acc, key) => {
      acc[key] = getComputedStyle(document.documentElement).getPropertyValue(key)
      return acc
    },
    {} as Record<(typeof cssVars)[number], string>,
  )

  // calculate color
  const color = (d: NodeData) => domainColor(d.id, computedStyleMap["--gray"])

  function nodeRadius(d: NodeData) {
    const numLinks = graphData.links.filter(
      (l) => l.source.id === d.id || l.target.id === d.id,
    ).length
    return 4 + Math.sqrt(numLinks) + (d.id === slug ? 3 : 0)
  }

  let hoveredNodeId: string | null = null
  let selectedId: string | null = null // 手機：第一下選取，第二下開啟
  let hoveredNeighbours: Set<string> = new Set()
  const linkRenderData: LinkRenderData[] = []
  const nodeRenderData: NodeRenderData[] = []
  function updateHoverInfo(newHoveredId: string | null) {
    hoveredNodeId = newHoveredId

    if (newHoveredId === null) {
      hoveredNeighbours = new Set()
      for (const n of nodeRenderData) {
        n.active = false
      }

      for (const l of linkRenderData) {
        l.active = false
      }
    } else {
      hoveredNeighbours = new Set()
      for (const l of linkRenderData) {
        const linkData = l.simulationData
        if (linkData.source.id === newHoveredId || linkData.target.id === newHoveredId) {
          hoveredNeighbours.add(linkData.source.id)
          hoveredNeighbours.add(linkData.target.id)
        }

        l.active = linkData.source.id === newHoveredId || linkData.target.id === newHoveredId
      }

      for (const n of nodeRenderData) {
        n.active = hoveredNeighbours.has(n.simulationData.id)
      }
    }
  }

  let dragStartTime = 0
  let dragging = false

  function renderLinks() {
    tweens.get("link")?.stop()
    const tweenGroup = new TweenGroup()

    for (const l of linkRenderData) {
      let alpha = 1

      // if we are hovering over a node, we want to highlight the immediate neighbours
      // with full alpha and the rest with default alpha
      if (hoveredNodeId) {
        alpha = l.active ? 1 : 0.2
      }

      l.color = l.active ? computedStyleMap["--gray"] : computedStyleMap["--lightgray"]
      tweenGroup.add(new Tweened<LinkRenderData>(l).to({ alpha }, 200))
    }

    tweenGroup.getAll().forEach((tw) => tw.start())
    tweens.set("link", {
      update: tweenGroup.update.bind(tweenGroup),
      stop() {
        tweenGroup.getAll().forEach((tw) => tw.stop())
      },
    })
  }

  function renderLabels() {
    tweens.get("label")?.stop()
    const tweenGroup = new TweenGroup()

    const defaultScale = 1 / scale
    const activeScale = defaultScale * 1.1
    for (const n of nodeRenderData) {
      const nodeId = n.simulationData.id

      if (hoveredNodeId === nodeId) {
        tweenGroup.add(
          new Tweened<Text>(n.label).to(
            {
              alpha: 1,
              scale: { x: activeScale, y: activeScale },
            },
            100,
          ),
        )
      } else {
        tweenGroup.add(
          new Tweened<Text>(n.label).to(
            {
              alpha: n.label.alpha,
              scale: { x: defaultScale, y: defaultScale },
            },
            100,
          ),
        )
      }
    }

    tweenGroup.getAll().forEach((tw) => tw.start())
    tweens.set("label", {
      update: tweenGroup.update.bind(tweenGroup),
      stop() {
        tweenGroup.getAll().forEach((tw) => tw.stop())
      },
    })
  }

  function renderNodes() {
    tweens.get("hover")?.stop()

    const tweenGroup = new TweenGroup()
    for (const n of nodeRenderData) {
      let alpha = 1

      // if we are hovering over a node, we want to highlight the immediate neighbours
      if (hoveredNodeId !== null && (focusOnHover || selectedId !== null)) {
        alpha = n.active ? 1 : 0.2
      }

      tweenGroup.add(new Tweened<Graphics>(n.gfx, tweenGroup).to({ alpha }, 200))
    }

    tweenGroup.getAll().forEach((tw) => tw.start())
    tweens.set("hover", {
      update: tweenGroup.update.bind(tweenGroup),
      stop() {
        tweenGroup.getAll().forEach((tw) => tw.stop())
      },
    })
  }

  function renderPixiFromD3() {
    renderNodes()
    renderLinks()
    renderLabels()
  }

  tweens.forEach((tween) => tween.stop())
  tweens.clear()

  const app = new Application()
  await app.init({
    width,
    height,
    antialias: true,
    autoStart: false,
    autoDensity: true,
    backgroundAlpha: 0,
    preference: "webgpu",
    resolution: window.devicePixelRatio,
    eventMode: "static",
  })
  graph.appendChild(app.canvas)

  const stage = app.stage
  stage.interactive = false

  const labelsContainer = new Container<Text>({ zIndex: 3, isRenderGroup: true })
  const nodesContainer = new Container<Graphics>({ zIndex: 2, isRenderGroup: true })
  const linkContainer = new Container<Graphics>({ zIndex: 1, isRenderGroup: true })
  stage.addChild(nodesContainer, labelsContainer, linkContainer)

  for (const n of graphData.nodes) {
    const nodeId = n.id

    const label = new Text({
      interactive: false,
      eventMode: "none",
      text: n.text,
      alpha: 1,
      anchor: { x: 0.5, y: 1.2 },
      style: {
        fontSize: fontSize * 15,
        fill: computedStyleMap["--dark"],
        fontFamily: computedStyleMap["--bodyFont"],
      },
      resolution: window.devicePixelRatio * 4,
    })
    label.scale.set(1 / scale)

    let oldLabelOpacity = 0
    const isTagNode = nodeId.startsWith("tags/")
    const gfx = new Graphics({
      interactive: true,
      label: nodeId,
      eventMode: "static",
      hitArea: new Circle(0, 0, nodeRadius(n)),
      cursor: "pointer",
    })
      .circle(0, 0, nodeRadius(n))
      .fill({ color: isTagNode ? computedStyleMap["--light"] : color(n) })
      .on("pointerover", (e) => {
        updateHoverInfo(e.target.label)
        oldLabelOpacity = label.alpha
        if (!dragging) {
          renderPixiFromD3()
        }
      })
      .on("pointerleave", () => {
        updateHoverInfo(selectedId)
        label.alpha = oldLabelOpacity
        if (!dragging) {
          renderPixiFromD3()
        }
      })

    if (isTagNode) {
      gfx.stroke({ width: 2, color: computedStyleMap["--tertiary"] })
    } else if (nodeId === slug) {
      gfx.stroke({ width: 2.5, color: computedStyleMap["--dark"] })
    }

    nodesContainer.addChild(gfx)
    labelsContainer.addChild(label)

    const nodeRenderDatum: NodeRenderData = {
      simulationData: n,
      gfx,
      label,
      color: color(n),
      alpha: 1,
      active: false,
    }

    nodeRenderData.push(nodeRenderDatum)
  }

  for (const l of graphData.links) {
    const gfx = new Graphics({ interactive: false, eventMode: "none" })
    linkContainer.addChild(gfx)

    const linkRenderDatum: LinkRenderData = {
      simulationData: l,
      gfx,
      color: computedStyleMap["--lightgray"],
      alpha: 1,
      active: false,
    }

    linkRenderData.push(linkRenderDatum)
  }

  let currentTransform = zoomIdentity

  // 以座標找最近的節點（觸控目標放大到半徑 +12px）
  function nodeAt(px: number, py: number): NodeData | undefined {
    let best: NodeData | undefined
    let bestDist = Infinity
    for (const n of graphData.nodes) {
      if (n.x === undefined || n.y === undefined) continue
      const [sx, sy] = currentTransform.apply([n.x + width / 2, n.y + height / 2])
      const dist = Math.hypot(sx - px, sy - py)
      const hit = (nodeRadius(n) + 12) * currentTransform.k
      if (dist <= Math.max(hit, 18) && dist < bestDist) {
        best = n
        bestDist = dist
      }
    }
    return best
  }

  function setHint(text: string) {
    if (!opts.hintEl) return
    opts.hintEl.textContent = text
    opts.hintEl.classList.toggle("show", text !== "")
  }

  function navigateTo(node: NodeData) {
    const targ = resolveRelative(fullSlug, node.id)
    window.spaNavigate(new URL(targ, window.location.toString()))
  }

  function selectNode(id: string | null) {
    selectedId = id
    updateHoverInfo(id)
    renderPixiFromD3()
    const node = graphData.nodes.find((n) => n.id === id)
    setHint(node ? `再點一下「${node.text}」開啟` : "")
  }

  // 滑鼠：移上去預覽、點一下開啟；觸控：第一下選取並顯示關聯，第二下開啟
  function handleTap(node: NodeData, isTouch: boolean) {
    if (!isTouch || selectedId === node.id) {
      navigateTo(node)
    } else {
      selectNode(node.id)
    }
  }

  app.canvas.addEventListener("click", (e) => {
    if (selectedId !== null && !nodeAt(e.offsetX, e.offsetY)) selectNode(null)
  })

  if (enableDrag) {
    select<HTMLCanvasElement, NodeData | undefined>(app.canvas).call(
      drag<HTMLCanvasElement, NodeData | undefined>()
        .container(() => app.canvas)
        .subject((event) => nodeAt(event.x, event.y))
        .on("start", function dragstarted(event) {
          if (!event.active) simulation.alphaTarget(1).restart()
          event.subject.fx = event.subject.x
          event.subject.fy = event.subject.y
          event.subject.__initialDragPos = {
            x: event.subject.x,
            y: event.subject.y,
            fx: event.subject.fx,
            fy: event.subject.fy,
          }
          dragStartTime = Date.now()
          dragging = true
        })
        .on("drag", function dragged(event) {
          const initPos = event.subject.__initialDragPos
          event.subject.fx = initPos.x + (event.x - initPos.x) / currentTransform.k
          event.subject.fy = initPos.y + (event.y - initPos.y) / currentTransform.k
        })
        .on("end", function dragended(event) {
          if (!event.active) simulation.alphaTarget(0)
          event.subject.fx = null
          event.subject.fy = null
          dragging = false

          // if the time between mousedown and mouseup is short, we consider it a click
          const init = event.subject.__initialDragPos
          const moved = init ? Math.hypot(event.x - init.x, event.y - init.y) : 0
          if (Date.now() - dragStartTime < 500 && moved < 8) {
            const se = event.sourceEvent
            const isTouch =
              (se?.type ?? "").startsWith("touch") || se?.pointerType === "touch"
            handleTap(event.subject as NodeData, isTouch)
          }
        }),
    )
  } else {
    for (const node of nodeRenderData) {
      node.gfx.on("pointertap", (e) => {
        handleTap(node.simulationData, e.pointerType === "touch")
      })
    }
  }

  if (enableZoom) {
    select<HTMLCanvasElement, NodeData>(app.canvas).call(
      zoom<HTMLCanvasElement, NodeData>()
        .extent([
          [0, 0],
          [width, height],
        ])
        .scaleExtent([0.25, 4])
        .on("zoom", ({ transform }) => {
          currentTransform = transform
          stage.scale.set(transform.k, transform.k)
          stage.position.set(transform.x, transform.y)

          // 名稱常駐顯示，不隨縮放淡出
        }),
    )
  }

  let stopAnimation = false
  function animate(time: number) {
    if (stopAnimation) return
    for (const n of nodeRenderData) {
      const { x, y } = n.simulationData
      if (!x || !y) continue
      n.gfx.position.set(x + width / 2, y + height / 2)
      if (n.label) {
        n.label.position.set(x + width / 2, y + height / 2)
      }
    }

    for (const l of linkRenderData) {
      const linkData = l.simulationData
      l.gfx.clear()
      l.gfx.moveTo(linkData.source.x! + width / 2, linkData.source.y! + height / 2)
      l.gfx
        .lineTo(linkData.target.x! + width / 2, linkData.target.y! + height / 2)
        .stroke({ alpha: l.alpha, width: 1, color: l.color })
    }

    tweens.forEach((t) => t.update(time))
    app.renderer.render(stage)
    requestAnimationFrame(animate)
  }

  requestAnimationFrame(animate)
  return () => {
    stopAnimation = true
    app.destroy()
  }
}

let localGraphCleanups: (() => void)[] = []
let globalGraphCleanups: (() => void)[] = []

function cleanupLocalGraphs() {
  for (const cleanup of localGraphCleanups) {
    cleanup()
  }
  localGraphCleanups = []
}

function cleanupGlobalGraphs() {
  for (const cleanup of globalGraphCleanups) {
    cleanup()
  }
  globalGraphCleanups = []
}

document.addEventListener("nav", async (e: CustomEventMap["nav"]) => {
  const slug = e.detail.url
  addToVisited(simplifySlug(slug))

  async function renderLocalGraph() {
    cleanupLocalGraphs()
    const localGraphContainers = document.getElementsByClassName("graph-container")
    for (const container of localGraphContainers) {
      const root = container.closest(".graph")
      localGraphCleanups.push(
        await renderGraph(container as HTMLElement, slug, {
          relatedEl: root?.querySelector(".graph-related") as HTMLElement | null,
          hintEl: root?.querySelector(".graph-outer .graph-hint") as HTMLElement | null,
        }),
      )
    }
  }

  await renderLocalGraph()
  const handleThemeChange = () => {
    void renderLocalGraph()
  }

  document.addEventListener("themechange", handleThemeChange)
  window.addCleanup(() => {
    document.removeEventListener("themechange", handleThemeChange)
  })

  const containers = [...document.getElementsByClassName("global-graph-outer")] as HTMLElement[]
  // 全部視圖：預設只顯示目前頁面所屬領域（首頁、總覽頁等顯示全部）
  let globalDomain: Domain | null = null
  function syncDomainButtons() {
    for (const btn of document.querySelectorAll<HTMLButtonElement>(".graph-domain-btn")) {
      btn.setAttribute("aria-pressed", String((btn.dataset.domain || null) === globalDomain))
    }
  }
  async function drawGlobal() {
    cleanupGlobalGraphs()
    syncDomainButtons()
    const slug = getFullSlug(window)
    for (const container of containers) {
      const graphContainer = container.querySelector(".global-graph-container") as HTMLElement
      if (graphContainer) {
        globalGraphCleanups.push(
          await renderGraph(graphContainer, slug, {
            domain: globalDomain,
            hintEl: container.querySelector(".graph-hint") as HTMLElement | null,
          }),
        )
      }
    }
  }
  function onDomainClick(this: HTMLButtonElement) {
    globalDomain = (this.dataset.domain || null) as Domain | null
    void drawGlobal()
  }
  for (const btn of document.querySelectorAll<HTMLButtonElement>(".graph-domain-btn")) {
    btn.addEventListener("click", onDomainClick)
    window.addCleanup(() => btn.removeEventListener("click", onDomainClick))
  }
  for (const btn of document.querySelectorAll<HTMLButtonElement>(".global-graph-close")) {
    btn.addEventListener("click", hideGlobalGraph)
    window.addCleanup(() => btn.removeEventListener("click", hideGlobalGraph))
  }

  async function renderGlobalGraph() {
    globalDomain = domainOf(simplifySlug(getFullSlug(window)))
    for (const container of containers) {
      container.classList.add("active")
      const sidebar = container.closest(".sidebar") as HTMLElement
      if (sidebar) {
        sidebar.style.zIndex = "1"
      }

      registerEscapeHandler(container, hideGlobalGraph)
    }
    await drawGlobal()
  }

  function hideGlobalGraph() {
    cleanupGlobalGraphs()
    for (const container of containers) {
      container.classList.remove("active")
      const sidebar = container.closest(".sidebar") as HTMLElement
      if (sidebar) {
        sidebar.style.zIndex = ""
      }
    }
  }

  async function shortcutHandler(e: HTMLElementEventMap["keydown"]) {
    if (e.key === "g" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
      e.preventDefault()
      const anyGlobalGraphOpen = containers.some((container) =>
        container.classList.contains("active"),
      )
      anyGlobalGraphOpen ? hideGlobalGraph() : renderGlobalGraph()
    }
  }

  const containerIcons = document.getElementsByClassName("global-graph-icon")
  Array.from(containerIcons).forEach((icon) => {
    icon.addEventListener("click", renderGlobalGraph)
    window.addCleanup(() => icon.removeEventListener("click", renderGlobalGraph))
  })

  document.addEventListener("keydown", shortcutHandler)
  window.addCleanup(() => {
    document.removeEventListener("keydown", shortcutHandler)
    cleanupLocalGraphs()
    cleanupGlobalGraphs()
  })
})
