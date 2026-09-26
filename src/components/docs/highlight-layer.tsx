"use client"

import * as React from "react"
import { Highlighter } from "lucide-react"

import type { HighlightArtifact } from "@/lib/chat-types"
import {
  findQuote,
  indexText,
  lineBoxes,
  quoteFromRange,
  type Box,
  type TextIndex,
  type TextQuote,
} from "@/lib/text-anchor"
import { cn } from "@/lib/utils"

/** A saved highlight: its artifact_chat row id and content. */
export type DocHighlight = { id: string; artifact: HighlightArtifact }

/** A highlight to scroll to; `key` is when it was asked for (Date.now()), so repeats re-scroll. */
export type HighlightFocus = { id: string; key: number }

/** A selection the user wants to keep. */
export type NewHighlight = TextQuote & { page?: number; endPage?: number }

type Pages = { page?: number; endPage?: number }

// Stable ids for DOM roots, to share one text index between highlights.
const rootIds = new WeakMap<Node, number>()
let nextRootId = 0
const rootId = (node: Node) => {
  let id = rootIds.get(node)
  if (id === undefined) {
    id = nextRootId++
    rootIds.set(node, id)
  }
  return id
}

function pageOf(node: Node): number | undefined {
  const el = node instanceof Element ? node : node.parentElement
  const page = el?.closest<HTMLElement>("[data-page]")?.dataset.page
  return page ? Number(page) : undefined
}

/**
 * How long after a jump the view keeps following its highlight: panels
 * opening or closing resize the viewer, which re-lays out the document.
 */
const SETTLE_MS = 1500

const TOOLTIP_WIDTH = 288
/** Room the tooltip needs above a highlight, else it goes below. */
const TOOLTIP_ROOM = 96

/** Markdown → plain text for the tooltip preview. */
const plain = (markdown: string) =>
  markdown
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim()

/**
 * Drawn over a rendered document (inside a `relative` element that wraps it):
 * paints saved highlights, shows their note on hover, and offers "Insert
 * text" for the current selection.
 */
export function HighlightLayer({
  scrollEl,
  highlights,
  version,
  rootsFor,
  paged = false,
  revealPage,
  focus,
  onCreate,
  onOpen,
}: {
  /** The scrolling viewer, for scrolling to a highlight. */
  scrollEl: HTMLElement | null
  highlights: DocHighlight[]
  /** Changes when more of the document has rendered. */
  version: unknown
  /** Rendered text a highlight on these pages can be in (empty if not rendered). */
  rootsFor: (pages: Pages) => Node[]
  /** PDF: text is split into [data-page] elements. */
  paged?: boolean
  /** PDF: bring an unrendered page into view so it renders. */
  revealPage?: (page: number) => void
  focus: HighlightFocus | null
  onCreate: (highlight: NewHighlight) => void
  onOpen: (id: string) => void
}) {
  const layerRef = React.useRef<HTMLDivElement>(null)
  const [boxes, setBoxes] = React.useState<ReadonlyMap<string, Box[]>>(new Map())
  const [size, setSize] = React.useState({ width: 0, height: 0 })
  const [hover, setHover] = React.useState<{ id: string; below: boolean } | null>(null)
  const hoveredId = hover?.id ?? null
  const [flashId, setFlashId] = React.useState<string | null>(null)
  const [selection, setSelection] = React.useState<{
    highlight: NewHighlight
    x: number
    y: number
  } | null>(null)
  const revealedKey = React.useRef<number | null>(null)
  const layerWidth = size.width

  React.useEffect(() => {
    const layer = layerRef.current
    if (!layer) return
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height }),
    )
    observer.observe(layer)
    return () => observer.disconnect()
  }, [])

  // Find each highlight in the rendered text, then scroll to the focused one.
  React.useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const layer = layerRef.current
      if (!layer) return
      const origin = layer.getBoundingClientRect()
      const indexes = new Map<string, TextIndex>()
      const found = new Map<string, Range>()
      const next = new Map<string, Box[]>()
      for (const highlight of highlights) {
        const roots = rootsFor(highlight.artifact)
        if (!roots.length) continue
        const key = roots.map(rootId).join(",")
        let index = indexes.get(key)
        if (!index) {
          index = indexText(roots)
          indexes.set(key, index)
        }
        const range = findQuote(index, highlight.artifact)
        if (!range) continue
        found.set(highlight.id, range)
        next.set(highlight.id, lineBoxes(range, origin))
      }
      setBoxes(next)

      if (!focus) return
      const revealed = revealedKey.current === focus.key
      if (revealed && Date.now() - focus.key > SETTLE_MS) return
      const target = highlights.find((h) => h.id === focus.id)
      const first = next.get(focus.id)?.[0]
      if (first && scrollEl) {
        const top =
          scrollEl.scrollTop + origin.top - scrollEl.getBoundingClientRect().top + first.top
        scrollEl.scrollTo({
          top: top - scrollEl.clientHeight / 3,
          // Re-aligning after a layout change shouldn't animate again.
          behavior: revealed ? "instant" : "smooth",
        })
        if (!revealed) setFlashId(focus.id)
        revealedKey.current = focus.key
      } else if (target?.artifact.page && !rootsFor(target.artifact).length && revealPage) {
        // Its page hasn't rendered: scroll there and try again once it has.
        revealPage(target.artifact.page)
      } else {
        revealedKey.current = focus.key
      }
    })
    return () => cancelAnimationFrame(frame)
    // rootsFor / revealPage are recreated each render; `version` tracks what
    // they depend on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlights, version, size, focus, scrollEl])

  React.useEffect(() => {
    if (!flashId) return
    const timer = setTimeout(() => setFlashId(null), 1600)
    return () => clearTimeout(timer)
  }, [flashId])

  // Offer "Insert text" when text in this document is selected.
  React.useEffect(() => {
    const layer = layerRef.current
    const content = layer?.parentElement
    if (!layer || !content) return
    let timer: ReturnType<typeof setTimeout> | undefined

    const check = () => {
      const current = window.getSelection()
      if (!current || current.isCollapsed || !current.rangeCount) return setSelection(null)
      const range = current.getRangeAt(0)
      if (!content.contains(range.startContainer) || !content.contains(range.endContainer)) {
        return setSelection(null)
      }
      const pages: Pages = paged
        ? { page: pageOf(range.startContainer), endPage: pageOf(range.endContainer) }
        : {}
      const roots = rootsFor(pages)
      const quote = roots.length ? quoteFromRange(indexText(roots), range, current.toString()) : null
      const lines = lineBoxes(range, layer.getBoundingClientRect())
      const last = lines.at(-1)
      if (!quote?.quote || !last) return setSelection(null)
      setSelection({
        highlight: {
          ...quote,
          ...(pages.page ? { page: pages.page } : {}),
          ...(pages.endPage && pages.endPage !== pages.page ? { endPage: pages.endPage } : {}),
        },
        x: last.left + last.width,
        y: last.top + last.height,
      })
    }
    const onRelease = () => {
      clearTimeout(timer)
      // After the browser has finished updating the selection.
      timer = setTimeout(check, 0)
    }
    const onSelectionChange = () => {
      if (window.getSelection()?.isCollapsed ?? true) setSelection(null)
    }
    document.addEventListener("mouseup", onRelease)
    document.addEventListener("keyup", onRelease)
    document.addEventListener("selectionchange", onSelectionChange)
    return () => {
      clearTimeout(timer)
      document.removeEventListener("mouseup", onRelease)
      document.removeEventListener("keyup", onRelease)
      document.removeEventListener("selectionchange", onSelectionChange)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, paged])

  // Above the highlight, or below it when the viewer's top edge is too close.
  const showTooltip = (id: string, line: HTMLElement) => {
    const first = boxes.get(id)?.[0]
    const layer = layerRef.current
    const viewTop = scrollEl?.getBoundingClientRect().top ?? 0
    const firstTop = first && layer ? layer.getBoundingClientRect().top + first.top : 0
    setHover({ id, below: (first ? firstTop : line.getBoundingClientRect().top) - viewTop < TOOLTIP_ROOM })
  }
  const hideTooltip = (id: string) => setHover((h) => (h?.id === id ? null : h))

  const hovered = hover ? highlights.find((h) => h.id === hover.id) : undefined
  const hoveredBoxes = hover ? boxes.get(hover.id) : undefined
  const anchorBox = hover?.below ? hoveredBoxes?.at(-1) : hoveredBoxes?.[0]

  return (
    <div ref={layerRef} className="pointer-events-none absolute inset-0 z-10">
      {highlights.map((highlight) =>
        (boxes.get(highlight.id) ?? []).map((box, i) => (
          <button
            key={`${highlight.id}-${i}`}
            type="button"
            aria-label={i === 0 ? `Open highlight: ${highlight.artifact.title}` : undefined}
            aria-hidden={i === 0 ? undefined : true}
            tabIndex={i === 0 ? 0 : -1}
            onMouseEnter={(e) => showTooltip(highlight.id, e.currentTarget)}
            onMouseLeave={() => hideTooltip(highlight.id)}
            onFocus={(e) => showTooltip(highlight.id, e.currentTarget)}
            onBlur={() => hideTooltip(highlight.id)}
            onClick={() => onOpen(highlight.id)}
            className={cn(
              "pointer-events-auto absolute cursor-pointer rounded-[2px] border-b-2 border-amber-500/70 transition-colors outline-none",
              hoveredId === highlight.id || flashId === highlight.id
                ? "bg-amber-300/60"
                : "bg-amber-300/35",
              flashId === highlight.id && "animate-pulse",
            )}
            style={{
              left: box.left - 1,
              top: box.top - 1,
              width: box.width + 2,
              height: box.height + 2,
            }}
          />
        )),
      )}

      {hovered && anchorBox ? (
        <div
          role="tooltip"
          className="absolute rounded-xl bg-foreground px-3 py-2 text-background shadow-lg"
          style={{
            left: Math.max(0, Math.min(anchorBox.left, layerWidth - TOOLTIP_WIDTH)),
            top: hover?.below ? anchorBox.top + anchorBox.height + 8 : anchorBox.top - 8,
            width: TOOLTIP_WIDTH,
            transform: hover?.below ? undefined : "translateY(-100%)",
          }}
        >
          <p className="truncate text-sm font-semibold">{hovered.artifact.title}</p>
          {hovered.artifact.description ? (
            <p className="mt-0.5 line-clamp-2 text-xs opacity-80">
              {plain(hovered.artifact.description)}
            </p>
          ) : null}
          <p className="mt-1 text-[11px] opacity-60">Click to open</p>
        </div>
      ) : null}

      {selection ? (
        <button
          type="button"
          // Keep the selection while clicking.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            onCreate(selection.highlight)
            setSelection(null)
          }}
          className="pointer-events-auto absolute flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-xs font-medium whitespace-nowrap text-background shadow-lg transition-transform hover:scale-105"
          style={{
            left: Math.max(64, Math.min(selection.x, layerWidth - 64)),
            top: selection.y + 8,
          }}
        >
          <Highlighter className="size-3.5" />
          Insert text
        </button>
      ) : null}
    </div>
  )
}
