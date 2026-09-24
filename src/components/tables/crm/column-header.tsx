"use client"

import { ChevronDown, ChevronUp } from "lucide-react"

import type { SortDirection } from "@/components/tables/crm/table-utils"
import { cn } from "@/lib/utils"

type CrmColumnHeaderProps = {
  label: string
  activeDirection: SortDirection | null
  onSort: (direction: SortDirection) => void
}

export function CrmColumnHeader({
  label,
  activeDirection,
  onSort,
}: CrmColumnHeaderProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] font-semibold tracking-[0.08em] text-[#a1a1aa] uppercase">
        {label}
      </span>
      <div className="flex flex-col gap-0">
        <button
          type="button"
          aria-label={`Sort ${label} ascending`}
          onClick={() => onSort("asc")}
          className={cn(
            "flex size-3.5 items-center justify-center rounded-sm text-[#c4c4cc] transition-colors hover:bg-[#f4f4f5] hover:text-[#71717a]",
            activeDirection === "asc" && "bg-[#fff7ed] text-[#f97316]"
          )}
        >
          <ChevronUp className="size-3" strokeWidth={2.5} />
        </button>
        <button
          type="button"
          aria-label={`Sort ${label} descending`}
          onClick={() => onSort("desc")}
          className={cn(
            "flex size-3.5 items-center justify-center rounded-sm text-[#c4c4cc] transition-colors hover:bg-[#f4f4f5] hover:text-[#71717a]",
            activeDirection === "desc" && "bg-[#fff7ed] text-[#f97316]"
          )}
        >
          <ChevronDown className="size-3" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}
