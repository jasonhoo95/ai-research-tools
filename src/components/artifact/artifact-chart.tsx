"use client"

import * as React from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Sector,
  Tooltip,
  XAxis,
  YAxis,
  type PieSectorShapeProps,
} from "recharts"

import type { ChartArtifact, ChartDataPoint } from "@/lib/chat-types"
import { cn } from "@/lib/utils"

/** Categorical palette: the brand orange first, then well-spaced hues. */
const COLORS = [
  "#f97316", // orange
  "#8b5cf6", // violet
  "#0ea5e9", // sky
  "#10b981", // emerald
  "#f43f5e", // rose
  "#f59e0b", // amber
  "#6366f1", // indigo
  "#14b8a6", // teal
  "#ec4899", // pink
  "#84cc16", // lime
]

const colorAt = (index: number) => COLORS[index % COLORS.length]

const CHART_HEIGHT = 340
/** Bars get value labels only while they have room. */
const MAX_LABELLED_BARS = 12

const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 })
const compactFormat = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 1,
})
const percentFormat = new Intl.NumberFormat(undefined, {
  style: "percent",
  maximumFractionDigits: 1,
})

const formatValue = (value: unknown) =>
  typeof value === "number" ? numberFormat.format(value) : String(value ?? "")

const formatAxis = (value: unknown) =>
  typeof value === "number" ? compactFormat.format(value) : String(value ?? "")

/** Recharts fills in these props when the element is passed as `content`. */
function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean
  payload?: Array<{ value?: unknown; color?: string; payload?: ChartDataPoint & { color?: string } }>
  label?: string | number
  unit?: string
}) {
  const item = payload?.[0]
  if (!active || !item) return null
  const color = item.payload?.color ?? item.color ?? COLORS[0]

  return (
    <div className="rounded-xl border border-(--border) bg-(--popover) px-3 py-2 text-xs text-(--popover-foreground) shadow-lg shadow-black/5">
      <p className="mb-1 font-medium text-(--muted-foreground)">{label ?? item.payload?.label}</p>
      <div className="flex items-center gap-2">
        <span className="size-2.5 rounded-full" style={{ background: color }} />
        <span className="text-sm font-semibold tabular-nums">{formatValue(item.value)}</span>
        {unit ? <span className="text-(--muted-foreground)">{unit}</span> : null}
      </div>
    </div>
  )
}

/** Axis captions sit outside the SVG so they never collide with tick labels. */
function AxisCaptions({
  xLabel,
  yLabel,
  children,
}: {
  xLabel?: string
  yLabel?: string
  children: React.ReactNode
}) {
  return (
    <div>
      {yLabel ? (
        <p className="mb-2 text-xs font-medium text-(--muted-foreground)">{yLabel}</p>
      ) : null}
      {children}
      {xLabel ? (
        <p className="mt-1 text-center text-xs font-medium text-(--muted-foreground)">{xLabel}</p>
      ) : null}
    </div>
  )
}

function ChartCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-(--border) bg-(--card) p-5 shadow-sm", className)}>
      {children}
    </div>
  )
}

const axisProps = {
  stroke: "var(--muted-foreground)",
  fontSize: 12,
  tickLine: false,
  axisLine: false,
} as const

function DonutChart({ data }: { data: ChartDataPoint[] }) {
  const [clicked, setClicked] = React.useState<number | null>(null)
  // Ignore a selection the data no longer has.
  const selected = clicked !== null && clicked < data.length ? clicked : null
  const total = data.reduce((sum, d) => sum + (Number.isFinite(d.value) ? d.value : 0), 0)
  const current = selected === null ? null : data[selected]

  const toggle = (index: number) => setClicked((prev) => (prev === index ? null : index))
  const share = (value: number) => (total > 0 ? percentFormat.format(value / total) : "—")

  const renderSector = (props: PieSectorShapeProps) => {
    const { index, cx, cy, innerRadius, outerRadius, startAngle, endAngle } = props
    const isSelected = selected === index
    const dimmed = selected !== null && !isSelected
    return (
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={isSelected ? innerRadius - 4 : innerRadius}
        outerRadius={isSelected ? outerRadius + 10 : outerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        cornerRadius={6}
        fill={colorAt(index)}
        fillOpacity={dimmed ? 0.3 : 1}
        stroke="var(--card)"
        strokeWidth={2}
        className="cursor-pointer transition-[fill-opacity] duration-200 outline-none"
      />
    )
  }

  return (
    <ChartCard className="@container">
      <div className="flex flex-col items-center gap-6 @xl:flex-row">
        <div className="relative aspect-square w-full max-w-80 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                innerRadius="62%"
                outerRadius="88%"
                paddingAngle={2}
                startAngle={90}
                endAngle={-270}
                animationBegin={0}
                animationDuration={800}
                shape={renderSector}
                onClick={(_, index) => toggle(index)}
                rootTabIndex={-1}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Centre readout: the clicked slice, or the total. */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="flex max-w-[45%] flex-col items-center text-center">
              <span
                className="line-clamp-2 text-xs font-medium text-(--muted-foreground)"
                title={current?.label}
              >
                {current ? current.label : "Total"}
              </span>
              <span
                className="mt-1 text-xl font-semibold tracking-tight tabular-nums @xs:text-2xl @xl:text-3xl"
                style={current ? { color: colorAt(selected ?? 0) } : undefined}
              >
                {formatValue(current ? current.value : total)}
              </span>
              {current ? (
                <span className="mt-0.5 text-xs text-(--muted-foreground) tabular-nums">
                  {share(current.value)} of total
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <ul className="flex w-full min-w-0 flex-1 flex-col gap-1" aria-label="Legend">
          {data.map((d, i) => {
            const isSelected = selected === i
            return (
              <li key={`${d.label}-${i}`}>
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => toggle(i)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-(--muted)",
                    isSelected && "bg-(--muted)",
                    selected !== null && !isSelected && "opacity-50",
                  )}
                >
                  <span className="size-3 shrink-0 rounded-full" style={{ background: colorAt(i) }} />
                  <span className="min-w-0 flex-1 truncate" title={d.label}>
                    {d.label}
                  </span>
                  <span className="font-medium tabular-nums">{formatValue(d.value)}</span>
                  <span className="w-14 text-right text-xs text-(--muted-foreground) tabular-nums">
                    {share(d.value)}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </ChartCard>
  )
}

function LineAreaChart({ artifact, data }: { artifact: ChartArtifact; data: ChartDataPoint[] }) {
  const gradientId = `line-fill-${React.useId().replace(/:/g, "")}`
  const color = COLORS[0]

  return (
    <ChartCard>
      <AxisCaptions xLabel={artifact.xLabel} yLabel={artifact.yLabel}>
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <AreaChart data={data} margin={{ top: 12, right: 16, left: -4, bottom: 4 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" {...axisProps} tickMargin={10} minTickGap={16} />
            <YAxis {...axisProps} tickFormatter={formatAxis} width={48} />
            <Tooltip
              content={<ChartTooltip unit={artifact.yLabel} />}
              cursor={{ stroke: color, strokeOpacity: 0.3, strokeWidth: 1.5, strokeDasharray: "4 4" }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2.5}
              fill={`url(#${gradientId})`}
              dot={{ r: 3.5, fill: "var(--card)", stroke: color, strokeWidth: 2 }}
              activeDot={{ r: 6, fill: color, stroke: "var(--card)", strokeWidth: 3 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </AxisCaptions>
    </ChartCard>
  )
}

function ColumnChart({ artifact, data }: { artifact: ChartArtifact; data: ChartDataPoint[] }) {
  const idPrefix = `bar-fill-${React.useId().replace(/:/g, "")}`
  const crowded = data.length > 6
  // Each bar's solid colour, for the tooltip swatch (the fill is a gradient).
  const coloredData = React.useMemo(
    () => data.map((d, i) => ({ ...d, color: colorAt(i) })),
    [data],
  )

  return (
    // Hovering one bar fades the others. Done in CSS: re-rendering the bars
    // on hover would replay their animation and hide the value labels.
    <ChartCard className="[&_.recharts-bar-rectangle]:transition-opacity [&_.recharts-bar-rectangle]:duration-200 [&_.recharts-bar-rectangles:hover_.recharts-bar-rectangle:not(:hover)]:opacity-45">
      <AxisCaptions xLabel={artifact.xLabel} yLabel={artifact.yLabel}>
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <BarChart
            data={coloredData}
            margin={{ top: 24, right: 16, left: -4, bottom: 4 }}
          >
            <defs>
              {COLORS.map((color, i) => (
                <linearGradient key={color} id={`${idPrefix}-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={1} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.65} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="label"
              {...axisProps}
              interval={0}
              tickMargin={8}
              angle={crowded ? -30 : 0}
              textAnchor={crowded ? "end" : "middle"}
              height={crowded ? 64 : 32}
            />
            <YAxis {...axisProps} tickFormatter={formatAxis} width={48} />
            <Tooltip
              content={<ChartTooltip unit={artifact.yLabel} />}
              cursor={{ fill: "var(--muted)", opacity: 0.5, radius: 8 }}
            />
            <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={56}>
              {data.map((_, i) => (
                <Cell key={i} fill={`url(#${idPrefix}-${i % COLORS.length})`} />
              ))}
              {data.length <= MAX_LABELLED_BARS ? (
                <LabelList
                  dataKey="value"
                  position="top"
                  offset={8}
                  formatter={formatAxis}
                  className="fill-(--muted-foreground) text-[11px] font-medium"
                />
              ) : null}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </AxisCaptions>
    </ChartCard>
  )
}

export function ArtifactChart({ artifact }: { artifact: ChartArtifact }) {
  const data = React.useMemo(() => artifact.data.map((d) => ({ ...d })), [artifact.data])

  if (artifact.chartType === "donut") return <DonutChart data={data} />
  if (artifact.chartType === "line") return <LineAreaChart artifact={artifact} data={data} />
  return <ColumnChart artifact={artifact} data={data} />
}
