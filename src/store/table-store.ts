import { create } from "zustand"

export type TableColumn = {
  key: string
  label: string
  width: string
  type: string
  property?: string
}

export type TableCellValue = {
  value?: string | number | boolean
  descriptionOption?: Array<{
    id: string
    field: string
    value: string
    fieldValue: string
  }>
  selected?: boolean
  [key: string]: unknown
}

export type TableRow = {
  id: string | number
  selected?: boolean
  priority?: string
  [key: string]: unknown
}

export type TableDefinition = {
  id: string
  name: string
  columns: TableColumn[]
  tableData: TableRow[]
}

type TableStoreState = {
  tables: Record<string, TableDefinition>
  currentTableId: string | null
  createTable: (
    id: string,
    name: string,
    columns: TableColumn[],
    tableData: TableRow[]
  ) => void
  getAllTables: () => TableDefinition[]
  getCurrentTable: () => TableDefinition | null
  setCurrentTableId: (id: string) => void
  setTableData: (id: string, tableData: TableRow[]) => void
  addColumn: (tableId: string, label: string, type: string) => void
  addColumnRight: (tableId: string, columnKey: string) => void
  addColumnLeft: (tableId: string, columnKey: string) => void
  updateColumnProperty: (
    tableId: string,
    columnKey: string,
    property: { label: string; type: string }
  ) => void
  updateColumnOptions: (
    tableId: string,
    columnKey: string,
    options: unknown
  ) => void
  updateCellObjectValue: (
    tableId: string,
    rowId: string | number,
    columnKey: string,
    patch: Record<string, unknown>
  ) => void
  addRow: (tableId: string) => void
}

function createEmptyColumn(label = "New Column", type = "text"): TableColumn {
  return {
    key: `column_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    label,
    width: "150px",
    type,
    property: type,
  }
}

export const useTableStore = create<TableStoreState>((set, get) => ({
  tables: {},
  currentTableId: null,

  createTable(id, name, columns, tableData) {
    set((state) => ({
      tables: {
        ...state.tables,
        [id]: { id, name, columns, tableData },
      },
      currentTableId: id,
    }))
  },

  getAllTables() {
    return Object.values(get().tables)
  },

  getCurrentTable() {
    const { currentTableId, tables } = get()
    if (!currentTableId) return null
    return tables[currentTableId] ?? null
  },

  setCurrentTableId(id) {
    set({ currentTableId: id })
  },

  setTableData(id, tableData) {
    set((state) => {
      const table = state.tables[id]
      if (!table) return state
      return {
        tables: {
          ...state.tables,
          [id]: { ...table, tableData },
        },
      }
    })
  },

  addColumn(tableId, label, type) {
    const column = createEmptyColumn(label || "New Column", type || "text")
    set((state) => {
      const table = state.tables[tableId]
      if (!table) return state
      const tableData = table.tableData.map((row) => ({
        ...row,
        [column.key]: { value: "" },
      }))
      return {
        tables: {
          ...state.tables,
          [tableId]: {
            ...table,
            columns: [...table.columns, column],
            tableData,
          },
        },
      }
    })
  },

  addColumnRight(tableId, columnKey) {
    set((state) => {
      const table = state.tables[tableId]
      if (!table) return state
      const index = table.columns.findIndex((col) => col.key === columnKey)
      if (index === -1) return state
      const column = createEmptyColumn()
      const columns = [...table.columns]
      columns.splice(index + 1, 0, column)
      const tableData = table.tableData.map((row) => ({
        ...row,
        [column.key]: { value: "" },
      }))
      return {
        tables: {
          ...state.tables,
          [tableId]: { ...table, columns, tableData },
        },
      }
    })
  },

  addColumnLeft(tableId, columnKey) {
    set((state) => {
      const table = state.tables[tableId]
      if (!table) return state
      const index = table.columns.findIndex((col) => col.key === columnKey)
      if (index === -1) return state
      const column = createEmptyColumn()
      const columns = [...table.columns]
      columns.splice(index, 0, column)
      const tableData = table.tableData.map((row) => ({
        ...row,
        [column.key]: { value: "" },
      }))
      return {
        tables: {
          ...state.tables,
          [tableId]: { ...table, columns, tableData },
        },
      }
    })
  },

  updateColumnProperty(tableId, columnKey, property) {
    set((state) => {
      const table = state.tables[tableId]
      if (!table) return state
      const columns = table.columns.map((column) =>
        column.key === columnKey
          ? {
              ...column,
              label: property.label,
              type: property.type,
              property: property.type,
            }
          : column
      )
      return {
        tables: {
          ...state.tables,
          [tableId]: { ...table, columns },
        },
      }
    })
  },

  updateColumnOptions(tableId, columnKey, options) {
    set((state) => {
      const table = state.tables[tableId]
      if (!table) return state
      const columns = table.columns.map((column) =>
        column.key === columnKey ? { ...column, ...(options as object) } : column
      )
      return {
        tables: {
          ...state.tables,
          [tableId]: { ...table, columns },
        },
      }
    })
  },

  updateCellObjectValue(tableId, rowId, columnKey, patch) {
    set((state) => {
      const table = state.tables[tableId]
      if (!table) return state
      const tableData = table.tableData.map((row) => {
        if (row.id !== rowId) return row
        const current = row[columnKey]
        const base =
          typeof current === "object" && current !== null
            ? (current as TableCellValue)
            : { value: current ?? "" }
        return {
          ...row,
          [columnKey]: { ...base, ...patch },
        }
      })
      return {
        tables: {
          ...state.tables,
          [tableId]: { ...table, tableData: tableData as TableRow[] },
        },
      }
    })
  },

  addRow(tableId) {
    set((state) => {
      const table = state.tables[tableId]
      if (!table) return state
      const row: TableRow = { id: Date.now() }
      for (const column of table.columns) {
        row[column.key] = { value: "" }
      }
      return {
        tables: {
          ...state.tables,
          [tableId]: {
            ...table,
            tableData: [...table.tableData, row],
          },
        },
      }
    })
  },
}))
