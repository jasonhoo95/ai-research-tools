"use client"

import * as React from "react"

import TableSetup from "@/components/tables/components/tableSetup"
import { CrmTextCell } from "@/components/tables/crm/cells"
import { getCellDisplayValue } from "@/components/tables/crm/table-utils"
import type { TableArtifact } from "@/lib/chat-types"
import type { MessageArtifactResult } from "@/lib/chat-repo"
import { chatRepo } from "@/lib/chat-repo"
import type { TableColumn, TableRow } from "@/store/table-store"

/** Raw row returned by the message-artifact endpoint. */
type StoredArtifactRow = {
  id: string
  parent_chatbot_id: string
  content: { id: string; artifact: TableArtifact }
}

const columnKey = (index: number) => `col_${index}`

function toColumns(artifact: TableArtifact): TableColumn[] {
  return artifact.columns.map((label, index) => ({
    key: columnKey(index),
    label,
    width: "auto",
    type: "text",
  }))
}

function toRows(artifact: TableArtifact): TableRow[] {
  return artifact.rows.map((cells, rowIndex) => {
    const row: TableRow = { id: `row_${rowIndex}` }
    artifact.columns.forEach((_, index) => {
      row[columnKey(index)] = { value: cells[index] ?? "" }
    })
    return row
  })
}

function fromRows(rows: TableRow[], columns: TableColumn[]): string[][] {
  return rows.map((row) => columns.map((col) => getCellDisplayValue(row[col.key])))
}

// Generated cells can be sentences; let them wrap instead of stretching the
// table (the CRM table cells are nowrap).
function renderCell(_row: TableRow, _column: TableColumn, cell: unknown) {
  return (
    <span className="block min-w-24 max-w-md whitespace-normal leading-relaxed">
      <CrmTextCell>{getCellDisplayValue(cell)}</CrmTextCell>
    </span>
  )
}

/**
 * Generated table rendered with the CRM table: search across every cell,
 * sort any column, and select rows to delete (saved back to the chat).
 */
export function ArtifactTable({
  artifact,
  data,
}: {
  artifact: TableArtifact
  data?: MessageArtifactResult
}) {
  const columns = React.useMemo(() => toColumns(artifact), [artifact])
  const [rows, setRows] = React.useState(() => toRows(artifact))

  React.useEffect(() => {
    setRows(toRows(artifact))
  }, [artifact])

  const handleRowsChange = React.useCallback(
    (next: TableRow[]) => {
      setRows(next)
      if (!data) return
      const row = data as unknown as StoredArtifactRow
      const artifactData = {
        id: row.content.id,
        artifact: { ...row.content.artifact, ...artifact, rows: fromRows(next, columns) },
      }
      chatRepo
        .updateMessageArtifact(row.parent_chatbot_id, row.id, artifactData as never)
        .catch((err) => console.error("Failed to save table", err))
    },
    [artifact, columns, data],
  )

  return (
    <TableSetup
      variant="crm"
      embedded
      toolbarActions={false}
      emptyLabel="rows"
      tableData={rows}
      tableColumns={columns}
      renderCell={renderCell}
      // The CRM variant has no pager, so show every row.
      pageProps={{ page: 1, limit: Math.max(rows.length, 1) }}
      dataCallback={handleRowsChange}
    />
  )
}
