"use client"

import EditFields from "@/components/tables/fields/EditFields"
import type { TableColumn, TableRow } from "@/store/table-store"

type TableCellComponentProps = {
  row: TableRow
  column: TableColumn
  cell: unknown
}

export function TableCellComponent({ row, column, cell }: TableCellComponentProps) {
  if (column.type === "description" || column.property === "description") {
    return <EditFields row={row} column={column} />
  }

  const display =
    typeof cell === "object" && cell !== null && "value" in cell
      ? String((cell as { value?: unknown }).value ?? "")
      : String(cell ?? "")

  return (
    <div className="text-sm text-gray-700 whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis">
      {display}
    </div>
  )
}
