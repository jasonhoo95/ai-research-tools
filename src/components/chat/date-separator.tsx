/** Local-calendar day key, e.g. "2026-9-24". */
export function dayKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

/** "Today", "Yesterday", a weekday within the last week, else a full date. */
export function formatDayLabel(iso: string, now = new Date()): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""

  const startOf = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((startOf(now) - startOf(date)) / 86_400_000)

  if (days === 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days > 1 && days < 7) {
    return new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(date)
  }
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  }).format(date)
}

export function DateSeparator({ iso }: { iso: string }) {
  const label = formatDayLabel(iso)
  if (!label) return null
  return (
    <div className="flex items-center justify-center" role="separator">
      <span className="rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground shadow-xs">
        {label}
      </span>
    </div>
  )
}
