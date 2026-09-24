"use client"

import * as React from "react"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"

const components: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-6">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  del: ({ children }) => <del className="line-through opacity-80">{children}</del>,
  u: ({ children }) => <u className="underline underline-offset-2">{children}</u>,
  a: ({ href, children, title }) => {
    // Detect the `[N]` inline citation shape emitted by linkifyCitations —
    // e.g. children === "[1]" or a single-child span containing "[1]".
    const asText = React.Children.toArray(children)
      .map((c) => (typeof c === "string" ? c : ""))
      .join("")
    const citationMatch = asText.match(/^\[(\d+)\]$/)
    if (citationMatch) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          title={title}
          className="mx-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground/10 px-1 align-super text-[10px] font-semibold text-foreground no-underline transition-colors hover:bg-foreground/20"
        >
          {citationMatch[1]}
        </a>
      )
    }
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        title={title}
        className="underline underline-offset-2 hover:opacity-80"
      >
        {children}
      </a>
    )
  },
  ul: ({ children }) => (
    <ul className="mb-2 ml-5 list-disc space-y-1 last:mb-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 ml-5 list-decimal space-y-1 last:mb-0">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-6">{children}</li>,
  h1: ({ children }) => (
    <h1 className="mb-2 mt-3 text-lg font-semibold first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 mt-3 text-base font-semibold first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1.5 mt-3 text-sm font-semibold first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mb-1 mt-2 text-sm font-semibold first:mt-0">{children}</h4>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mb-2 border-l-2 border-current/30 pl-3 italic opacity-90 last:mb-0">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-current/20" />,
  code: ({ className, children, ...props }) => {
    const isBlock = /language-/.test(className ?? "")
    if (isBlock) {
      return (
        <code
          className={cn(
            "block whitespace-pre-wrap break-words rounded-md bg-background/60 p-3 font-mono text-xs",
            className
          )}
          {...props}
        >
          {children}
        </code>
      )
    }
    return (
      <code
        className="rounded bg-background/60 px-1 py-0.5 font-mono text-[0.85em]"
        {...props}
      >
        {children}
      </code>
    )
  },
  pre: ({ children }) => (
    <pre className="mb-2 overflow-x-auto rounded-md bg-background/60 p-0 text-xs last:mb-0">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="mb-2 overflow-x-auto last:mb-0">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="border-b border-current/20">{children}</thead>,
  th: ({ children }) => (
    <th className="px-2 py-1 text-left font-semibold">{children}</th>
  ),
  td: ({ children }) => <td className="border-t border-current/10 px-2 py-1">{children}</td>,
}

export function Markdown({
  children,
  className,
}: {
  children: string
  className?: string
}) {
  return (
    <div className={cn("break-words", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
