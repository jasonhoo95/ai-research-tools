"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import type { DraggableAttributes } from "@dnd-kit/core"
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities"

import { TableHead, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

type SortableRowProps = {
  id: string
  className?: string
  children: (
    attributes: DraggableAttributes,
    listeners: SyntheticListenerMap | undefined
  ) => React.ReactNode
}

export function SortableRow({ id, className, children }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }

  return (
    <TableRow ref={setNodeRef} style={style} className={className}>
      {children(attributes, listeners)}
    </TableRow>
  )
}

type SortableColumnHeaderProps = {
  id: string
  className?: string
  children: React.ReactNode
}

export function SortableColumnHeader({
  id,
  className,
  children,
}: SortableColumnHeaderProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }

  return (
    <TableHead
      ref={setNodeRef}
      style={style}
      className={cn("border-r border-gray-200", className)}
      {...attributes}
      {...listeners}
    >
      {children}
    </TableHead>
  )
}
