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

  return columns.some((column) =>
    getCellDisplayValue(getRowCellValue(row, column.key))
      .toLowerCase()
      .includes(query)
  )
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" })

// "1,200", "$1,200", "RM50m", "12%", "-3.5" → the number; words with digits
// in the middle ("Q3 2024") are not numbers.
const NUMBER_PATTERN = /^[^\d\s+-]{0,3}\s?([-+]?\d[\d,]*(?:\.\d+)?)\s?[a-z%]{0,3}$/i
// "28 July 2020", "July 28, 2020", "Jul 2020", "2020-07-28"
const DATE_PATTERN =
  /^(\d{1,2}\s+[a-z]{3,}\.?,?\s+\d{4}|[a-z]{3,}\.?\s+(\d{1,2},?\s+)?\d{4}|\d{4}-\d{2}-\d{2}\S*)$/i

function parseNumber(value: string): number | null {
  const match = value.trim().match(NUMBER_PATTERN)
  if (!match) return null
  const num = Number(match[1].replace(/,/g, ""))
  return Number.isFinite(num) ? num : null
}

function parseDate(value: string): number | null {
  if (!DATE_PATTERN.test(value.trim())) return null
  const time = Date.parse(value)
  return Number.isNaN(time) ? null : time
}

/** Compare cell text as dates or numbers when both sides are, else naturally. */
export function compareText(a: string, b: string): number {
  // Dates first: "Jul 2020" would otherwise read as the number 2020.
  const dateA = parseDate(a)
  const dateB = parseDate(b)
  if (dateA !== null && dateB !== null) return dateA - dateB
  const numA = parseNumber(a)
  const numB = parseNumber(b)
  if (numA !== null && numB !== null) return numA - numB
  return collator.compare(a, b)
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

    // Blank cells always sink to the bottom, whichever the direction.
    const blankA = valueA === ""
    const blankB = valueB === ""
    if (blankA || blankB) return blankA === blankB ? 0 : blankA ? 1 : -1

    let comparison = 0
    if (typeof valueA === "number" && typeof valueB === "number") {
      comparison = valueA - valueB
    } else {
      comparison = compareText(String(valueA), String(valueB))
    }

    return sort.direction === "asc" ? comparison : -comparison
  })
}
