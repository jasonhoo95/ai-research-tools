import type { TableArtifact } from "@/lib/chat-types"

export function ArtifactTable({ artifact }: { artifact: TableArtifact }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-muted/50">
          <tr>
            {artifact.columns.map((col) => (
              <th
                key={col}
                className="border-b px-3 py-2 text-left font-semibold text-muted-foreground"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {artifact.rows.map((row, ri) => (
            <tr key={ri} className="odd:bg-background even:bg-muted/20">
              {row.map((cell, ci) => (
                <td key={ci} className="border-b border-border/40 px-3 py-2 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
