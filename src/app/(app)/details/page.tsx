"use client"

import { useMemo, useState } from "react"

import TableSetup from "@/components/tables/components/tableSetup"
import { CRM_COLUMNS, CRM_LEADS } from "@/components/tables/crm/data"
import { renderCrmCell } from "@/components/tables/crm/render-cell"
import type { TableRow } from "@/store/table-store"

export default function DetailsPage() {
  const [rows, setRows] = useState<TableRow[]>(CRM_LEADS)

  const tableData = useMemo(() => rows, [rows])

  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <TableSetup
        variant="crm"
        tableData={tableData}
        tableColumns={CRM_COLUMNS}
        renderCell={renderCrmCell}
        pageProps={{ page: 1, limit: 20 }}
        dataCallback={setRows}
      />
    </div>
  )
}
