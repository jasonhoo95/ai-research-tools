import type { TableColumn, TableRow } from "@/store/table-store"

export type { TableColumn, TableRow }

export type TableSetupProps = {
  tableData: TableRow[]
  tableColumns: TableColumn[]
  renderCell: (row: TableRow, column: TableColumn, cell: unknown) => React.ReactNode
  pageProps: {
    page: number
    limit: number
  }
  dataCallback: (data: TableRow[]) => void
  searchEnabled?: boolean
}
