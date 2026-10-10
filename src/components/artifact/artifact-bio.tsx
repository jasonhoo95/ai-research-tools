"use client"

import * as React from "react"
import type { Descendant } from "slate"
import {
  Award,
  Briefcase,
  Camera,
  FileText,
  FolderKanban,
  GraduationCap,
  MapPin,
  Plus,
  Sparkles,
  Trash2,
  UserRound,
  type LucideIcon,
} from "lucide-react"

import { SlateEditor } from "@/components/slate/slate-editor"
import { markdownToSlateDocument } from "@/components/slate/lib/markdown-to-slate"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type {
  BioArtifact,
  BioSection,
  BioSectionType,
} from "@/lib/chat-types"
import type { MessageArtifactResult } from "@/lib/chat-repo"
import { ImageUploadDialog } from "@/components/artifact/image-upload-dialog"
import { useSaveArtifact } from "@/components/artifact/artifact-document"

const SAVE_DELAY_MS = 600

/** Raw chatbot_message row returned by the message-artifact endpoint. */
type StoredArtifactRow = {
  id: string
  parent_chatbot_id: string
  content: { id: string; artifact: BioArtifact }
}

const SECTION_ICONS: Record<BioSectionType, LucideIcon> = {
  about: UserRound,
  experience: Briefcase,
  education: GraduationCap,
  skills: Sparkles,
  projects: FolderKanban,
  awards: Award,
  other: FileText,
}

/** Sections whose "### Heading" entries get a logo tile like LinkedIn. */
const ENTRY_SECTIONS: ReadonlySet<BioSectionType> = new Set([
  "experience",
  "education",
  "projects",
  "awards",
])

const EMPTY_BODY: Descendant[] = [{ type: "paragraph", children: [{ text: "" }] }]

function sectionBody(section: BioSection): Descendant[] {
  if (Array.isArray(section.content)) return section.content
  const md = section.content.trim()
  return md ? markdownToSlateDocument(md) : EMPTY_BODY
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

/**
 * Borderless single-line field that reads as text until hovered/focused.
 * A textarea so long values wrap instead of being cut off; Enter is ignored.
 */
function InlineInput({
  value,
  onChange,
  placeholder,
  className,
  label,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  className?: string
  label: string
}) {
  const ref = React.useRef<HTMLTextAreaElement>(null)

  // Grow to fit the wrapped text; re-measure when the card resizes.
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

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\n/g, " "))}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.preventDefault()
      }}
      placeholder={placeholder}
      aria-label={label}
      className={cn(
        "-mx-1.5 block w-[calc(100%+0.75rem)] shrink resize-none overflow-hidden rounded-md border border-transparent bg-transparent px-1.5 py-0.5 outline-none transition-colors placeholder:text-muted-foreground/60 hover:bg-muted/60 focus:border-ring focus:bg-background",
        className,
      )}
    />
  )
}

function SectionEditor({
  value,
  onChange,
  type,
}: {
  value: Descendant[]
  onChange: (value: Descendant[]) => void
  type: BioSectionType
}) {
  const entries = ENTRY_SECTIONS.has(type)
  return (
    <SlateEditor
      value={value}
      onChange={onChange}
      showToolbar={false}
      enableSlashCommands={false}
      enableFloatingToolbar={false}
      className="bg-transparent shadow-none"
      editableClassName={cn(
        "min-h-[2em] px-0 py-0 text-sm leading-relaxed text-foreground/85 outline-none",
        "[&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-1",
        "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li::marker]:text-muted-foreground",
        "[&_strong]:font-semibold [&_strong]:text-foreground",
        // "*Jan 2020 – Present · Singapore*" date lines read as muted meta.
        "[&_em]:not-italic [&_em]:text-[13px] [&_em]:text-muted-foreground",
        "[&_h1,&_h2,&_h3]:font-semibold [&_h1,&_h2,&_h3]:text-foreground [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-[15px] [&_h3]:mb-0.5",
        "[&_blockquote]:border-l-2 [&_blockquote]:border-[var(--bio-from)] [&_blockquote]:pl-3 [&_blockquote]:italic",
        "[&_a]:font-medium [&_a]:text-[#0a66c2] [&_a]:underline-offset-2 hover:[&_a]:underline",
        entries && [
          // Each ### entry gets a logo tile and a divider, LinkedIn-style.
          // (The markdown converter renders ### as <h2>, so match both.)
          "pl-14",
          "[&>:is(h2,h3)]:relative [&>:is(h2,h3)]:text-[15px] [&>:is(h2,h3)]:mt-4 [&>:is(h2,h3)]:pt-4 [&>:is(h2,h3)]:border-t",
          "[&>:is(h2,h3):first-child]:mt-0 [&>:is(h2,h3):first-child]:border-t-0 [&>:is(h2,h3):first-child]:pt-0",
          "[&>:is(h2,h3)]:before:absolute [&>:is(h2,h3)]:before:-left-14 [&>:is(h2,h3)]:before:size-11 [&>:is(h2,h3)]:before:rounded-md [&>:is(h2,h3)]:before:content-['']",
          "[&>:is(h2,h3)]:before:bg-[linear-gradient(135deg,var(--bio-from),var(--bio-to))] [&>:is(h2,h3)]:before:opacity-90",
          "[&>:is(h2,h3)]:before:top-4 [&>:is(h2,h3):first-child]:before:top-0",
          // Tighten the date line under each entry title.
          "[&>:is(h2,h3)+p]:mt-0 [&>:is(h2,h3)+p]:text-[13px] [&>:is(h2,h3)+p]:text-muted-foreground",
        ],
        type === "skills" && [
          // Skills render as pills.
          "[&_ul]:flex [&_ul]:flex-wrap [&_ul]:gap-2 [&_ul]:list-none [&_ul]:pl-0",
          "[&_li]:my-0 [&_li]:rounded-full [&_li]:border [&_li]:px-3 [&_li]:py-1 [&_li]:text-[13px]",
        ],
      )}
    />
  )
}

let keySeq = 0
const newKey = () => `bio-section-${++keySeq}`

export function ArtifactBio({
  data,
  artifact,
}: {
  data: MessageArtifactResult
  artifact: BioArtifact
}) {
  const [bio, setBio] = React.useState(artifact)
  const [keys, setKeys] = React.useState(() => artifact.sections.map(newKey))
  const bioRef = React.useRef(bio)
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    bioRef.current = artifact
    setBio(artifact)
    setKeys(artifact.sections.map(newKey))
  }, [artifact])

  const saveArtifact = useSaveArtifact()

  const saveNow = React.useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }

    const row = data as unknown as StoredArtifactRow
    const next = bioRef.current
    const artifactData = {
      id: row.content.id,
      artifact: { ...row.content.artifact, ...next, title: next.name || next.title },
    }

    const serialized = JSON.stringify(artifactData)
    if (serialized === lastSavedRef.current) return
    lastSavedRef.current = serialized

    saveArtifact(row.parent_chatbot_id, row.id, artifactData as never)
      .catch((err) => {
        lastSavedRef.current = null
        console.error("Failed to save profile", err)
      })
  }, [data, saveArtifact])

  // Flush any pending edit when leaving the page.
  React.useEffect(
    () => () => {
      if (saveTimerRef.current) saveNow()
    },
    [saveNow],
  )

  const commit = React.useCallback(
    (update: (prev: BioArtifact) => BioArtifact) => {
      const next = update(bioRef.current)
      bioRef.current = next
      setBio(next)
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(saveNow, SAVE_DELAY_MS)
    },
    [saveNow],
  )

  const updateSection = (id: string, patch: Partial<BioSection>) =>
    commit((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }))

  const handleBodyChange = (section: BioSection) => (value: Descendant[]) => {
    // Slate fires onChange for selection-only changes with a fresh array;
    // only save real content edits.
    const current = bioRef.current.sections.find((s) => s.id === section.id)
    if (!current) return
    if (JSON.stringify(value) === JSON.stringify(sectionBody(current))) return
    updateSection(section.id, { content: value })
  }

  const addSection = () => {
    const id = crypto.randomUUID()
    setKeys((prev) => [...prev, newKey()])
    commit((prev) => ({
      ...prev,
      sections: [
        ...prev.sections,
        { id, type: "other", title: "New section", content: EMPTY_BODY },
      ],
    }))
    // Scroll the new card into view once rendered.
    requestAnimationFrame(() =>
      document.getElementById(`bio-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }),
    )
  }

  const deleteSection = (index: number) => {
    setKeys((prev) => prev.filter((_, i) => i !== index))
    commit((prev) => ({
      ...prev,
      sections: prev.sections.filter((_, i) => i !== index),
    }))
  }

  const [bannerFailed, setBannerFailed] = React.useState(false)
  const [avatarFailed, setAvatarFailed] = React.useState(false)
  const [imageDialog, setImageDialog] = React.useState<"banner" | "avatar" | null>(null)
  // Generated and uploaded images for this profile share one storage folder.
  const imageFolder = `bio/${(data as unknown as StoredArtifactRow).content.id}`

  const setImage = (field: "bannerUrl" | "avatarUrl", url: string | undefined) => {
    if (field === "bannerUrl") setBannerFailed(false)
    else setAvatarFailed(false)
    commit((prev) => ({ ...prev, [field]: url }))
  }
  const gradient = `linear-gradient(135deg, ${bio.palette?.from ?? "#0a66c2"}, ${bio.palette?.to ?? "#004182"})`

  return (
    <div
      className="-m-2 p-3 sm:-m-4 sm:p-6"
    >
      <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex min-w-0 flex-col gap-3">
          {/* Intro card */}
          <section className="overflow-hidden rounded-xl border bg-card shadow-xs">
            <div
              className="relative aspect-[4/1] min-h-[120px] w-full"
              style={{ background: gradient }}
            >
              {bio.bannerUrl && !bannerFailed && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={bio.bannerUrl}
                  alt=""
                  onError={() => setBannerFailed(true)}
                  className="absolute inset-0 size-full object-cover"
                />
              )}
              <button
                type="button"
                onClick={() => setImageDialog("banner")}
                className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-sm backdrop-blur transition hover:bg-white"
              >
                <Camera className="size-3.5" />
                Edit cover
              </button>
            </div>

            <div className="relative px-4 pb-5 sm:px-6">
              <button
                type="button"
                onClick={() => setImageDialog("avatar")}
                aria-label="Change profile photo"
                className="group/avatar relative -mt-[72px] mb-3 block size-[120px] overflow-hidden rounded-full border-4 border-card bg-card shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring sm:-mt-[84px] sm:size-[152px]"
              >
                {bio.avatarUrl && !avatarFailed ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={bio.avatarUrl}
                    alt={`${bio.name} avatar`}
                    onError={() => setAvatarFailed(true)}
                    className="size-full object-cover"
                  />
                ) : (
                  <div
                    className="flex size-full items-center justify-center text-4xl font-semibold text-white"
                    style={{ background: gradient }}
                  >
                    {initials(bio.name)}
                  </div>
                )}
                <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/45 text-xs font-semibold text-white opacity-0 transition-opacity group-hover/avatar:opacity-100 group-focus-visible/avatar:opacity-100">
                  <Camera className="size-5" />
                  Change photo
                </span>
              </button>

              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,220px)]">
                <div className="min-w-0">
                  <InlineInput
                    label="Name"
                    value={bio.name}
                    onChange={(name) => commit((prev) => ({ ...prev, name }))}
                    placeholder="Full name"
                    className="text-2xl font-semibold tracking-tight"
                  />
                  <InlineInput
                    label="Headline"
                    value={bio.headline}
                    onChange={(headline) => commit((prev) => ({ ...prev, headline }))}
                    placeholder="Headline"
                    className="mt-0.5 text-[15px] text-foreground/90"
                  />
                  <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="size-3.5 shrink-0" />
                    <InlineInput
                      label="Location"
                      value={bio.location ?? ""}
                      onChange={(location) =>
                        commit((prev) => ({ ...prev, location: location || undefined }))
                      }
                      placeholder="Add location"
                      className="text-sm"
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={addSection}
                      className="rounded-full bg-[#0a66c2] px-4 font-semibold text-white hover:bg-[#004182]"
                    >
                      Add profile section
                    </Button>
                  </div>
                </div>

                {bio.highlights.length > 0 && (
                  <ul className="flex flex-col gap-2 text-sm font-medium">
                    {bio.highlights.map((highlight, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="min-w-0">{highlight}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>

          {/* Sections */}
          {bio.sections.map((section, i) => {
            const Icon = SECTION_ICONS[section.type] ?? FileText
            return (
              <section
                key={keys[i] ?? section.id}
                id={`bio-${section.id}`}
                className="group scroll-mt-20 rounded-xl border bg-card px-4 py-5 shadow-xs sm:px-6"
              >
                <header className="mb-2 flex items-center gap-2">
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <InlineInput
                    label="Section title"
                    value={section.title}
                    onChange={(title) => updateSection(section.id, { title })}
                    placeholder="Section title"
                    className="text-lg font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => deleteSection(i)}
                    aria-label={`Delete ${section.title} section`}
                    title="Delete section"
                    className="rounded-full p-2 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </header>
                <SectionEditor
                  value={sectionBody(section)}
                  onChange={handleBodyChange(section)}
                  type={section.type}
                />
              </section>
            )
          })}

          <button
            type="button"
            onClick={addSection}
            className="flex items-center justify-center gap-2 rounded-xl border border-dashed bg-card/60 py-4 text-sm font-medium text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
          >
            <Plus className="size-4" />
            Add section
          </button>
        </div>

        {/* Sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-0 rounded-xl border bg-card p-4 shadow-xs">
            <h3 className="text-sm font-semibold">On this profile</h3>
            <nav className="mt-3 flex flex-col">
              {bio.sections.map((section) => {
                const Icon = SECTION_ICONS[section.type] ?? FileText
                return (
                  <a
                    key={section.id}
                    href={`#bio-${section.id}`}
                    onClick={(e) => {
                      e.preventDefault()
                      document
                        .getElementById(`bio-${section.id}`)
                        ?.scrollIntoView({ behavior: "smooth", block: "start" })
                    }}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Icon className="size-3.5 shrink-0" />
                    <span className="truncate">{section.title || "Untitled"}</span>
                  </a>
                )
              })}
            </nav>
            <Button
              variant="outline"
              size="sm"
              onClick={addSection}
              className="mt-3 w-full gap-1.5"
            >
              <Plus className="size-4" />
              Add section
            </Button>
          </div>
        </aside>
      </div>

      <ImageUploadDialog
        open={imageDialog !== null}
        onOpenChange={(open) => !open && setImageDialog(null)}
        title={imageDialog === "banner" ? "Change cover image" : "Change profile photo"}
        shape={imageDialog === "banner" ? "banner" : "avatar"}
        folder={imageFolder}
        currentUrl={imageDialog === "banner" ? bio.bannerUrl : bio.avatarUrl}
        onSelect={(url) =>
          setImage(imageDialog === "banner" ? "bannerUrl" : "avatarUrl", url)
        }
        onRemove={() =>
          setImage(imageDialog === "banner" ? "bannerUrl" : "avatarUrl", undefined)
        }
      />
    </div>
  )
}
