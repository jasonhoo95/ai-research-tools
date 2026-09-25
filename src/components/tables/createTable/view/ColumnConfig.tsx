"use client"

import { useEffect, useMemo } from "react"

import { TableCellComponent } from "@/components/tables/components/table-cell-component"
import TableSetup from "@/components/tables/components/tableSetup"
import { useStepperContext } from "@/lib/contexts"
import { useTableStore, type TableColumn, type TableRow } from "@/store/table-store"

const TABLE_ID = "id_1"

export default function ColumnConfig() {
  const { items } = useStepperContext()
  const { tables, createTable, setTableData } = useTableStore()

  const columns = useMemo<TableColumn[]>(() => {
    const firstRow = items.tableData[0]
    if (!firstRow) return []
    return Object.keys(firstRow).map((key) => ({
      key,
      label: key,
      width: "150px",
      type: "text",
    }))
  }, [items.tableData])

  const tableData = useMemo<TableRow[]>(() => {
    return items.tableData.map((item, index) => {
      const row: TableRow = { id: index.toString() }
      for (const [key, value] of Object.entries(item)) {
        row[key] = { value }
      }
      return row
    })
  }, [items.tableData])

  useEffect(() => {
    if (columns.length === 0) return
    createTable(TABLE_ID, items.name || "Table 1", columns, tableData)
  }, [columns, createTable, items.name, tableData])

  const currentTable = tables[TABLE_ID]

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Column Config</h2>
      <TableSetup
        tableData={currentTable?.tableData ?? tableData}
        pageProps={{ page: 1, limit: 10 }}
        dataCallback={(data) => {
          setTableData(TABLE_ID, data)
        }}
        renderCell={(row, column, cell) => (
          <TableCellComponent row={row} column={column} cell={cell} />
        )}
        tableColumns={currentTable?.columns ?? columns}
      />
    </div>
  )
}
