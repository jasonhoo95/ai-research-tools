/**
 * Find a passage (the text an answer was based on) inside rendered document
 * text — a pdf.js text layer or mammoth's HTML — and highlight it with the CSS
 * Custom Highlight API, which paints ranges without changing the DOM.
 *
 * The passage comes from the backend's own text extraction, so spacing,
 * line breaks and hyphenation differ from the rendered text. Matching ignores
 * whitespace and case, and falls back to matching the passage piece by piece.
 */

/** Characters that extract differently between tools. */
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

/** Piece size for the fallback match, and the smallest useful piece. */
const WINDOW = 48
const MIN_WINDOW = 16
/** Pieces this close together (in characters) become one highlight. */
const JOIN_GAP = 12

type Position = { node: Text; offset: number }

/** Every visible character under `root`, normalised, with where it came from. */
function indexText(root: Node) {
  const chars: string[] = []
  const positions: Position[] = []
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
  return { text: chars.join(""), positions }
}

/** Ranges covering `passage` inside `root` (empty when it can't be found). */
export function findPassageRanges(root: Node, passage: string): Range[] {
  const needle = normalizeText(passage)
  if (needle.length < MIN_WINDOW) return []
  const { text, positions } = indexText(root)
  if (!text) return []

  let spans: Array<[number, number]> = []
  const exact = text.indexOf(needle)
  if (exact >= 0) {
    spans = [[exact, exact + needle.length]]
  } else {
    // Match piece by piece, in order, and join neighbouring pieces.
    let from = 0
    for (let i = 0; i + MIN_WINDOW <= needle.length; i += WINDOW) {
      const piece = needle.slice(i, i + WINDOW)
      const at = text.indexOf(piece, from)
      if (at < 0) continue
      const last = spans.at(-1)
      if (last && at - last[1] <= JOIN_GAP) last[1] = at + piece.length
      else spans.push([at, at + piece.length])
      from = at + piece.length
    }
    // A few stray pieces aren't the passage.
    const matched = spans.reduce((sum, [a, b]) => sum + b - a, 0)
    if (matched < needle.length * 0.3) return []
  }

  return spans.map(([start, end]) => {
    const range = document.createRange()
    const first = positions[start]
    const last = positions[end - 1]
    range.setStart(first.node, first.offset)
    range.setEnd(last.node, last.offset + 1)
    return range
  })
}

const supportsHighlights = () =>
  typeof CSS !== "undefined" && "highlights" in CSS && typeof Highlight !== "undefined"

/**
 * Paint passages: `focus` stronger (the reference that was clicked), `other`
 * lighter (the answer's other passages). Replaces whatever was painted.
 */
export function paintHighlights(focus: Range[], other: Range[]) {
  if (!supportsHighlights()) return
  CSS.highlights.set("doc-reference-focus", new Highlight(...focus))
  CSS.highlights.set("doc-reference", new Highlight(...other))
}

export function clearHighlights() {
  if (!supportsHighlights()) return
  CSS.highlights.delete("doc-reference-focus")
  CSS.highlights.delete("doc-reference")
}
