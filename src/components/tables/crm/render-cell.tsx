"use client"

import { CrmScoreBar, CrmStatusBadge, CrmTextCell } from "@/components/tables/crm/cells"
import EditFields from "@/components/tables/fields/EditFields"
import type { TableColumn, TableRow } from "@/store/table-store"

function readCellValue(cell: unknown): string {
  if (typeof cell === "object" && cell !== null && "value" in cell) {
    return String((cell as { value?: unknown }).value ?? "")
  }
  return String(cell ?? "")
}

function readScore(cell: unknown): { score: number; max: number } {
  if (typeof cell === "object" && cell !== null) {
    const obj = cell as { value?: unknown; max?: unknown }
    const score = Number(obj.value ?? 0)
    const max = Number(obj.max ?? 10)
    return { score: Number.isFinite(score) ? score : 0, max: Number.isFinite(max) ? max : 10 }
  }
  return { score: 0, max: 10 }
}

export function renderCrmCell(row: TableRow, column: TableColumn, cell: unknown) {
  if (column.type === "description" || column.property === "description") {
    return <EditFields row={row} column={column} />
  }

  if (column.type === "status") {
    return <CrmStatusBadge status={readCellValue(cell)} />
  }

  if (column.type === "score") {
    const { score, max } = readScore(cell)
    return <CrmScoreBar score={score} max={max} />
  }

  if (column.key === "customer") {
    return <CrmTextCell emphasis>{readCellValue(cell)}</CrmTextCell>
  }

  if (column.key === "email") {
    return <CrmTextCell>{readCellValue(cell)}</CrmTextCell>
  }

  return <CrmTextCell>{readCellValue(cell)}</CrmTextCell>
}
