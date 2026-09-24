"use client"

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"

const data = [
  { name: "Direct", value: 42 },
  { name: "Search", value: 28 },
  { name: "Social", value: 18 },
  { name: "Referral", value: 12 },
]

const COLORS = [
  "var(--primary)",
  "var(--chart-2, #10b981)",
  "var(--chart-3, #f59e0b)",
  "var(--chart-4, #6366f1)",
]

export function SourcesDonutChart() {
  const total = data.reduce((sum, d) => sum + d.value, 0)

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--popover-foreground)",
            }}
            formatter={(v, name) => [`${v}%`, name]}
          />
          <Pie
            data={data}
            innerRadius={70}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
            stroke="var(--background)"
            strokeWidth={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-semibold">{total}%</span>
        <span className="text-xs text-muted-foreground">total share</span>
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-2 text-sm">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: COLORS[i % COLORS.length] }}
            />
            <span className="text-muted-foreground">{d.name}</span>
            <span className="ml-auto font-medium">{d.value}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
