"use client"

import * as React from "react"
import {
  BarChart3,
  Brain,
  Loader2,
  Network,
  Plus,
  Presentation,
  StickyNote,
  Table2,
  UserRound,
  type LucideIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { ArtifactKind } from "@/lib/chat-types"

/** Kinds the backend can generate from a prompt. */
export type CreatableArtifactKind = Exclude<ArtifactKind, "notes" | "highlight">

type KindOption = {
  kind: CreatableArtifactKind
  label: string
  description: string
  icon: LucideIcon
  tint: string
  placeholder: string
}

const KIND_OPTIONS: KindOption[] = [
  {
    kind: "slide",
    label: "Slide deck",
    description: "A presentation with titled slides",
    icon: Presentation,
    tint: "bg-orange-50 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400",
    placeholder: "e.g. A 6-slide overview of Grab's history, business lines and competitors",
  },
  {
    kind: "notesboard",
    label: "Notes board",
    description: "A board of organised notes",
    icon: StickyNote,
    tint: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
    placeholder: "e.g. Key takeaways from this conversation, grouped by topic",
  },
  {
    kind: "table",
    label: "Table",
    description: "Rows and columns of data",
    icon: Table2,
    tint: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
    placeholder: "e.g. Compare Grab, Gojek and Bolt by founding year, HQ and markets",
  },
  {
    kind: "chart",
    label: "Chart",
    description: "A bar, line or donut chart",
    icon: BarChart3,
    tint: "bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400",
    placeholder: "e.g. Grab's annual revenue from 2019 to 2024",
  },
  {
    kind: "bio",
    label: "Profile",
    description: "A LinkedIn-style profile page",
    icon: UserRound,
    tint: "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
    placeholder: "e.g. A profile of Anthony Tan, co-founder of Grab",
  },
  {
    kind: "quiz",
    label: "Quiz",
    description: "Multiple-choice questions",
    icon: Brain,
    tint: "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400",
    placeholder: "e.g. 8 questions testing what we discussed about Najib's pardon",
  },
  {
    kind: "mindmap",
    label: "Mind map",
    description: "A flow of connected ideas or events",
    icon: Network,
    tint: "bg-teal-50 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400",
    placeholder: "e.g. The sequence of World War 1, from its causes to the Treaty of Versailles",
  },
]

export type CreateArtifactInput = {
  kind: CreatableArtifactKind
  title: string
  prompt: string
}

/**
 * Plus button with a menu of artifact types. Picking one opens a dialog for
 * a title and prompt; `onCreate` generates and saves the artifact.
 */
export function CreateArtifactMenu({
  onCreate,
}: {
  onCreate: (input: CreateArtifactInput) => Promise<void>
}) {
  const [option, setOption] = React.useState<KindOption | null>(null)
  const [open, setOpen] = React.useState(false)
  const [title, setTitle] = React.useState("")
  const [prompt, setPrompt] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const choose = (next: KindOption) => {
    setOption(next)
    setTitle("")
    setPrompt("")
    setError(null)
    setOpen(true)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!option || submitting) return
    if (!prompt.trim()) {
      setError("Describe what you want to generate.")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onCreate({ kind: option.kind, title: title.trim(), prompt: prompt.trim() })
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the artifact.")
    } finally {
      setSubmitting(false)
    }
  }

  const Icon = option?.icon

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Create artifact"
          title="Create artifact"
          className="flex size-9 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-xs transition-colors hover:bg-muted hover:text-foreground data-popup-open:bg-muted data-popup-open:text-foreground"
        >
          <Plus className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={6} className="w-64 p-1.5">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="px-2 pb-1.5">Create artifact</DropdownMenuLabel>
            {KIND_OPTIONS.map((item) => (
              <DropdownMenuItem
                key={item.kind}
                onClick={() => choose(item)}
                className="gap-3 rounded-lg px-2 py-2"
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg",
                    item.tint,
                  )}
                >
                  <item.icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{item.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.description}
                  </span>
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          // Keep the dialog up while generating so the result isn't lost.
          if (!submitting) setOpen(next)
        }}
      >
        <DialogContent className="sm:max-w-lg" showCloseButton={!submitting}>
          <form onSubmit={submit} className="grid gap-5">
            <DialogHeader>
              <div className="flex items-center gap-3">
                {option && Icon ? (
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-xl",
                      option.tint,
                    )}
                  >
                    <Icon className="size-5" />
                  </span>
                ) : null}
                <div className="min-w-0">
                  <DialogTitle>New {option?.label.toLowerCase()}</DialogTitle>
                  <DialogDescription>
                    Uses this chat as context. It&apos;s saved to the Artifacts panel.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="grid gap-2">
              <Label htmlFor="artifact-title">Title</Label>
              <Input
                id="artifact-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Optional — generated if left blank"
                maxLength={200}
                disabled={submitting}
                autoFocus
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="artifact-prompt">Prompt</Label>
              <Textarea
                id="artifact-prompt"
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value)
                  if (error) setError(null)
                }}
                onKeyDown={(e) => {
                  // ⌘/Ctrl+Enter submits from the textarea.
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault()
                    e.currentTarget.form?.requestSubmit()
                  }
                }}
                placeholder={option?.placeholder}
                maxLength={20000}
                disabled={submitting}
                className="min-h-32 resize-y"
                aria-invalid={Boolean(error)}
              />
            </div>

            {error ? (
              <p role="alert" className="-mt-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <DialogFooter className="items-center gap-2 sm:justify-between">
              <p className="text-xs text-muted-foreground">
                {submitting ? "Generating — this can take up to a minute…" : "⌘ + Enter to create"}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting || !prompt.trim()} className="gap-2">
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                  {submitting ? "Creating…" : "Create"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
