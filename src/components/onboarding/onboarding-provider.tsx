"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { driver, type Config, type DriveStep } from "driver.js"
import "driver.js/dist/driver.css"

import {
  ONBOARDING_STEPS,
  ONBOARDING_STORAGE_KEY,
  type OnboardingStep,
} from "@/lib/onboarding/onboarding-steps"

interface OnboardingContextValue {
  /** Show every unseen step whose target is currently on the page. */
  start: () => void
  /** Clear "seen" tracking and run the full tour again from step 1. */
  restart: () => void
  /** True while the tour is being driven. */
  active: boolean
}

const OnboardingContext = React.createContext<OnboardingContextValue | null>(null)

function selectorFor(step: OnboardingStep) {
  return step.selector ?? `[data-tour="${step.id}"]`
}

// --- Per-step persistence --------------------------------------------------
// We keep a Set of "seen" step ids in localStorage instead of a single
// "tour done" flag. That way steps that live on a different route (e.g.
// pin-message only exists on /chat/[id]) still get a chance to show when
// the user eventually lands there — they aren't locked out just because
// the user finished the first page's slice of the tour.

function readSeen(): Set<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = window.localStorage.getItem(ONBOARDING_STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return new Set(parsed as string[])
    // Legacy value from the previous version ("done" meant "all steps seen").
    if (parsed === "done") {
      return new Set(ONBOARDING_STEPS.map((s) => s.id))
    }
    return new Set()
  } catch {
    return new Set()
  }
}

function writeSeen(seen: Set<string>) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(
      ONBOARDING_STORAGE_KEY,
      JSON.stringify(Array.from(seen)),
    )
  } catch {
    // storage disabled — the tour will replay next session, which is fine.
  }
}

function clearSeen() {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(ONBOARDING_STORAGE_KEY)
  } catch {
    // ignore
  }
}

/** Steps the user hasn't seen yet whose target is currently in the DOM. */
function pendingSteps(): OnboardingStep[] {
  if (typeof document === "undefined") return []
  const seen = readSeen()
  return ONBOARDING_STEPS.filter((step) => {
    if (seen.has(step.id)) return false
    if (step.showEvenIfTargetMissing) return true
    try {
      return Boolean(document.querySelector(selectorFor(step)))
    } catch {
      return false
    }
  })
}

function toDriveStep(step: OnboardingStep): DriveStep {
  return {
    element: selectorFor(step),
    popover: {
      title: step.title,
      description: step.description,
      side: step.side ?? "bottom",
      align: step.align ?? "start",
    },
  }
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = React.useState(false)
  const pathname = usePathname()
  const driverRef = React.useRef<ReturnType<typeof driver> | null>(null)

  const runWith = React.useCallback((steps: OnboardingStep[]) => {
    if (steps.length === 0) return
    driverRef.current?.destroy()

    const config: Config = {
      showProgress: true,
      allowClose: true,
      smoothScroll: true,
      overlayOpacity: 0.55,
      stagePadding: 4,
      stageRadius: 10,
      nextBtnText: "Next →",
      prevBtnText: "← Back",
      doneBtnText: "Done",
      steps: steps.map(toDriveStep),
      // Mark each step seen the moment it is highlighted. If the user
      // closes the tour early, they still won't be shown the same step
      // again on the next route change.
      onHighlightStarted: (_el, _step, { state }) => {
        const idx = state.activeIndex ?? 0
        const current = steps[idx]
        if (!current) return
        const seen = readSeen()
        if (seen.has(current.id)) return
        seen.add(current.id)
        writeSeen(seen)
      },
      onDestroyed: () => setActive(false),
    }

    const d = driver(config)
    driverRef.current = d
    setActive(true)
    d.drive()
  }, [])

  const start = React.useCallback(() => {
    runWith(pendingSteps())
  }, [runWith])

  const restart = React.useCallback(() => {
    clearSeen()
    // Give the DOM a frame to settle, then run everything that's on screen.
    requestAnimationFrame(() => runWith(pendingSteps()))
  }, [runWith])

  // Auto-start on first visit, and again on route change if there are new
  // unseen steps on the newly-mounted page. Waits for targets to mount
  // using a short MutationObserver window — chat-thread fetches messages
  // asynchronously so some targets (pin-message, search) appear a beat
  // after navigation.
  React.useEffect(() => {
    if (readSeen().size >= ONBOARDING_STEPS.length) return
    if (driverRef.current && active) return

    let settled = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let observer: MutationObserver | null = null

    const tryStart = () => {
      if (settled) return
      const steps = pendingSteps()
      if (steps.length === 0) return
      settled = true
      if (timeoutId) clearTimeout(timeoutId)
      observer?.disconnect()
      runWith(steps)
    }

    // First attempt right after the route settles.
    const initial = setTimeout(tryStart, 800)

    // Watch for the targets appearing later (async-loaded conversation).
    observer = new MutationObserver(() => tryStart())
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })

    // Give up after 8s so the observer doesn't live forever.
    timeoutId = setTimeout(() => {
      settled = true
      observer?.disconnect()
    }, 8000)

    return () => {
      clearTimeout(initial)
      if (timeoutId) clearTimeout(timeoutId)
      observer?.disconnect()
    }
  }, [pathname, runWith, active])

  React.useEffect(() => {
    return () => {
      driverRef.current?.destroy()
    }
  }, [])

  const value = React.useMemo(
    () => ({ start, restart, active }),
    [start, restart, active],
  )

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  )
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = React.useContext(OnboardingContext)
  if (!ctx) {
    throw new Error("useOnboarding must be used inside <OnboardingProvider>")
  }
  return ctx
}
