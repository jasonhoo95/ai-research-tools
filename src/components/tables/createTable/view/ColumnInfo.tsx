"use client"

import { useCallback, useEffect, useState } from "react"

import CSVUploader from "@/components/csv-uploader"
import { useStepperContext } from "@/lib/contexts"
import { useTableCreateStore } from "@/store/table-create"

export default function ColumnInfo() {
  const { setSubmit, stepCount, setIndex, items, setItems } = useStepperContext()
  const setDraft = useTableCreateStore((state) => state.setDraft)
  const [tableData, setTableData] = useState<Record<string, string>[]>(items.tableData)

  useEffect(() => {
    setSubmit(() => {
      setItems({
        ...items,
        tableData,
      })
      setDraft({ tableData })
      setIndex(stepCount + 1)
    })
  }, [items, setDraft, setIndex, setItems, setSubmit, stepCount, tableData])

  const onDataParsed = useCallback((parsedData: Record<string, string>[]) => {
    setTableData(parsedData)
  }, [])

  return (
    <div>
      <CSVUploader onDataParsed={onDataParsed} />
    </div>
  )
}
