import type { Descendant } from "slate"

export type SlateTextMark = {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  code?: boolean
  color?: string
}

export type SlateText = {
  text: string
} & SlateTextMark

export type SlateLink = {
  type: "link"
  url: string
  children: SlateText[]
}

export type SlateInline = SlateText | SlateLink

export type SlateParagraph = {
  type: "paragraph"
  children: SlateInline[]
}

export type SlateHeadingOne = {
  type: "heading-one"
  children: SlateInline[]
}

export type SlateHeadingTwo = {
  type: "heading-two"
  children: SlateInline[]
}

export type SlateBlockQuote = {
  type: "block-quote"
  children: SlateInline[]
}

export type SlateListItem = {
  type: "list-item"
  children: SlateInline[]
}

export type SlateBulletedList = {
  type: "bulleted-list"
  children: SlateListItem[]
}

export type SlateNumberedList = {
  type: "numbered-list"
  children: SlateListItem[]
}

export type SlateTableCell = {
  id: string
  content: Descendant[]
}

export type SlateTableRow = {
  id: string
  isHeader?: boolean
  cells: SlateTableCell[]
}

export type SlateTable = {
  type: "table"
  rows: SlateTableRow[]
  columnWidths?: number[]
  rowHeights?: number[]
  children: [{ text: "" }]
}

export type SlateBlock =
  | SlateParagraph
  | SlateHeadingOne
  | SlateHeadingTwo
  | SlateBlockQuote
  | SlateBulletedList
  | SlateNumberedList
  | SlateTable

export function emptyParagraph(): SlateParagraph {
  return { type: "paragraph", children: [{ text: "" }] }
}
