"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { Jost } from "next/font/google"
import { Check, MoreVertical, RotateCcw, X } from "lucide-react"

import { cn } from "@/lib/utils"
import type { QuizArtifact, QuizDifficulty, QuizQuestion } from "@/lib/chat-types"

const headingFont = Jost({ subsets: ["latin"], weight: ["600", "700"] })

export const DIFFICULTY_STYLES: Record<QuizDifficulty, string> = {
  easy: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
  medium: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
  hard: "bg-red-50 text-red-500 dark:bg-red-500/15 dark:text-red-400",
}

export const optionLetter = (index: number) => String.fromCharCode(65 + index)

/** Questions that can be asked: text, and a non-empty correct answer plus one other option. */
export function playableQuestions(quiz: QuizArtifact): QuizQuestion[] {
  return quiz.questions.filter(
    (q) =>
      q.question.trim() &&
      q.options[q.answerIndex]?.trim() &&
      q.options.filter((o) => o.trim()).length >= 2,
  )
}

type Phase = "question" | "results"

function ScoreRing({ percent }: { percent: number }) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const color = percent >= 80 ? "#4c9a2a" : percent >= 50 ? "#d99a1e" : "#e0584a"
  return (
    <svg viewBox="0 0 128 128" className="size-36" aria-hidden>
      <circle cx="64" cy="64" r={radius} fill="none" stroke="#ececec" strokeWidth="10" />
      <circle
        cx="64"
        cy="64"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - percent / 100)}
        transform="rotate(-90 64 64)"
        className="transition-[stroke-dashoffset] duration-700"
      />
      <text
        x="64"
        y="72"
        textAnchor="middle"
        className="fill-neutral-900 text-[26px] font-bold"
      >
        {percent}%
      </text>
    </svg>
  )
}

/** Full-screen quiz, one question at a time, with instant feedback. */
export function QuizPlayer({
  title,
  questions,
  onClose,
}: {
  title: string
  questions: QuizQuestion[]
  onClose: () => void
}) {
  // Indices into `questions` for this round — "Retry incorrect" narrows it.
  const [order, setOrder] = React.useState(() => questions.map((_, i) => i))
  const [step, setStep] = React.useState(0)
  const [answers, setAnswers] = React.useState<Record<number, number>>({})
  const [phase, setPhase] = React.useState<Phase>("question")
  const [menuOpen, setMenuOpen] = React.useState(false)
  const dialogRef = React.useRef<HTMLDivElement>(null)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const menuRef = React.useRef<HTMLDivElement>(null)

  const questionIndex = order[step]
  const question = questions[questionIndex]
  const selected = answers[questionIndex]
  const answered = selected !== undefined
  const isLast = step === order.length - 1

  const correctCount = order.filter((i) => answers[i] === questions[i].answerIndex).length
  const incorrect = order.filter((i) => answers[i] !== questions[i].answerIndex)
  const percent = order.length ? Math.round((correctCount / order.length) * 100) : 0

  const start = React.useCallback((indices: number[]) => {
    setOrder(indices)
    setAnswers({})
    setStep(0)
    setPhase("question")
    setMenuOpen(false)
    scrollRef.current?.scrollTo({ top: 0 })
  }, [])

  const choose = React.useCallback(
    (index: number) => {
      if (answered || !question?.options[index]?.trim()) return
      setAnswers((prev) => ({ ...prev, [questionIndex]: index }))
    },
    [answered, question, questionIndex],
  )

  const next = React.useCallback(() => {
    if (!answered) return
    if (isLast) setPhase("results")
    else setStep((s) => s + 1)
    scrollRef.current?.scrollTo({ top: 0 })
  }, [answered, isLast])

  // Lock page scroll and focus the dialog while it's open.
  React.useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    dialogRef.current?.focus()
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  // Keyboard: A–F / 1–6 answer, Enter or → continues, Esc closes.
  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === "Escape") {
        event.preventDefault()
        if (menuOpen) setMenuOpen(false)
        else onClose()
        return
      }
      if (phase !== "question") return
      if (event.key === "Enter" || event.key === "ArrowRight") {
        if (answered) {
          event.preventDefault()
          next()
        }
        return
      }
      const key = event.key.toLowerCase()
      const index = /^[1-6]$/.test(key)
        ? Number(key) - 1
        : /^[a-f]$/.test(key)
          ? key.charCodeAt(0) - 97
          : -1
      if (index >= 0 && index < (question?.options.length ?? 0)) choose(index)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [answered, choose, menuOpen, next, onClose, phase, question])

  // Close the kebab menu on outside click.
  React.useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [menuOpen])

  const progress =
    phase === "results" ? 100 : ((step + (answered ? 1 : 0)) / order.length) * 100

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Quiz: ${title}`}
      tabIndex={-1}
      className="fixed inset-0 z-[150] flex flex-col bg-[#f2f2f2] text-neutral-900 outline-none animate-in fade-in-0 duration-200"
    >
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[1120px] flex-col px-4 pb-12 pt-6 sm:px-8">
          <header className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm text-neutral-500 sm:text-base">Study material</p>
              <h1 className="truncate text-lg font-semibold sm:text-2xl">{title}</h1>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close quiz"
              className="flex size-10 shrink-0 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-black/5 hover:text-neutral-900"
            >
              <X className="size-5" />
            </button>
          </header>

          <div className="mt-6 flex items-end justify-between text-sm sm:mt-10 sm:text-lg">
            <span className="text-neutral-500">
              {phase === "results" ? "Results" : `Question ${step + 1}`}
            </span>
            <span className="font-semibold tabular-nums">
              {phase === "results" ? order.length : step + 1}
              <span className="mx-1.5 font-normal text-neutral-400">/</span>
              {order.length}
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-300"
          >
            <div
              className="h-full rounded-full bg-[#5b8fcf] transition-[width] duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {phase === "question" && question ? (
            <div
              key={questionIndex}
              className="mt-8 rounded-[28px] border border-neutral-200 bg-white px-5 py-7 shadow-[0_1px_2px_rgba(0,0,0,0.04)] animate-in fade-in-0 slide-in-from-bottom-2 duration-300 sm:px-12 sm:py-12"
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "rounded-xl px-3.5 py-1.5 text-sm font-semibold uppercase tracking-wider sm:text-base",
                    DIFFICULTY_STYLES[question.difficulty],
                  )}
                >
                  {question.difficulty}
                </span>
                <div ref={menuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setMenuOpen((open) => !open)}
                    aria-label="Quiz options"
                    aria-expanded={menuOpen}
                    className="flex size-10 items-center justify-center rounded-full text-neutral-600 transition-colors hover:bg-neutral-100"
                  >
                    <MoreVertical className="size-5" />
                  </button>
                  {menuOpen ? (
                    <div
                      role="menu"
                      className="absolute right-0 top-11 z-10 w-44 overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 text-sm shadow-lg"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => start(questions.map((_, i) => i))}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-neutral-100"
                      >
                        <RotateCcw className="size-4" />
                        Restart quiz
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={onClose}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-neutral-100"
                      >
                        <X className="size-4" />
                        Exit quiz
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              <h2
                className={cn(
                  headingFont.className,
                  "mt-8 text-2xl font-semibold leading-snug sm:text-[34px] sm:leading-[1.45]",
                )}
              >
                {question.question}
              </h2>

              <div role="radiogroup" aria-label="Answer options" className="mt-8 grid gap-4">
                {question.options.map((option, index) => {
                  if (!option.trim()) return null
                  const isCorrect = index === question.answerIndex
                  const isPicked = index === selected
                  const state = !answered
                    ? "idle"
                    : isCorrect
                      ? "correct"
                      : isPicked
                        ? "wrong"
                        : "rest"
                  return (
                    <button
                      key={index}
                      type="button"
                      role="radio"
                      aria-checked={isPicked}
                      disabled={answered}
                      onClick={() => choose(index)}
                      className={cn(
                        "flex w-full items-center gap-4 rounded-2xl border-2 px-4 py-4 text-left text-base leading-relaxed transition-colors sm:gap-6 sm:px-8 sm:py-6 sm:text-[22px]",
                        state === "idle" &&
                          "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50",
                        state === "rest" && "border-neutral-200 bg-white",
                        state === "correct" &&
                          "border-[#4c9a2a] bg-[#e6f0df] text-[#4c9a2a]",
                        state === "wrong" &&
                          "border-[#e0584a] bg-[#fbe6e4] font-medium text-[#e0584a]",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-10 shrink-0 items-center justify-center rounded-full text-base font-semibold sm:size-14 sm:text-xl",
                          state === "correct" && "bg-[#4c9a2a] text-white",
                          state === "wrong" && "bg-[#e0584a] text-white",
                          (state === "idle" || state === "rest") &&
                            "bg-neutral-100 text-neutral-500",
                        )}
                      >
                        {state === "correct" ? (
                          <Check className="size-5 sm:size-7" strokeWidth={2.5} />
                        ) : state === "wrong" ? (
                          <X className="size-5 sm:size-7" strokeWidth={2.5} />
                        ) : (
                          optionLetter(index)
                        )}
                      </span>
                      <span className="min-w-0 flex-1">{option}</span>
                    </button>
                  )
                })}
              </div>

              {answered ? (
                <div className="animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
                  {question.explanation.trim() ? (
                    <div className="mt-8 rounded-2xl border-2 border-[#cfdcee] bg-[#eef2f7] px-5 py-5 text-base leading-[1.9] sm:px-8 sm:py-6 sm:text-[22px]">
                      <strong className="font-semibold">Learn:</strong> {question.explanation}
                    </div>
                  ) : null}
                  <div className="mt-10 flex justify-center">
                    <button
                      type="button"
                      onClick={next}
                      autoFocus
                      className="w-full max-w-sm rounded-full bg-[#6a97c7] px-10 py-3.5 text-lg font-medium text-white shadow-sm transition-colors hover:bg-[#5886b8] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6a97c7]/30 sm:text-2xl"
                    >
                      {isLast ? "See results" : "Continue"}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-8 text-center text-sm text-neutral-400">
                  Press A–{optionLetter(question.options.length - 1)} or click an answer
                </p>
              )}
            </div>
          ) : null}

          {phase === "results" ? (
            <div className="mt-8 rounded-[28px] border border-neutral-200 bg-white px-5 py-10 animate-in fade-in-0 zoom-in-95 duration-300 sm:px-12">
              <div className="flex flex-col items-center text-center">
                <ScoreRing percent={percent} />
                <h2 className={cn(headingFont.className, "mt-4 text-3xl font-semibold")}>
                  {percent === 100
                    ? "Perfect score!"
                    : percent >= 80
                      ? "Great work!"
                      : percent >= 50
                        ? "Good effort"
                        : "Keep practising"}
                </h2>
                <p className="mt-2 text-lg text-neutral-500">
                  You got {correctCount} of {order.length} correct.
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  {incorrect.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => start(incorrect)}
                      className="rounded-full bg-[#6a97c7] px-7 py-3 text-base font-medium text-white transition-colors hover:bg-[#5886b8]"
                    >
                      Retry {incorrect.length} incorrect
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => start(questions.map((_, i) => i))}
                    className="rounded-full border-2 border-neutral-200 px-7 py-3 text-base font-medium transition-colors hover:bg-neutral-50"
                  >
                    Restart quiz
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-full px-7 py-3 text-base font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                  >
                    Close
                  </button>
                </div>
              </div>

              <ol className="mx-auto mt-10 grid max-w-3xl gap-3">
                {order.map((qi, n) => {
                  const q = questions[qi]
                  const right = answers[qi] === q.answerIndex
                  return (
                    <li
                      key={q.id}
                      className="flex gap-4 rounded-2xl border border-neutral-200 px-4 py-4 sm:px-6"
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-white",
                          right ? "bg-[#4c9a2a]" : "bg-[#e0584a]",
                        )}
                        aria-label={right ? "Correct" : "Incorrect"}
                      >
                        {right ? (
                          <Check className="size-4" strokeWidth={2.5} />
                        ) : (
                          <X className="size-4" strokeWidth={2.5} />
                        )}
                      </span>
                      <div className="min-w-0 space-y-1 text-sm sm:text-base">
                        <p className="font-medium">
                          {n + 1}. {q.question}
                        </p>
                        {!right && answers[qi] !== undefined ? (
                          <p className="text-[#e0584a]">
                            Your answer: {q.options[answers[qi]]}
                          </p>
                        ) : null}
                        <p className="text-[#4c9a2a]">Answer: {q.options[q.answerIndex]}</p>
                      </div>
                    </li>
                  )
                })}
              </ol>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  )
}
