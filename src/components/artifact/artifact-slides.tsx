"use client"

import * as React from "react"
import type { Descendant } from "slate"

import { SlateEditor } from "@/components/slate/slate-editor"
import { markdownToSlateDocument } from "@/components/slate/lib/markdown-to-slate"
import {
  ChevronLeft,
  ChevronRight,
  Minimize2,
  Plus,
  Presentation,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { SlideArtifact, SlideDeckSlide } from "@/lib/chat-types"
import type { MessageArtifactResult } from "@/lib/chat-repo"
import {
  resolveSlideTheme,
  type SlideTheme,
  type SlideThemeId,
} from "@/components/artifact/slide-themes"
import { SlideThemePicker } from "@/components/artifact/slide-theme-picker"
import { useArtifactTitle, useSaveArtifact } from "@/components/artifact/artifact-document"

const SAVE_DELAY_MS = 600

/** Raw chatbot_message row returned by the message-artifact endpoint. */
type StoredArtifactRow = {
  id: string
  parent_chatbot_id: string
  content: { id: string; artifact: SlideArtifact }
}

function slideBody(slide: SlideDeckSlide): Descendant[] | null {
  if (Array.isArray(slide.content)) return slide.content

  const content = slide.content?.trim()
  if (content) return markdownToSlateDocument(content)

  if (slide.bullets?.length) {
    return markdownToSlateDocument(
      slide.bullets.map((bullet) => `- ${bullet}`).join("\n"),
    )
  }

  return null
}

const EMPTY_BODY: Descendant[] = [{ type: "paragraph", children: [{ text: "" }] }]

function SlideContentEditor({
  value,
  onChange,
  toneClassName,
}: {
  value: Descendant[]
  onChange: (value: Descendant[]) => void
  toneClassName: string
}) {
  return (
    <SlateEditor
      value={value}
      onChange={onChange}
      showToolbar={false}
      enableSlashCommands={false}
      enableFloatingToolbar={false}
      className="bg-transparent shadow-none"
      editableClassName={cn(
        "max-w-none px-0 py-0 min-h-[2em] outline-none text-[max(12px,1.55cqw)] leading-relaxed",
        "[&_p]:my-[0.6em] [&_ul]:my-[0.6em] [&_ol]:my-[0.6em] [&_li]:my-[0.35em]",
        "[&_ul]:list-disc [&_ul]:pl-[1.2em] [&_ol]:list-decimal [&_ol]:pl-[1.2em]",
        "[&_h1]:text-[1.5em] [&_h2]:text-[1.25em] [&_h3]:text-[1.1em] [&_h1,&_h2,&_h3]:mt-[0.9em] [&_h1,&_h2,&_h3]:mb-[0.3em] [&_h1,&_h2,&_h3]:font-semibold [&_h1,&_h2,&_h3]:tracking-tight",
        "[&_blockquote]:border-l-[3px] [&_blockquote]:pl-[0.9em] [&_blockquote]:italic",
        toneClassName,
      )}
    />
  )
}

type SlideLayout = "cover" | "split" | "standard"

/** Cover first, then alternate layouts so the deck has visual rhythm. */
function layoutFor(index: number): SlideLayout {
  if (index === 0) return "cover"
  return index % 2 === 1 ? "split" : "standard"
}

function plainText(nodes: Descendant[] | null): string {
  if (!nodes) return ""
  const out: string[] = []
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return
    if ("text" in node && typeof node.text === "string") out.push(node.text)
    if ("children" in node && Array.isArray(node.children)) {
      node.children.forEach(walk)
      out.push(" ")
    }
  }
  nodes.forEach(walk)
  return out.join("").replace(/\s+/g, " ").trim()
}

const pad = (n: number) => String(n).padStart(2, "0")

/**
 * Slide title. Editable on the main stage (a borderless textarea that grows
 * with its content), plain text in thumbnails.
 */
function SlideTitle({
  value,
  onChange,
  className,
}: {
  value: string
  onChange?: (value: string) => void
  className: string
}) {
  const ref = React.useRef<HTMLTextAreaElement>(null)

  // Grow to fit the wrapped title; re-measure when the slide resizes since
  // the font size scales with the slide width.
  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => {
      el.style.height = "auto"
      el.style.height = `${el.scrollHeight}px`
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(el.parentElement ?? el)
    return () => observer.disconnect()
  }, [value])

  if (!onChange) return <h2 className={className}>{value}</h2>
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\n/g, " "))}
      onKeyDown={(e) => {
        // Titles are single-line; Enter just commits.
        if (e.key === "Enter") e.preventDefault()
      }}
      rows={1}
      placeholder="Slide title"
      aria-label="Slide title"
      className={cn(
        "block w-full shrink-0 resize-none overflow-hidden border-0 bg-transparent p-0 outline-none placeholder:opacity-40 focus:ring-0",
        className,
      )}
    />
  )
}

/**
 * A single designed slide. `body` is either the live editor (main stage) or
 * a plain-text preview (thumbnails).
 */
function SlideCanvas({
  theme,
  layout,
  title,
  onTitleChange,
  deckTitle,
  number,
  total,
  body,
}: {
  theme: SlideTheme
  layout: SlideLayout
  title: string
  onTitleChange?: (value: string) => void
  deckTitle: string
  number: number
  total: number
  body: React.ReactNode
}) {
  if (layout === "cover") {
    const t = theme.cover
    return (
      <div
        className={cn(
          "relative flex h-full flex-col justify-center overflow-hidden px-[7%] py-[6%]",
          t.background,
        )}
      >
        <div className={cn("pointer-events-none absolute -right-[12%] -top-[30%] aspect-square w-[55%] rounded-full blur-[6cqw]", t.glowA)} />
        <div className={cn("pointer-events-none absolute -bottom-[35%] left-[20%] aspect-square w-[45%] rounded-full blur-[6cqw]", t.glowB)} />
        <div className="relative flex min-h-0 flex-col">
          <div className={cn("mb-[2.5cqw] h-[0.45cqw] w-[7cqw] rounded-full", t.accentBar)} />
          <SlideTitle
            value={title}
            onChange={onTitleChange}
            className={cn(
              "max-w-[85%] text-[4.6cqw] font-bold leading-[1.08] tracking-tight",
              theme.titleFont,
              t.title,
            )}
          />
          {body && (
            <div className="mt-[2.5cqw] max-w-[75%] min-h-0 overflow-y-auto">
              {body}
            </div>
          )}
        </div>
        <div className={cn("absolute bottom-[5%] left-[7%] right-[7%] flex items-center justify-between text-[1.05cqw] uppercase tracking-[0.2em]", t.meta)}>
          <span className="truncate">{deckTitle}</span>
          <span>{total} slides</span>
        </div>
      </div>
    )
  }

  const footer = (
    <div className={cn("flex items-center justify-between text-[1.05cqw] uppercase tracking-[0.18em]", theme.footer)}>
      <span className="truncate pr-4">{deckTitle}</span>
      <span className="tabular-nums">
        {pad(number)} / {pad(total)}
      </span>
    </div>
  )

  if (layout === "split") {
    const t = theme.split
    return (
      <div className={cn("flex h-full", t.background)}>
        <div className={cn("relative flex w-[38%] shrink-0 flex-col justify-between overflow-hidden px-[4%] py-[5%]", t.panel)}>
          <div className={cn("pointer-events-none absolute -bottom-[20%] -right-[30%] aspect-square w-[90%] rounded-full", t.panelShape)} />
          <span className={cn("relative text-[7cqw] font-bold leading-none tabular-nums", theme.titleFont, t.panelNumber)}>
            {pad(number)}
          </span>
          <div className="relative">
            <SlideTitle
              value={title}
              onChange={onTitleChange}
              className={cn(
                "text-[3cqw] font-bold leading-[1.12] tracking-tight",
                theme.titleFont,
                t.panelTitle,
              )}
            />
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col px-[5%] py-[5%]">
          <div className="min-h-0 flex-1 overflow-y-auto">{body}</div>
          <div className="pt-[2cqw]">{footer}</div>
        </div>
      </div>
    )
  }

  const t = theme.standard
  return (
    <div className={cn("flex h-full flex-col px-[6%] py-[5%]", t.background)}>
      <div className={cn("text-[1.1cqw] font-semibold uppercase tracking-[0.2em]", t.number)}>
        {pad(number)}
      </div>
      <div className="mt-[0.8cqw]">
        <SlideTitle
          value={title}
          onChange={onTitleChange}
          className={cn(
            "text-[3.2cqw] font-bold leading-[1.12] tracking-tight",
            theme.titleFont,
            t.title,
          )}
        />
      </div>
      <div className={cn("mb-[2cqw] mt-[1.6cqw] h-[0.35cqw] w-[5cqw] rounded-full", t.underline)} />
      <div className="min-h-0 flex-1 overflow-y-auto">{body}</div>
      <div className="pt-[2cqw]">{footer}</div>
    </div>
  )
}

function isEditableTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA")
  )
}

let keySeq = 0
const newKey = () => `slide-${++keySeq}`

/** How long presentation controls stay up after the pointer stops moving. */
const CONTROLS_IDLE_MS = 2500

/**
 * Presentation controls: shown while the viewer moves the pointer, taps or
 * presses a key, faded out after a short idle so they don't cover the slide.
 * `wake` shows them right away (e.g. when the presentation starts).
 */
function useControlsVisibility(active: boolean) {
  const [visible, setVisible] = React.useState(true)
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const wake = React.useCallback(() => {
    setVisible(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setVisible(false), CONTROLS_IDLE_MS)
  }, [])

  React.useEffect(() => {
    if (!active) return
    const events = ["mousemove", "pointerdown", "keydown", "touchstart"] as const
    for (const name of events) window.addEventListener(name, wake, { passive: true })
    return () => {
      for (const name of events) window.removeEventListener(name, wake)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [active, wake])

  return [visible, wake] as const
}

export function ArtifactSlides({
  data,
  artifact,
}: {
  data: MessageArtifactResult
  artifact: SlideArtifact
}) {
  // Local copy of the deck. Slate editors are uncontrolled after mount, so
  // writing body edits back here doesn't disturb typing.
  const [slides, setSlides] = React.useState<SlideDeckSlide[]>(artifact.slides)
  const [keys, setKeys] = React.useState(() => artifact.slides.map(newKey))
  const [themeId, setThemeId] = React.useState<SlideThemeId>(
    resolveSlideTheme(artifact.theme).id,
  )
  const [index, setIndex] = React.useState(0)

  const slidesRef = React.useRef(slides)
  const themeRef = React.useRef(themeId)
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    slidesRef.current = artifact.slides
    themeRef.current = resolveSlideTheme(artifact.theme).id
    setSlides(artifact.slides)
    setKeys(artifact.slides.map(newKey))
    setThemeId(themeRef.current)
    setIndex((i) => Math.min(i, Math.max(0, artifact.slides.length - 1)))
  }, [artifact])

  const theme = resolveSlideTheme(themeId)
  const total = slides.length
  const slide = slides[index] ?? slides[0]

  const saveArtifact = useSaveArtifact()

  const saveNow = React.useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }

    const row = data as unknown as StoredArtifactRow
    const artifactData = {
      id: row.content.id,
      artifact: {
        ...row.content.artifact,
        theme: themeRef.current,
        slides: slidesRef.current,
      },
    }

    const serialized = JSON.stringify(artifactData)
    if (serialized === lastSavedRef.current) return
    lastSavedRef.current = serialized

    saveArtifact(
        row.parent_chatbot_id,
        row.id,
        artifactData as never,
      )
      .catch((err) => {
        lastSavedRef.current = null
        console.error("Failed to save slides", err)
      })
  }, [data, saveArtifact])

  const scheduleSave = React.useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(saveNow, SAVE_DELAY_MS)
  }, [saveNow])

  // Flush any pending edit when leaving the page.
  React.useEffect(
    () => () => {
      if (saveTimerRef.current) saveNow()
    },
    [saveNow],
  )

  const commitSlides = React.useCallback(
    (next: SlideDeckSlide[]) => {
      slidesRef.current = next
      setSlides(next)
      scheduleSave()
    },
    [scheduleSave],
  )

  const bodies = React.useMemo(() => slides.map(slideBody), [slides])
  const body = bodies[index]

  const handleBodyChange = React.useCallback(
    (value: Descendant[]) => {
      // Slate also fires onChange for selection-only changes (clicks, caret
      // moves) with a fresh array, so compare content rather than identity.
      const current = slideBody(slidesRef.current[index])
      if (JSON.stringify(value) === JSON.stringify(current)) return
      commitSlides(
        slidesRef.current.map((s, i) => (i === index ? { ...s, content: value } : s)),
      )
    },
    [index, commitSlides],
  )

  const handleTitleChange = (value: string) => {
    commitSlides(
      slidesRef.current.map((s, i) => (i === index ? { ...s, title: value } : s)),
    )
  }

  const handleThemeChange = (id: SlideThemeId) => {
    if (id === themeRef.current) return
    themeRef.current = id
    setThemeId(id)
    scheduleSave()
  }

  const addSlide = () => {
    const at = index + 1
    const next = [...slidesRef.current]
    next.splice(at, 0, { title: "New slide", content: EMPTY_BODY })
    setKeys((prev) => {
      const k = [...prev]
      k.splice(at, 0, newKey())
      return k
    })
    commitSlides(next)
    setIndex(at)
  }

  const deleteSlide = () => {
    if (slidesRef.current.length <= 1) return
    const at = index
    setKeys((prev) => prev.filter((_, i) => i !== at))
    commitSlides(slidesRef.current.filter((_, i) => i !== at))
    setIndex(Math.max(0, at - 1))
  }

  const go = (delta: number) => {
    setIndex((i) => Math.max(0, Math.min(total - 1, i + delta)))
  }

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Arrow keys move the caret while editing a slide, not the deck.
      if (isEditableTarget(e.target)) return
      if (e.key === "ArrowRight") go(1)
      if (e.key === "ArrowLeft") go(-1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [total])

  const stageRef = React.useRef<HTMLDivElement>(null)
  const [presenting, setPresenting] = React.useState(false)
  // Follows renames made in the page heading.
  const deckTitle = useArtifactTitle(artifact.title)
  const [controlsVisible, wakeControls] = useControlsVisibility(presenting)

  // Presenting always shows a full-window overlay; real fullscreen is a
  // bonus where the browser allows it (it can be blocked, e.g. in iframes).
  React.useEffect(() => {
    if (!presenting) return
    const onFullscreenChange = () => {
      // Leaving browser fullscreen (Esc) ends the presentation too.
      if (!document.fullscreenElement) setPresenting(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) setPresenting(false)
    }
    document.addEventListener("fullscreenchange", onFullscreenChange)
    window.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange)
      window.removeEventListener("keydown", onKey)
    }
  }, [presenting])

  const togglePresent = () => {
    if (presenting) {
      setPresenting(false)
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => { })
      return
    }
    setPresenting(true)
    wakeControls()
    stageRef.current?.requestFullscreen?.().catch(() => { })
  }

  // Keep the active thumbnail in view as the deck advances.
  const thumbRefs = React.useRef<(HTMLButtonElement | null)[]>([])
  React.useEffect(() => {
    thumbRefs.current[index]?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    })
  }, [index])

  if (!slide) return null
  const layout = layoutFor(index)

  return (
    <div className="flex flex-col gap-4 lg:flex-row border border-border rounded-lg p-4">
      {/* Filmstrip */}
      <nav
        aria-label="Slides"
        className="-mx-1 flex shrink-0 gap-3 overflow-x-auto px-1 pb-1 lg:mx-0 lg:max-h-[calc(100vh-220px)] lg:w-44 lg:flex-col lg:overflow-y-auto lg:overflow-x-visible lg:px-0 lg:pb-0 lg:pr-1"
      >
        {slides.map((s, i) => {
          const text = plainText(bodies[i])
          const thumbLayout = layoutFor(i)
          return (
            <button
              key={keys[i] ?? i}
              ref={(el) => {
                thumbRefs.current[i] = el
              }}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Go to slide ${i + 1}: ${s.title}`}
              aria-current={i === index ? "true" : undefined}
              className="group flex w-36 shrink-0 items-start gap-2 text-left lg:w-full"
            >
              <span
                className={cn(
                  "w-4 pt-0.5 text-right text-[11px] tabular-nums",
                  i === index ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {i + 1}
              </span>
              <span
                className={cn(
                  "@container pointer-events-none relative aspect-[16/9] flex-1 overflow-hidden rounded-md shadow-sm ring-1 transition",
                  i === index
                    ? "ring-2 ring-foreground"
                    : "ring-border group-hover:ring-foreground/40",
                )}
              >
                <SlideCanvas
                  theme={theme}
                  layout={thumbLayout}
                  title={s.title}
                  deckTitle={deckTitle}
                  number={i + 1}
                  total={total}
                  body={
                    text ? (
                      <p
                        className={cn(
                          "line-clamp-4 text-[1.6cqw] leading-snug",
                          thumbLayout === "cover" ? theme.body.dark : theme.body.light,
                        )}
                      >
                        {text}
                      </p>
                    ) : null
                  }
                />
              </span>
            </button>
          )
        })}
        <button
          type="button"
          onClick={addSlide}
          className="flex w-36 shrink-0 items-center justify-center gap-1.5 rounded-md border border-dashed py-3 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground lg:ml-6 lg:w-auto"
        >
          <Plus className="size-3.5" />
          New slide
        </button>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => go(-1)}
              disabled={index === 0}
              aria-label="Previous slide"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-14 text-center text-sm tabular-nums text-muted-foreground">
              {index + 1} / {total}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => go(1)}
              disabled={index === total - 1}
              aria-label="Next slide"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={addSlide} className="gap-1.5">
              <Plus className="size-4" />
              Add slide
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={deleteSlide}
              disabled={total <= 1}
              aria-label="Delete slide"
              title="Delete slide"
            >
              <Trash2 className="size-4" />
            </Button>
            <SlideThemePicker value={themeId} onChange={handleThemeChange} />
            <Button size="sm" onClick={togglePresent} className="gap-1.5">
              <Presentation className="size-4" />
              Present
            </Button>
          </div>
        </div>

        {/* Stage */}
        <div
          ref={stageRef}
          className={cn(
            "relative",
            presenting &&
            "fixed inset-0 z-[100] flex items-center justify-center bg-black",
          )}
        >
          <div
            className={cn(
              "@container aspect-[16/9] overflow-hidden",
              presenting
                ? "w-[min(100vw,177.78vh)]"
                : "w-full rounded-xl shadow-[0_1px_2px_rgb(0_0_0/0.06),0_12px_32px_-12px_rgb(0_0_0/0.25)] ring-1 ring-black/5",
            )}
          >
            <SlideCanvas
              theme={theme}
              layout={layout}
              title={slide.title}
              onTitleChange={handleTitleChange}
              deckTitle={deckTitle}
              number={index + 1}
              total={total}
              body={
                // Keyed by slide so switching slides remounts with its content.
                <SlideContentEditor
                  key={keys[index] ?? index}
                  value={body ?? EMPTY_BODY}
                  onChange={handleBodyChange}
                  toneClassName={layout === "cover" ? theme.body.dark : theme.body.light}
                />
              }
            />
          </div>

          {presenting && (
            <>
              {/* Arrows on the screen edges, like a slideshow viewer. */}
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Previous slide"
                tabIndex={index === 0 ? -1 : 0}
                className={cn(
                  "absolute top-1/2 left-4 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white shadow-lg ring-1 ring-white/15 backdrop-blur transition-opacity duration-300 hover:bg-black/70 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none sm:left-6",
                  (!controlsVisible || index === 0) && "pointer-events-none opacity-0",
                )}
              >
                <ChevronLeft className="size-6" />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Next slide"
                tabIndex={index === total - 1 ? -1 : 0}
                className={cn(
                  "absolute top-1/2 right-4 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white shadow-lg ring-1 ring-white/15 backdrop-blur transition-opacity duration-300 hover:bg-black/70 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none sm:right-6",
                  (!controlsVisible || index === total - 1) && "pointer-events-none opacity-0",
                )}
              >
                <ChevronRight className="size-6" />
              </button>

              <div
                className={cn(
                  "absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-white shadow-lg ring-1 ring-white/15 backdrop-blur transition-opacity duration-300",
                  !controlsVisible && "pointer-events-none opacity-0",
                )}
              >
                <button type="button" onClick={() => go(-1)} disabled={index === 0} aria-label="Previous slide" className="rounded-full p-1.5 hover:bg-white/15 disabled:opacity-40">
                  <ChevronLeft className="size-4" />
                </button>
                <span className="px-1 text-xs tabular-nums">
                  {index + 1} / {total}
                </span>
                <button type="button" onClick={() => go(1)} disabled={index === total - 1} aria-label="Next slide" className="rounded-full p-1.5 hover:bg-white/15 disabled:opacity-40">
                  <ChevronRight className="size-4" />
                </button>
                <span className="mx-1 h-4 w-px bg-white/20" />
                <button type="button" onClick={togglePresent} aria-label="Exit presentation" className="rounded-full p-1.5 hover:bg-white/15">
                  <Minimize2 className="size-4" />
                </button>
              </div>
            </>
          )}
        </div>


      </div>
    </div>
  )
}
