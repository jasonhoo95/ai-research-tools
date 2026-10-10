"use client"

import * as React from "react"
import type { CitationSource, SearchProvider } from "@/lib/chat-types"

interface Props {
  sources: CitationSource[]
  provider?: SearchProvider
}

function faviconFor(uri: string): string | null {
  try {
    const domain = new URL(uri).hostname
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
  } catch {
    return null
  }
}

function shortDomain(source: CitationSource): string {
  if (source.domain) return source.domain
  try {
    return new URL(source.uri).hostname.replace(/^www\./, "")
  } catch {
    return "source"
  }
}

/**
 * Compact "Sources" strip rendered at the bottom of assistant messages.
 * Matches OpenAI's numbered chip style: favicon + numbered index + domain,
 * with the full title tooltiped and clicking opens the source in a new tab.
 */
export function Citations({ sources, provider }: Props) {
  if (!sources.length) return null


  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-current/10 pt-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-semibold uppercase tracking-wider">Sources</span>
      </div>
      <ol className="flex flex-wrap gap-2 text-xs">
        {sources.map((source, i) => {
          const n = i + 1
          const favicon = faviconFor(source.uri)
          const domain = shortDomain(source)
          const title = source.title?.trim() || domain
          return (
            <li key={`${source.uri}-${n}`}>
              <a
                href={source.uri}
                target="_blank"
                rel="noreferrer noopener"
                title={source.title ? `${source.title}\n${source.uri}` : source.uri}
                className="group inline-flex max-w-[280px] items-center gap-2 rounded-full border bg-background/70 py-1 pr-2.5 pl-1 transition-colors hover:bg-background"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-foreground">
                  {n}
                </span>
                {favicon && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={favicon}
                    alt=""
                    width={14}
                    height={14}
                    className="h-3.5 w-3.5 shrink-0 rounded-sm"
                  />
                )}
                <span className="min-w-0 truncate text-foreground group-hover:underline">
                  {title}
                </span>
                <span className="shrink-0 text-muted-foreground">{domain}</span>
              </a>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/**
 * Rewrite `[1]`, `[2, 3]`, `[1][2]` etc. in a Gemini reply into markdown
 * links pointing at the matching source. The Markdown renderer then styles
 * them as compact chips (see `<a>` in `src/components/markdown.tsx`).
 */
export function linkifyCitations(
  text: string,
  sources: CitationSource[],
): string {
  if (!sources.length) return text

  // Match [1], [12], [1, 2], [1,2,3] — a comma-separated list of digits inside
  // brackets. Convert each number to its own markdown link.
  return text.replace(/\[(\s*\d+(?:\s*,\s*\d+)*\s*)\]/g, (_match, group: string) => {
    const numbers = group
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0)
    if (numbers.length === 0) return `[${group}]`

    return numbers
      .map((n) => {
        const source = sources[n - 1]
        if (!source) return `[${n}]`
        // Escape any '(' or ')' in URLs to keep markdown parsing safe.
        const safeUri = source.uri.replace(/\(/g, "%28").replace(/\)/g, "%29")
        const title = (source.title ?? source.uri).replace(/"/g, '\\"')
        return `[[${n}]](${safeUri} "${title}")`
      })
      .join("")
  })
}
