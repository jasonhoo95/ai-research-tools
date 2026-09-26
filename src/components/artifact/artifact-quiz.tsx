"use client"

import * as React from "react"
import {
  DndContext,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  Check,
  Clock,
  GripVertical,
  Lightbulb,
  ListChecks,
  Play,
  Plus,
  Trash2,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type {
  QuizArtifact,
  QuizDifficulty,
  QuizQuestion,
} from "@/lib/chat-types"
import type { MessageArtifactResult } from "@/lib/chat-repo"
import {
  DIFFICULTY_STYLES,
  QuizPlayer,
  optionLetter,
  playableQuestions,
} from "@/components/artifact/quiz-player"
import { useArtifactTitle, useSaveArtifact } from "@/components/artifact/artifact-document"

const SAVE_DELAY_MS = 600
const MIN_OPTIONS = 2
const MAX_OPTIONS = 6

/** Raw row returned by the message-artifact endpoint. */
type StoredArtifactRow = {
  id: string
  parent_chatbot_id: string
  content: { id: string; artifact: QuizArtifact }
}

const DIFFICULTIES: QuizDifficulty[] = ["easy", "medium", "hard"]

function scrollParent(el: Element): Element | null {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node)
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) {
      return node
    }
  }
  return document.scrollingElement
}

const gripFor = (id: string) => document.querySelector(`[data-grip-for="${id}"]`)

function newQuestion(): QuizQuestion {
  return {
    id: crypto.randomUUID(),
    question: "",
    options: ["", "", "", ""],
    answerIndex: 0,
    explanation: "",
    difficulty: "medium",
  }
}

/**
 * Borderless field that reads as text until hovered/focused. A textarea so
 * long values wrap; Enter is ignored to keep each field a single paragraph.
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
        "-mx-1.5 block w-[calc(100%+0.75rem)] resize-none overflow-hidden rounded-md border border-transparent bg-transparent px-1.5 py-0.5 outline-none transition-colors placeholder:text-muted-foreground/60 hover:bg-muted/60 focus:border-ring focus:bg-background",
        className,
      )}
    />
  )
}

function DifficultySelect({
  value,
  onChange,
}: {
  value: QuizDifficulty
  onChange: (value: QuizDifficulty) => void
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as QuizDifficulty)}
      aria-label="Difficulty"
      className={cn(
        "cursor-pointer appearance-none rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        DIFFICULTY_STYLES[value],
      )}
    >
      {DIFFICULTIES.map((d) => (
        <option key={d} value={d}>
          {d}
        </option>
      ))}
    </select>
  )
}

function QuestionCard({
  question,
  number,
  compact,
  onChange,
  onDelete,
  onGripPointerDown,
}: {
  question: QuizQuestion
  number: number
  /** Title-only row, shown for every card while reordering. */
  compact: boolean
  onChange: (patch: Partial<QuizQuestion>) => void
  onDelete: () => void
  onGripPointerDown: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id })

  const setOption = (index: number, text: string) =>
    onChange({
      options: question.options.map((o, i) => (i === index ? text : o)),
    })

  const removeOption = (index: number) => {
    const options = question.options.filter((_, i) => i !== index)
    let answerIndex = question.answerIndex
    if (index === answerIndex) answerIndex = 0
    else if (index < answerIndex) answerIndex -= 1
    onChange({ options, answerIndex })
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "group relative min-w-0 border bg-card shadow-sm transition-shadow",
        compact ? "rounded-xl" : "rounded-2xl",
        isDragging && "z-10 shadow-xl ring-2 ring-primary/30",
      )}
    >
      <div
        className={cn(
          "flex gap-2 sm:gap-3",
          compact ? "items-center px-3 py-2.5" : "items-start p-4 sm:p-5",
        )}
      >
        <button
          ref={setActivatorNodeRef}
          type="button"
          data-grip-for={question.id}
          aria-label={`Drag to reorder question ${number}`}
          className={cn(
            "flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing",
            !compact && "mt-0.5",
          )}
          {...attributes}
          {...listeners}
          onPointerDown={(event) => {
            onGripPointerDown()
            listeners?.onPointerDown?.(event)
          }}
        >
          <GripVertical className="size-4" />
        </button>

        {compact ? (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
              {number}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {question.question.trim() || "Untitled question"}
            </span>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                DIFFICULTY_STYLES[question.difficulty],
              )}
            >
              {question.difficulty}
            </span>
          </div>
        ) : (
          <div className="min-w-0 flex-1 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">
                Question {number}
              </span>
              <DifficultySelect
                value={question.difficulty}
                onChange={(difficulty) => onChange({ difficulty })}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onDelete}
                aria-label={`Delete question ${number}`}
                title="Delete question"
                className="ml-auto size-7 text-muted-foreground opacity-0 transition-opacity hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>

            <InlineInput
              value={question.question}
              onChange={(text) => onChange({ question: text })}
              placeholder="Write a question…"
              label={`Question ${number}`}
              className="text-base font-semibold leading-snug sm:text-lg"
            />

            <ul className="grid gap-2">
              {question.options.map((option, index) => {
                const correct = index === question.answerIndex
                return (
                  <li
                    key={index}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border px-3 py-2 transition-colors",
                      correct
                        ? "border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10"
                        : "border-border/70",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onChange({ answerIndex: index })}
                      aria-pressed={correct}
                      aria-label={`Mark option ${optionLetter(index)} as the correct answer`}
                      title={correct ? "Correct answer" : "Mark as correct"}
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                        correct
                          ? "bg-emerald-600 text-white"
                          : "bg-muted text-muted-foreground hover:bg-emerald-100 hover:text-emerald-700",
                      )}
                    >
                      {correct ? <Check className="size-4" /> : optionLetter(index)}
                    </button>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <InlineInput
                        value={option}
                        onChange={(text) => setOption(index, text)}
                        placeholder={`Option ${optionLetter(index)}`}
                        label={`Question ${number} option ${optionLetter(index)}`}
                        className={cn(
                          "text-sm",
                          correct && "text-emerald-800 dark:text-emerald-300",
                        )}
                      />
                    </div>
                    {question.options.length > MIN_OPTIONS ? (
                      <button
                        type="button"
                        onClick={() => removeOption(index)}
                        aria-label={`Remove option ${optionLetter(index)}`}
                        title="Remove option"
                        className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/60 opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        <X className="size-3.5" />
                      </button>
                    ) : null}
                  </li>
                )
              })}
            </ul>

            {question.options.length < MAX_OPTIONS ? (
              <button
                type="button"
                onClick={() => onChange({ options: [...question.options, ""] })}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <Plus className="size-3.5" />
                Add option
              </button>
            ) : null}

            <div className="flex items-start gap-2.5 rounded-xl border border-sky-200/70 bg-sky-50/60 px-3 py-2.5 dark:border-sky-500/20 dark:bg-sky-500/5">
              <Lightbulb className="mt-1 size-4 shrink-0 text-sky-600" />
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-400">
                  Learn
                </span>
                <InlineInput
                  value={question.explanation}
                  onChange={(text) => onChange({ explanation: text })}
                  placeholder="Explain why the answer is correct…"
                  label={`Question ${number} explanation`}
                  className="text-sm text-foreground/80"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </li>
  )
}

export function ArtifactQuiz({
  data,
  artifact,
}: {
  data: MessageArtifactResult
  artifact: QuizArtifact
}) {
  const [quiz, setQuiz] = React.useState(artifact)
  const [playing, setPlaying] = React.useState(false)
  // Shared with the page heading, so renaming either updates both.
  const title = useArtifactTitle(quiz.title)
  const quizRef = React.useRef(quiz)
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = React.useRef<string | null>(null)
  const dndId = React.useId()

  React.useEffect(() => {
    quizRef.current = artifact
    setQuiz(artifact)
  }, [artifact])

  const saveArtifact = useSaveArtifact()

  const saveNow = React.useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }

    const row = data as unknown as StoredArtifactRow
    const next = quizRef.current
    const artifactData = {
      id: row.content.id,
      artifact: { ...row.content.artifact, ...next },
    }

    const serialized = JSON.stringify(artifactData)
    if (serialized === lastSavedRef.current) return
    lastSavedRef.current = serialized

    saveArtifact(row.parent_chatbot_id, row.id, artifactData as never)
      .catch((err) => {
        lastSavedRef.current = null
        console.error("Failed to save quiz", err)
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
    (update: (prev: QuizArtifact) => QuizArtifact) => {
      const next = update(quizRef.current)
      quizRef.current = next
      setQuiz(next)
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(saveNow, SAVE_DELAY_MS)
    },
    [saveNow],
  )

  const updateQuestion = (id: string, patch: Partial<QuizQuestion>) =>
    commit((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)),
    }))

  const deleteQuestion = (id: string) =>
    commit((prev) => ({
      ...prev,
      questions: prev.questions.filter((q) => q.id !== id),
    }))

  const addQuestion = () =>
    commit((prev) => ({ ...prev, questions: [...prev.questions, newQuestion()] }))

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // While reordering every card collapses to its title. The grabbed card's
  // handle is kept at the same screen position across the collapse/expand
  // by adjusting the scroll, so it stays under the pointer.
  const [reordering, setReordering] = React.useState(false)
  const reorderingRef = React.useRef(false)
  const dragActiveRef = React.useRef(false)
  const anchorRef = React.useRef<{ id: string; top: number } | null>(null)

  const setReorderMode = React.useCallback((on: boolean, id: string) => {
    if (reorderingRef.current === on) return
    reorderingRef.current = on
    const top = gripFor(id)?.getBoundingClientRect().top
    anchorRef.current = top === undefined ? null : { id, top }
    setReordering(on)
  }, [])

  React.useLayoutEffect(() => {
    const anchor = anchorRef.current
    anchorRef.current = null
    if (!anchor) return
    const grip = gripFor(anchor.id)
    const scroller = grip && scrollParent(grip)
    if (!grip || !scroller) return
    scroller.scrollTop += grip.getBoundingClientRect().top - anchor.top
  }, [reordering])

  // Collapse on press, before the drag activates, so dnd-kit measures the
  // compact layout. A press that never becomes a drag restores the cards.
  const handleGripPointerDown = (id: string) => {
    setReorderMode(true, id)
    const release = () => {
      window.removeEventListener("pointerup", release)
      window.removeEventListener("pointercancel", release)
      if (!dragActiveRef.current) setReorderMode(false, id)
    }
    window.addEventListener("pointerup", release)
    window.addEventListener("pointercancel", release)
  }

  const handleDragStart = ({ active }: DragStartEvent) => {
    dragActiveRef.current = true
    // Keyboard drags start here without a pointer press.
    setReorderMode(true, String(active.id))
  }

  const handleDragCancel = ({ active }: { active: { id: string | number } }) => {
    dragActiveRef.current = false
    setReorderMode(false, String(active.id))
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    dragActiveRef.current = false
    setReorderMode(false, String(active.id))
    if (!over || active.id === over.id) return
    commit((prev) => {
      const from = prev.questions.findIndex((q) => q.id === active.id)
      const to = prev.questions.findIndex((q) => q.id === over.id)
      if (from < 0 || to < 0) return prev
      return { ...prev, questions: arrayMove(prev.questions, from, to) }
    })
  }

  const playable = playableQuestions(quiz)
  const counts = DIFFICULTIES.map(
    (d) => [d, quiz.questions.filter((q) => q.difficulty === d).length] as const,
  ).filter(([, n]) => n > 0)
  const minutes = Math.max(1, Math.round(playable.length * 0.5))

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-sky-50 via-white to-indigo-50 p-6 shadow-sm sm:p-8 dark:from-sky-500/10 dark:via-background dark:to-indigo-500/10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-400">
              Study material
            </span>
            <InlineInput
              value={title}
              onChange={(title) => commit((prev) => ({ ...prev, title }))}
              placeholder="Quiz title"
              label="Quiz title"
              className="text-2xl font-bold tracking-tight"
            />
            <InlineInput
              value={quiz.description ?? ""}
              onChange={(description) => commit((prev) => ({ ...prev, description }))}
              placeholder="Add a short description…"
              label="Quiz description"
              className="text-sm text-muted-foreground"
            />
            <div className="flex flex-wrap items-center gap-2 pt-2 text-xs">
              <span className="flex items-center gap-1.5 rounded-full bg-background/80 px-2.5 py-1 font-medium shadow-sm ring-1 ring-border/60">
                <ListChecks className="size-3.5" />
                {quiz.questions.length} question{quiz.questions.length === 1 ? "" : "s"}
              </span>
              <span className="flex items-center gap-1.5 rounded-full bg-background/80 px-2.5 py-1 font-medium shadow-sm ring-1 ring-border/60">
                <Clock className="size-3.5" />~{minutes} min
              </span>
              {counts.map(([d, n]) => (
                <span
                  key={d}
                  className={cn(
                    "rounded-full px-2.5 py-1 font-semibold uppercase tracking-wider",
                    DIFFICULTY_STYLES[d],
                  )}
                >
                  {n} {d}
                </span>
              ))}
            </div>
          </div>
          <Button
            type="button"
            size="lg"
            onClick={() => setPlaying(true)}
            disabled={playable.length === 0}
            className="h-12 shrink-0 gap-2 rounded-full px-7 text-base shadow-md"
          >
            <Play className="size-4 fill-current" />
            Start quiz
          </Button>
        </div>
      </section>

      <div className="flex items-end justify-between gap-4 px-1">
        <div>
          <h2 className="text-base font-semibold">Questions</h2>
          <p className="text-xs text-muted-foreground">
            Drag <GripVertical className="inline size-3 align-[-2px]" /> to change the
            order. Click a letter to mark the correct answer.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addQuestion} className="gap-1.5">
          <Plus className="size-3.5" />
          Add question
        </Button>
      </div>

      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={handleDragStart}
        onDragCancel={handleDragCancel}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={quiz.questions.map((q) => q.id)}
          strategy={verticalListSortingStrategy}
        >
          <ol className={cn("grid", reordering ? "gap-2" : "gap-4")}>
            {quiz.questions.map((question, index) => (
              <QuestionCard
                key={question.id}
                question={question}
                number={index + 1}
                compact={reordering}
                onChange={(patch) => updateQuestion(question.id, patch)}
                onDelete={() => deleteQuestion(question.id)}
                onGripPointerDown={() => handleGripPointerDown(question.id)}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>

      <button
        type="button"
        onClick={addQuestion}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed py-5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/40 hover:text-foreground"
      >
        <Plus className="size-4" />
        Add question
      </button>

      {playing ? (
        <QuizPlayer
          title={title}
          questions={playable}
          onClose={() => setPlaying(false)}
        />
      ) : null}
    </div>
  )
}
