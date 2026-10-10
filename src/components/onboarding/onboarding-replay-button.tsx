"use client"

import { HelpCircle } from "lucide-react"
import { useOnboarding } from "@/components/onboarding/onboarding-provider"

/**
 * Small "?" button that re-runs the onboarding tour on demand.
 * Drop into any topbar / header.
 */
export function OnboardingReplayButton() {
  const { restart } = useOnboarding()

  return (
    <button
      type="button"
      onClick={restart}
      aria-label="Show the quick tour"
      title="Show the quick tour"
      className="flex size-9 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-xs transition-colors hover:bg-muted hover:text-foreground"
    >
      <HelpCircle className="size-4" />
    </button>
  )
}
