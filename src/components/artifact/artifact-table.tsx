"use client"

import * as React from "react"

import TableSetup from "@/components/tables/components/tableSetup"
import { getCellDisplayValue } from "@/components/tables/crm/table-utils"
import type { TableArtifact } from "@/lib/chat-types"
import type { MessageArtifactResult } from "@/lib/chat-repo"
import { chatRepo } from "@/lib/chat-repo"
import { cn } from "@/lib/utils"
import type { TableColumn, TableRow } from "@/store/table-store"

const SAVE_DELAY_MS = 600

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

/**
 * Notion-style inline editor: reads as text, click (or Enter) to edit.
 * Enter saves, Shift+Enter adds a line (multiline only), Esc cancels,
 * clicking away saves.
 */
function EditableText({
  value,
  onCommit,
  label,
  multiline = false,
  placeholder = "Empty",
  displayClassName,
  inputClassName,
}: {
  value: string
  onCommit: (value: string) => void
  label: string
  multiline?: boolean
  placeholder?: string
  displayClassName?: string
  inputClassName?: string
}) {
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(value)
  const ref = React.useRef<HTMLTextAreaElement>(null)
  const cancelledRef = React.useRef(false)

  // Grow with the text while editing.
  React.useLayoutEffect(() => {
    const el = ref.current
    if (!editing || !el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [editing, draft])

  // Focus with the caret at the end, like clicking into a Notion cell.
  React.useEffect(() => {
    const el = ref.current
    if (!editing || !el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [editing])

  const start = () => {
    cancelledRef.current = false
    setDraft(value)
    setEditing(true)
  }

  const finish = () => {
    setEditing(false)
    if (cancelledRef.current) return
    const next = multiline ? draft.trim() : draft.replace(/\s+/g, " ").trim()
    if (next !== value) onCommit(next)
  }

  if (editing) {
    return (
      <textarea
        ref={ref}
        rows={1}
        value={draft}
        aria-label={label}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={finish}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault()
            cancelledRef.current = true
            e.currentTarget.blur()
          } else if (e.key === "Enter" && !(multiline && e.shiftKey)) {
            e.preventDefault()
            e.currentTarget.blur()
          }
        }}
        className={cn(
          "-mx-2 -my-1 block w-[calc(100%+1rem)] min-w-32 resize-none overflow-hidden rounded-md bg-white px-2 py-1 whitespace-pre-wrap text-[#27272a] shadow-sm ring-2 ring-[#f97316]/40 outline-none",
          inputClassName,
        )}
      />
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Edit ${label}`}
      onClick={start}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === "F2") {
          e.preventDefault()
          start()
        }
      }}
      className={cn(
        "-mx-2 -my-1 min-h-7 cursor-text rounded-md px-2 py-1 transition-colors hover:bg-[#f4f4f5] focus-visible:ring-2 focus-visible:ring-[#f97316]/30 focus-visible:outline-none",
        displayClassName,
      )}
    >
      {value || <span className="text-[#c4c4cc]">{placeholder}</span>}
    </div>
  )
}

/**
 * Generated table rendered with the CRM table: search across every cell,
 * sort any column, click any header or cell to edit it, and select rows to
 * delete. Edits are saved back to the chat.
 */
export function ArtifactTable({
  artifact,
  data,
}: {
  artifact: TableArtifact
  data?: MessageArtifactResult
}) {
  const [columns, setColumns] = React.useState(() => toColumns(artifact))
  const [rows, setRows] = React.useState(() => toRows(artifact))
  const columnsRef = React.useRef(columns)
  const rowsRef = React.useRef(rows)
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    const nextColumns = toColumns(artifact)
    const nextRows = toRows(artifact)
    columnsRef.current = nextColumns
    rowsRef.current = nextRows
    setColumns(nextColumns)
    setRows(nextRows)
  }, [artifact])

  const saveNow = React.useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    if (!data) return

    const row = data as unknown as StoredArtifactRow
    const artifactData = {
      id: row.content.id,
      artifact: {
        ...row.content.artifact,
        ...artifact,
        columns: columnsRef.current.map((col) => col.label),
        rows: fromRows(rowsRef.current, columnsRef.current),
      },
    }

    const serialized = JSON.stringify(artifactData)
    if (serialized === lastSavedRef.current) return
    lastSavedRef.current = serialized

    chatRepo
      .updateMessageArtifact(row.parent_chatbot_id, row.id, artifactData as never)
      .catch((err) => {
        lastSavedRef.current = null
        console.error("Failed to save table", err)
      })
  }, [artifact, data])

  // Flush any pending edit when leaving the page.
  React.useEffect(
    () => () => {
      if (saveTimerRef.current) saveNow()
    },
    [saveNow],
  )

  const scheduleSave = React.useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(saveNow, SAVE_DELAY_MS)
  }, [saveNow])

  const commitRows = React.useCallback(
    (next: TableRow[]) => {
      rowsRef.current = next
      setRows(next)
      scheduleSave()
    },
    [scheduleSave],
  )

  const updateCell = React.useCallback(
    (rowId: TableRow["id"], key: string, value: string) =>
      commitRows(
        rowsRef.current.map((r) => (r.id === rowId ? { ...r, [key]: { value } } : r)),
      ),
    [commitRows],
  )

  const renameColumn = React.useCallback(
    (key: string, label: string) => {
      const next = columnsRef.current.map((col) =>
        col.key === key ? { ...col, label } : col,
      )
      columnsRef.current = next
      setColumns(next)
      scheduleSave()
    },
    [scheduleSave],
  )

  const renderCell = React.useCallback(
    (row: TableRow, column: TableColumn, cell: unknown) => (
      <EditableText
        value={getCellDisplayValue(cell)}
        onCommit={(value) => updateCell(row.id, column.key, value)}
        label={`${column.label} cell`}
        multiline
        displayClassName="block min-w-24 max-w-md whitespace-pre-wrap text-sm leading-relaxed text-[#3f3f46]"
        inputClassName="max-w-md text-sm leading-relaxed"
      />
    ),
    [updateCell],
  )

  const renderColumnLabel = React.useCallback(
    (column: TableColumn) => (
      <EditableText
        value={column.label}
        onCommit={(label) => renameColumn(column.key, label || column.label)}
        label={`${column.label} column name`}
        placeholder="Untitled"
        displayClassName="text-[11px] font-semibold tracking-[0.08em] text-[#a1a1aa] uppercase whitespace-nowrap"
        inputClassName="min-w-28 text-xs font-semibold text-[#52525b]"
      />
    ),
    [renameColumn],
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
      renderColumnLabel={renderColumnLabel}
      // The CRM variant has no pager, so show every row.
      pageProps={{ page: 1, limit: Math.max(rows.length, 1) }}
      dataCallback={commitRows}
    />
  )
}
