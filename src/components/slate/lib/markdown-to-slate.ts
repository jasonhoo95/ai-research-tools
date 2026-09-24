import type { Content, List, PhrasingContent, Root, Table } from "mdast"
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import type { Descendant } from "slate"
import { unified } from "unified"

import {
  emptyParagraph,
  type SlateBlock,
  type SlateInline,
  type SlateListItem,
  type SlateTable,
  type SlateText,
  type SlateTextMark,
} from "./slate-content-types"

const DEFAULT_COL_WIDTH = 120
const DEFAULT_HEADER_HEIGHT = 44
const DEFAULT_BODY_HEIGHT = 72

const markdownParser = unified().use(remarkParse).use(remarkGfm)

function createId() {
  return crypto.randomUUID()
}

function mergeTextNodes(nodes: SlateInline[]): SlateInline[] {
  const merged: SlateInline[] = []

  for (const node of nodes) {
    const prev = merged[merged.length - 1]
    if (
      prev &&
      "text" in prev &&
      !("type" in prev) &&
      "text" in node &&
      !("type" in node) &&
      marksEqual(prev, node)
    ) {
      prev.text += node.text
      continue
    }
    merged.push(node)
  }

  return merged
}

function marksEqual(a: SlateTextMark, b: SlateTextMark) {
  return (
    Boolean(a.bold) === Boolean(b.bold) &&
    Boolean(a.italic) === Boolean(b.italic) &&
    Boolean(a.underline) === Boolean(b.underline) &&
    Boolean(a.code) === Boolean(b.code) &&
    (a.color ?? "") === (b.color ?? "")
  )
}

function phrasingToInlines(
  nodes: PhrasingContent[],
  inherited: SlateTextMark = {},
): SlateInline[] {
  const result: SlateInline[] = []

  for (const node of nodes) {
    switch (node.type) {
      case "text":
        if (node.value) {
          result.push({ text: node.value, ...inherited })
        }
        break
      case "strong":
        result.push(
          ...phrasingToInlines(node.children, { ...inherited, bold: true }),
        )
        break
      case "emphasis":
        result.push(
          ...phrasingToInlines(node.children, { ...inherited, italic: true }),
        )
        break
      case "delete":
        result.push(
          ...phrasingToInlines(node.children, {
            ...inherited,
            underline: true,
          }),
        )
        break
      case "inlineCode":
        result.push({ text: node.value, ...inherited, code: true })
        break
      case "link":
        result.push({
          type: "link",
          url: node.url,
          children: mergeTextNodes(
            phrasingToInlines(node.children, inherited),
          ) as SlateText[],
        })
        break
      case "break":
        result.push({ text: "\n", ...inherited })
        break
      default:
        break
    }
  }

  return mergeTextNodes(result)
}

function listItemToInlines(children: Content[]): SlateInline[] {
  const inlines: SlateInline[] = []

  for (const child of children) {
    if (child.type === "paragraph") {
      inlines.push(...phrasingToInlines(child.children))
    }
  }

  return inlines.length ? inlines : [{ text: "" }]
}

function convertList(list: List): Descendant[] {
  const items: SlateListItem[] = []
  const trailing: Descendant[] = []

  for (const listItem of list.children) {
    items.push({
      type: "list-item",
      children: listItemToInlines(listItem.children),
    })

    for (const child of listItem.children) {
      if (child.type === "list") {
        trailing.push(...convertList(child))
      }
    }
  }

  const listBlock: SlateBlock = list.ordered
    ? { type: "numbered-list", children: items }
    : { type: "bulleted-list", children: items }

  return [listBlock, ...trailing]
}

function convertTable(table: Table): SlateTable {
  const rows = table.children.map((row, rowIndex) => ({
    id: createId(),
    isHeader: rowIndex === 0,
    cells: row.children.map((cell) => ({
      id: createId(),
      content: [
        {
          type: "paragraph" as const,
          children: phrasingToInlines(cell.children),
        },
      ],
    })),
  }))

  const colCount = rows[0]?.cells.length ?? 0

  return {
    type: "table",
    rows,
    columnWidths: Array.from({ length: colCount }, () => DEFAULT_COL_WIDTH),
    rowHeights: rows.map((row) =>
      row.isHeader ? DEFAULT_HEADER_HEIGHT : DEFAULT_BODY_HEIGHT,
    ),
    children: [{ text: "" }],
  }
}

function convertBlock(node: Content): Descendant[] {
  switch (node.type) {
    case "paragraph":
      return [
        {
          type: "paragraph",
          children: phrasingToInlines(node.children),
        },
      ]
    case "heading":
      return [
        {
          type: node.depth === 1 ? "heading-one" : "heading-two",
          children: phrasingToInlines(node.children),
        },
      ]
    case "blockquote": {
      const blocks: Descendant[] = []
      for (const child of node.children) {
        if (child.type === "paragraph") {
          blocks.push({
            type: "block-quote",
            children: phrasingToInlines(child.children),
          })
        } else {
          blocks.push(...convertBlock(child))
        }
      }
      return blocks.length ? blocks : [{ type: "block-quote", children: [{ text: "" }] }]
    }
    case "list":
      return convertList(node)
    case "code":
      return [
        {
          type: "paragraph",
          children: [{ text: node.value.replace(/\n$/, ""), code: true }],
        },
      ]
    case "thematicBreak":
      return [{ type: "paragraph", children: [{ text: "---" }] }]
    case "table":
      return [convertTable(node)]
    case "html":
      return [{ type: "paragraph", children: [{ text: node.value }] }]
    default:
      return [emptyParagraph()]
  }
}

function convertRoot(root: Root): Descendant[] {
  const blocks: Descendant[] = []

  for (const node of root.children) {
    blocks.push(...convertBlock(node))
  }

  return blocks.length ? blocks : [emptyParagraph()]
}

export function markdownToSlateDocument(content: string): Descendant[] {
  const trimmed = content.trim()
  if (!trimmed) {
    return [emptyParagraph()]
  }

  const tree = markdownParser.parse(trimmed) as Root
  return convertRoot(tree)
}

/** @deprecated Use `markdownToSlateDocument`. Kept for older imports. */
export const textToSlateDocument = markdownToSlateDocument
