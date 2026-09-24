"use client"

import * as React from "react"
import type { Descendant } from "slate"

import { SlateEditor } from "@/components/slate/slate-editor"
import { markdownToSlateDocument } from "@/components/slate/lib/markdown-to-slate"
import { Button } from "@/components/ui/button"
import type { SlideArtifact, SlideDeckSlide } from "@/lib/chat-types"

function slideMarkdown(slide: SlideDeckSlide): string | null {
  const content = slide.content?.trim()
  if (content) return content

  if (slide.bullets?.length) {
    return slide.bullets.map((bullet) => `- ${bullet}`).join("\n")
  }

  return null
}

function SlideMarkdownContent({ markdown }: { markdown: string }) {
  const document = React.useMemo<Descendant[]>(
    () => markdownToSlateDocument(markdown),
    [markdown],
  )

  return (
    <SlateEditor
      key={markdown}
      value={document}
      onChange={() => {}}
      showToolbar={false}
      enableSlashCommands={false}
      enableFloatingToolbar={false}
      className="bg-transparent shadow-none"
      editableClassName="prose prose-sm max-w-none px-0 py-0 min-h-0 outline-none text-sm text-foreground/90 [&_ul]:my-2 [&_ol]:my-2 [&_p]:my-1"
    />
  )
}

export function ArtifactSlides({ artifact }: { artifact: SlideArtifact }) {
  const [index, setIndex] = React.useState(0)
  const total = artifact.slides.length
  const slide = artifact.slides[index]

  const go = (delta: number) => {
    setIndex((i) => Math.max(0, Math.min(total - 1, i + delta)))
  }

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1)
      if (e.key === "ArrowLeft") go(-1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [total])

  return (
    <div className="flex flex-col gap-4">
      <div className="aspect-[16/9] w-full overflow-hidden rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex h-full flex-col">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Slide {index + 1} of {total}
          </div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            {slide.title}
          </h2>
          {(() => {
            const markdown = slideMarkdown(slide)
            if (!markdown) return null
            return (
              <div className="mt-4 flex-1 overflow-y-auto rounded-md bg-muted/40 p-3">
                <SlideMarkdownContent markdown={markdown} />
              </div>
            )
          })()}
          {slide.notes && (
            <div className="mt-4 rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Notes: </span>
              {slide.notes}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => go(-1)} disabled={index === 0}>
          ← Previous
        </Button>
        <div className="flex gap-1">
          {artifact.slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`h-2 w-2 rounded-full transition-colors ${i === index ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
        <Button variant="outline" onClick={() => go(1)} disabled={index === total - 1}>
          Next →
        </Button>
      </div>
    </div>
  )
}
