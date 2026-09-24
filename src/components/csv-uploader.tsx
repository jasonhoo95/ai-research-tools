"use client"

import { Upload } from "lucide-react"
import { useCallback, useState } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type CSVUploaderProps = {
  onDataParsed: (data: Record<string, string>[]) => void
  className?: string
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0) return []

  const headers = lines[0].split(",").map((header) => header.trim())
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((value) => value.trim())
    return headers.reduce<Record<string, string>>((acc, header, index) => {
      acc[header] = values[index] ?? ""
      return acc
    }, {})
  })
}

export default function CSVUploader({ onDataParsed, className }: CSVUploaderProps) {
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFile = useCallback(
    async (file: File) => {
      setError(null)
      try {
        const text = await file.text()
        const parsed = parseCsv(text)
        if (parsed.length === 0) {
          setError("No rows found in this CSV file.")
          return
        }
        setFileName(file.name)
        onDataParsed(parsed)
      } catch {
        setError("Could not read this CSV file.")
      }
    },
    [onDataParsed]
  )

  return (
    <div className={cn("space-y-3", className)}>
      <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-8 transition-colors hover:bg-muted/40">
        <Upload className="size-8 text-muted-foreground" />
        <div className="text-center">
          <p className="text-sm font-medium">Upload CSV</p>
          <p className="text-xs text-muted-foreground">
            First row should contain column headers
          </p>
        </div>
        <input
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void handleFile(file)
          }}
        />
        <Button type="button" variant="outline" size="sm">
          Choose file
        </Button>
      </label>
      {fileName && (
        <p className="text-sm text-muted-foreground">Loaded: {fileName}</p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
