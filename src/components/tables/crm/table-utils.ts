import type { TableColumn, TableRow } from "@/store/table-store"

export type SortDirection = "asc" | "desc"

export type ColumnSort = {
  key: string
  direction: SortDirection
}

export function getCellDisplayValue(cell: unknown): string {
  if (cell == null) return ""
  if (typeof cell === "object" && "value" in cell) {
    return String((cell as { value?: unknown }).value ?? "")
  }
  return String(cell)
}

export function getRowCellValue(row: TableRow, columnKey: string): unknown {
  return row[columnKey]
}

export function getSortableValue(row: TableRow, column: TableColumn): string | number {
  const raw = getRowCellValue(row, column.key)

  if (column.type === "score") {
    const cell = raw
    if (typeof cell === "object" && cell !== null && "value" in cell) {
      const num = Number((cell as { value?: unknown }).value)
      return Number.isFinite(num) ? num : 0
    }
    const num = Number(raw)
    return Number.isFinite(num) ? num : 0
  }

  return getCellDisplayValue(raw).toLowerCase()
}

export function rowMatchesSearch(
  row: TableRow,
  columns: TableColumn[],
  searchTerm: string
): boolean {
  const query = searchTerm.trim().toLowerCase()
  if (!query) return true

  if (String(row.id).toLowerCase().includes(query)) {
    return true
  }

  return columns.some((column) =>
    getCellDisplayValue(getRowCellValue(row, column.key))
      .toLowerCase()
      .includes(query)
  )
}

export function sortRows(
  rows: TableRow[],
  columns: TableColumn[],
  sort: ColumnSort | null
): TableRow[] {
  if (!sort) return rows

  const column = columns.find((col) => col.key === sort.key)
  if (!column) return rows

  return [...rows].sort((rowA, rowB) => {
    const valueA = getSortableValue(rowA, column)
    const valueB = getSortableValue(rowB, column)

    let comparison = 0
    if (typeof valueA === "number" && typeof valueB === "number") {
      comparison = valueA - valueB
    } else {
      comparison = String(valueA).localeCompare(String(valueB))
    }

    return sort.direction === "asc" ? comparison : -comparison
  })
}
