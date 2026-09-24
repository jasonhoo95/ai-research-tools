"use client"

import * as React from "react"
import { Check, Palette } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  SLIDE_THEME_IDS,
  SLIDE_THEMES,
  type SlideThemeId,
} from "@/components/artifact/slide-themes"

/** Mini cover + split slide drawn from the theme's swatch colours. */
function ThemePreview({ id }: { id: SlideThemeId }) {
  const { swatch, titleFont } = SLIDE_THEMES[id]
  return (
    <div className="flex gap-1.5">
      <div
        className="flex aspect-[16/9] flex-1 flex-col justify-center overflow-hidden rounded-md px-2"
        style={{ background: swatch.cover }}
      >
        <div
          className="mb-1 h-[3px] w-4 rounded-full"
          style={{ background: swatch.accent }}
        />
        <div
          className={cn("text-[9px] font-bold leading-tight", titleFont)}
          style={{ color: swatch.ink }}
        >
          Aa Title
        </div>
      </div>
      <div
        className="flex aspect-[16/9] flex-1 overflow-hidden rounded-md ring-1 ring-black/5"
        style={{ background: swatch.surface }}
      >
        <div className="w-2/5" style={{ background: swatch.panel }} />
        <div className="flex flex-1 flex-col gap-1 p-1.5">
          <div className="h-1 w-full rounded-sm bg-black/15" />
          <div className="h-1 w-4/5 rounded-sm bg-black/10" />
          <div className="h-1 w-3/5 rounded-sm bg-black/10" />
        </div>
      </div>
    </div>
  )
}

/** Toolbar button that opens a panel of deck themes. */
export function SlideThemePicker({
  value,
  onChange,
}: {
  value: SlideThemeId
  onChange: (theme: SlideThemeId) => void
}) {
  const [open, setOpen] = React.useState(false)
  const rootRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Palette className="size-4" />
        Theme
      </Button>

      {open && (
        <div
          role="listbox"
          aria-label="Deck theme"
          className="absolute right-0 top-10 z-50 w-[min(300px,calc(100vw-32px))] rounded-xl border bg-popover p-2 text-popover-foreground shadow-lg"
        >
          {SLIDE_THEME_IDS.map((id) => {
            const theme = SLIDE_THEMES[id]
            const selected = id === value
            return (
              <button
                key={id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(id)
                  setOpen(false)
                }}
                className={cn(
                  "flex w-full flex-col gap-2 rounded-lg p-2 text-left transition-colors hover:bg-muted",
                  selected && "bg-muted ring-1 ring-border",
                )}
              >
                <ThemePreview id={id} />
                <span className="flex items-center justify-between gap-2">
                  <span>
                    <span className="block text-sm font-medium">{theme.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {theme.description}
                    </span>
                  </span>
                  {selected && <Check className="size-4 shrink-0" />}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
