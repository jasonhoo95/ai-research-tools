"use client"

import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export function CrmStatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center rounded-md border border-[#e8e8ec] bg-[#fafafa] px-2.5 py-1 text-[11px] font-semibold tracking-wide text-[#8b8b95] uppercase">
      {status}
    </span>
  )
}

export function CrmScoreBar({
  score,
  max = 10,
}: {
  score: number
  max?: number
}) {
  const segments = 10
  const filled = Math.max(0, Math.min(segments, Math.round((score / max) * segments)))

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex items-end gap-[3px]">
        {Array.from({ length: segments }).map((_, index) => {
          const active = index < filled
          const color = !active
            ? "bg-[#ececef]"
            : index < 3
              ? "bg-[#f5c542]"
              : index < 6
                ? "bg-[#b8d96e]"
                : "bg-[#6ecf8a]"

          return (
            <span
              key={index}
              className={cn("h-[18px] w-[5px] rounded-[2px]", color)}
              style={{ height: `${12 + (index % 3) * 2}px` }}
            />
          )
        })}
      </div>
      <span className="text-xs tabular-nums text-[#a1a1aa]">
        {score}/{max}
      </span>
    </div>
  )
}

export function CrmTextCell({
  children,
  emphasis = false,
}: {
  children: ReactNode
  emphasis?: boolean
}) {
  return (
    <span
      className={cn(
        "text-sm text-[#3f3f46]",
        emphasis && "font-medium text-[#27272a]"
      )}
    >
      {children}
    </span>
  )
}
