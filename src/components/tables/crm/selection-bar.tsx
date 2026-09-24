"use client"

import { Edit3, Trash2, UserPlus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type CrmSelectionBarProps = {
  count: number
  onDiscard: () => void
  onDelete?: () => void
  className?: string
}

export function CrmSelectionBar({
  count,
  onDiscard,
  onDelete,
  className,
}: CrmSelectionBarProps) {
  if (count <= 0) return null

  return (
    <div
      className={cn(
        "fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-2xl bg-[#27272a] px-3 py-2 shadow-[0_20px_50px_rgba(0,0,0,0.28)]",
        className
      )}
    >
      <span className="px-3 text-sm font-medium text-white/90">
        Selected: {count}
      </span>
      <div className="mx-1 h-6 w-px bg-white/10" />
      <Button
        type="button"
        variant="ghost"
        className="h-9 gap-2 rounded-xl px-3 text-sm text-white/90 hover:bg-white/10 hover:text-white"
      >
        <Edit3 className="size-4" />
        Edit
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="h-9 gap-2 rounded-xl px-3 text-sm text-white/90 hover:bg-white/10 hover:text-white"
      >
        <UserPlus className="size-4" />
        Assign to
      </Button>
      <Button
        type="button"
        variant="ghost"
        onClick={onDelete}
        className="h-9 gap-2 rounded-xl px-3 text-sm text-white/90 hover:bg-white/10 hover:text-white"
      >
        <Trash2 className="size-4" />
        Delete
      </Button>
      <div className="mx-1 h-6 w-px bg-white/10" />
      <Button
        type="button"
        variant="ghost"
        onClick={onDiscard}
        className="h-9 gap-2 rounded-xl bg-white px-4 text-sm font-medium text-[#ef4444] hover:bg-white/90"
      >
        <X className="size-4" />
        Discard
      </Button>
    </div>
  )
}
