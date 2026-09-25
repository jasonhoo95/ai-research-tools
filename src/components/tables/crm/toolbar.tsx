"use client"

import {
  ArrowDownUp,
  CloudDownload,
  CloudUpload,
  Filter,
  LayoutGrid,
  List,
  Plus,
  Search,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type CrmToolbarProps = {
  searchTerm: string
  onSearchChange: (value: string) => void
  onAddLead?: () => void
  /** Show filter / sort / view / import / export / add buttons. */
  showActions?: boolean
  /** Number of matching rows, shown while searching. */
  resultCount?: number
  className?: string
}

export function CrmToolbar({
  searchTerm,
  onSearchChange,
  onAddLead,
  showActions = true,
  resultCount,
  className,
}: CrmToolbarProps) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-4", className)}>
      <div className="relative min-w-[280px] flex-1 max-w-xl">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#a1a1aa]" />
        <Input
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search"
          className="h-11 rounded-xl border-[#ececef] bg-white pl-10 text-sm shadow-none placeholder:text-[#a1a1aa] focus-visible:border-[#f97316]/40 focus-visible:ring-[#f97316]/20"
        />
      </div>

      {resultCount !== undefined ? (
        <span className="text-sm text-[#71717a]" aria-live="polite">
          {resultCount} {resultCount === 1 ? "result" : "results"}
        </span>
      ) : null}

      {showActions ? (
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-xl border-[#ececef] bg-white px-4 text-sm font-medium text-[#52525b] shadow-none hover:bg-[#fafafa]"
        >
          <Filter className="size-4" />
          Filter
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-xl border-[#ececef] bg-white px-4 text-sm font-medium text-[#52525b] shadow-none hover:bg-[#fafafa]"
        >
          <ArrowDownUp className="size-4" />
          Sort
        </Button>
        <div className="flex overflow-hidden rounded-xl border border-[#ececef] bg-white">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 rounded-none text-[#71717a] hover:bg-[#fafafa]"
          >
            <List className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 rounded-none border-l border-[#ececef] bg-[#fafafa] text-[#27272a] hover:bg-[#f4f4f5]"
          >
            <LayoutGrid className="size-4" />
          </Button>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-xl border-[#ececef] bg-white px-4 text-sm font-medium text-[#52525b] shadow-none hover:bg-[#fafafa]"
        >
          <CloudUpload className="size-4" />
          Import
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-xl border-[#ececef] bg-white px-4 text-sm font-medium text-[#52525b] shadow-none hover:bg-[#fafafa]"
        >
          <CloudDownload className="size-4" />
          Export
        </Button>
        <Button
          type="button"
          onClick={onAddLead}
          className="h-10 rounded-xl bg-[#f97316] px-5 text-sm font-medium text-white shadow-[0_8px_20px_rgba(249,115,22,0.28)] hover:bg-[#ea580c]"
        >
          <Plus className="size-4" />
          Add Lead
        </Button>
      </div>
      ) : null}
    </div>
  )
}
