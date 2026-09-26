/**
 * Anchor user highlights to rendered document text — a pdf.js text layer or
 * mammoth's HTML. A highlight keeps the selected text plus a little text
 * either side; on later visits the same text is found again and turned back
 * into a DOM Range.
 *
 * pdf.js splits text into positioned spans with its own spacing, so matching
 * ignores whitespace and case and treats typographic variants as equal.
 */

/** Characters that render or extract differently between tools. */
const EQUIVALENTS: Record<string, string> = {
  "‘": "'",
  "’": "'",
  "‚": "'",
  "‛": "'",
  "“": '"',
  "”": '"',
  "„": '"',
  "‐": "-",
  "‑": "-",
  "‒": "-",
  "–": "-",
  "—": "-",
  "―": "-",
  "−": "-",
  "ﬀ": "ff",
  "ﬁ": "fi",
  "ﬂ": "fl",
  "ﬃ": "ffi",
  "ﬄ": "ffl",
  "­": "",
}

const normalizeChar = (ch: string) =>
  /\s/.test(ch) ? "" : (EQUIVALENTS[ch] ?? ch).toLowerCase()

const normalizeText = (text: string) => Array.from(text, normalizeChar).join("")

/** Normalised characters of context kept either side of a quote. */
const CONTEXT = 32

type Position = { node: Text; offset: number }

/** Every visible character under `roots`, normalised, with where it came from. */
export type TextIndex = { text: string; positions: Position[] }

export function indexText(roots: Node[]): TextIndex {
  const chars: string[] = []
  const positions: Position[] = []
  for (const root of roots) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
      const text = node.data
      for (let offset = 0; offset < text.length; offset++) {
        for (const ch of normalizeChar(text[offset])) {
          chars.push(ch)
          positions.push({ node, offset })
        }
      }
    }
  }
  return { text: chars.join(""), positions }
}

/** What's saved to find a selection again. */
export type TextQuote = { quote: string; prefix?: string; suffix?: string }

/**
 * The quote and its context for a selected `range` inside `index`. `text` is
 * the selection as displayed (Selection.toString() keeps paragraph breaks,
 * Range.toString() runs paragraphs together).
 */
export function quoteFromRange(
  index: TextIndex,
  range: Range,
  text = range.toString(),
): TextQuote | null {
  let start = -1
  let end = -1
  let lastNode: Text | null = null
  let touches = false
  index.positions.forEach(({ node, offset }, i) => {
    if (node !== lastNode) {
      lastNode = node
      touches = range.intersectsNode(node)
    }
    if (!touches) return
    if (range.comparePoint(node, offset) === 0 && range.comparePoint(node, offset + 1) === 0) {
      if (start < 0) start = i
      end = i + 1
    }
  })
  if (start < 0) return null
  // Displayed as written; matched through normalisation, which drops the
  // spacing pdf.js adds between spans.
  const quote = text.replace(/\s+/g, " ").trim()
  if (normalizeText(quote) !== index.text.slice(start, end)) {
    // The selection reached outside the indexed text (e.g. across a page
    // that hasn't rendered); keep only what can be found again.
    return { quote: textBetween(index, start, end), prefix: "", suffix: "" }
  }
  return {
    quote,
    prefix: index.text.slice(Math.max(0, start - CONTEXT), start),
    suffix: index.text.slice(end, end + CONTEXT),
  }
}

/** The original (unnormalised) text between two index positions. */
function textBetween(index: TextIndex, start: number, end: number) {
  const range = rangeOf(index, start, end)
  return range.toString().replace(/\s+/g, " ").trim()
}

function rangeOf(index: TextIndex, start: number, end: number) {
  const range = document.createRange()
  const first = index.positions[start]
  const last = index.positions[end - 1]
  range.setStart(first.node, first.offset)
  range.setEnd(last.node, last.offset + 1)
  return range
}

const commonSuffix = (a: string, b: string) => {
  let n = 0
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++
  return n
}

const commonPrefix = (a: string, b: string) => {
  let n = 0
  while (n < a.length && n < b.length && a[n] === b[n]) n++
  return n
}

/**
 * The Range for a saved quote inside `index`, or null. When the quote occurs
 * more than once, the occurrence whose surroundings match best wins.
 */
export function findQuote(index: TextIndex, { quote, prefix = "", suffix = "" }: TextQuote) {
  const needle = normalizeText(quote)
  if (!needle) return null
  let best = -1
  let bestScore = -1
  for (let at = index.text.indexOf(needle); at >= 0; at = index.text.indexOf(needle, at + 1)) {
    const before = index.text.slice(Math.max(0, at - prefix.length), at)
    const after = index.text.slice(at + needle.length, at + needle.length + suffix.length)
    const score = commonSuffix(before, prefix) + commonPrefix(after, suffix)
    if (score > bestScore) {
      best = at
      bestScore = score
    }
  }
  return best < 0 ? null : rangeOf(index, best, best + needle.length)
}

export type Box = { left: number; top: number; width: number; height: number }

/**
 * One box per line of `range`, relative to `origin`. Uses text node boxes
 * only — a fully selected paragraph would otherwise add its whole block.
 */
export function lineBoxes(range: Range, origin: DOMRect): Box[] {
  const rects: DOMRect[] = []
  const container = range.commonAncestorContainer
  const textNodes: Text[] = []
  if (container.nodeType === Node.TEXT_NODE) {
    textNodes.push(container as Text)
  } else {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (range.intersectsNode(node)) textNodes.push(node as Text)
    }
  }
  for (const node of textNodes) {
    const part = document.createRange()
    part.selectNodeContents(node)
    if (node === range.startContainer) part.setStart(node, range.startOffset)
    if (node === range.endContainer) part.setEnd(node, range.endOffset)
    for (const rect of part.getClientRects()) {
      if (rect.width > 0.5 && rect.height > 0.5) rects.push(rect)
    }
  }

  rects.sort((a, b) => a.top - b.top || a.left - b.left)
  const lines: Array<{ left: number; top: number; right: number; bottom: number }> = []
  for (const rect of rects) {
    const line = lines.find((l) => {
      const overlap = Math.min(l.bottom, rect.bottom) - Math.max(l.top, rect.top)
      return (
        overlap > Math.min(l.bottom - l.top, rect.height) / 2 &&
        rect.left <= l.right + 8 &&
        rect.right >= l.left - 8
      )
    })
    if (line) {
      line.left = Math.min(line.left, rect.left)
      line.top = Math.min(line.top, rect.top)
      line.right = Math.max(line.right, rect.right)
      line.bottom = Math.max(line.bottom, rect.bottom)
    } else {
      lines.push({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom })
    }
  }
  // Tall glyph boxes can overlap the next line; trim so they don't stack.
  lines.sort((a, b) => a.top - b.top)
  lines.forEach((line, i) => {
    const next = lines[i + 1]
    if (next && next.top > line.top && next.top < line.bottom && next.left < line.right) {
      line.bottom = next.top
    }
  })
  return lines.map((l) => ({
    left: l.left - origin.left,
    top: l.top - origin.top,
    width: l.right - l.left,
    height: l.bottom - l.top,
  }))
}
