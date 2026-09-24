import type { Descendant } from "slate"
import { Element as SlateElement, Text } from "slate"

import type { SlateInline, SlateTextMark } from "./slate-content-types"

function isLinkNode(node: unknown): node is {
  type: "link"
  url: string
  children: Descendant[]
} {
  return (
    typeof node === "object" &&
    node !== null &&
    "type" in node &&
    (node as { type: string }).type === "link"
  )
}

function escapeMarkdownText(value: string) {
  return value.replace(/([\\`*_{}[\]()#+\-.!|>])/g, "\\$1")
}

function applyMarks(text: string, marks: SlateTextMark) {
  let output = text
  if (!output) return output

  if (marks.code) {
    return `\`${output.replace(/`/g, "\\`")}\``
  }

  if (marks.bold && marks.italic) {
    output = `***${output}***`
  } else if (marks.bold) {
    output = `**${output}**`
  } else if (marks.italic) {
    output = `*${output}*`
  }

  if (marks.underline) {
    output = `<u>${output}</u>`
  }

  return output
}

function inlinesToMarkdown(
  nodes: Descendant[],
  inherited: SlateTextMark = {},
): string {
  return nodes
    .map((node) => {
      if (Text.isText(node)) {
        const marks: SlateTextMark = {
          bold: inherited.bold || node.bold,
          italic: inherited.italic || node.italic,
          underline: inherited.underline || node.underline,
          code: inherited.code || node.code,
          color: inherited.color ?? node.color,
        }
        return applyMarks(escapeMarkdownText(node.text), marks)
      }

      if (isLinkNode(node)) {
        const label = inlinesToMarkdown(node.children, inherited)
        return `[${label || node.url}](${node.url})`
      }

      return ""
    })
    .join("")
}

function blockToMarkdown(node: Descendant): string {
  if (!SlateElement.isElement(node)) {
    return Text.isText(node) ? node.text : ""
  }

  switch (node.type) {
    case "heading-one":
      return `# ${inlinesToMarkdown(node.children)}\n\n`
    case "heading-two":
      return `## ${inlinesToMarkdown(node.children)}\n\n`
    case "block-quote":
      return `> ${inlinesToMarkdown(node.children)}\n\n`
    case "bulleted-list":
      return (
        node.children
          .map((item) => {
            if (!SlateElement.isElement(item) || item.type !== "list-item") {
              return ""
            }
            return `- ${inlinesToMarkdown(item.children)}`
          })
          .filter(Boolean)
          .join("\n") + "\n\n"
      )
    case "numbered-list":
      return (
        node.children
          .map((item, index) => {
            if (!SlateElement.isElement(item) || item.type !== "list-item") {
              return ""
            }
            return `${index + 1}. ${inlinesToMarkdown(item.children)}`
          })
          .filter(Boolean)
          .join("\n") + "\n\n"
      )
    case "table": {
      const rows = node.rows ?? []
      if (!rows.length) return "\n"

      const lines = rows.map((row) =>
        row.cells
          .map((cell) => {
            const paragraph = cell.content[0]
            if (
              paragraph &&
              SlateElement.isElement(paragraph) &&
              paragraph.type === "paragraph"
            ) {
              return inlinesToMarkdown(paragraph.children as SlateInline[])
            }
            return ""
          })
          .join(" | "),
      )

      if (lines.length > 1) {
        const separator = lines[0]
          .split("|")
          .map(() => "---")
          .join(" | ")
        lines.splice(1, 0, separator)
      }

      return `${lines.join("\n")}\n\n`
    }
    case "paragraph":
    default:
      return `${inlinesToMarkdown(node.children)}\n\n`
  }
}

export function slateDocumentToMarkdown(document: Descendant[]): string {
  return document
    .map((node) => blockToMarkdown(node))
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/** Plain-text fallback when markdown structure isn't needed. */
export function slateDocumentToText(document: Descendant[]): string {
  return document
    .map((node) => {
      if (Text.isText(node)) return node.text
      if (SlateElement.isElement(node)) {
        if (node.type === "table") {
          return node.rows
            .map((row) =>
              row.cells
                .map((cell) =>
                  cell.content
                    .map((child) => blockToMarkdown(child).trim())
                    .join(" "),
                )
                .join("\t"),
            )
            .join("\n")
        }
        return inlinesToMarkdown(node.children as Descendant[])
      }
      return ""
    })
    .join("\n\n")
    .trim()
}
