"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

const data = [
  { month: "Jan", revenue: 4200 },
  { month: "Feb", revenue: 5100 },
  { month: "Mar", revenue: 4800 },
  { month: "Apr", revenue: 6200 },
  { month: "May", revenue: 7300 },
  { month: "Jun", revenue: 6900 },
  { month: "Jul", revenue: 8100 },
  { month: "Aug", revenue: 7700 },
  { month: "Sep", revenue: 9200 },
]

export function RevenueBarChart() {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        className="outline-none [&_.recharts-surface]:outline-none"
        style={{ outline: "none" }}
        data={data}
        margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="month"
          stroke="var(--muted-foreground)"
          fontSize={12}
          tickLine={false}
          angle={0}
          textAnchor="middle"
          axisLine={false}
        />
        <YAxis
          stroke="var(--muted-foreground)"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `$${v / 1000}k`}
        />
        <Tooltip
          cursor={false}
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
            color: "var(--popover-foreground)",
          }}
          formatter={(v) => [`$${Number(v).toLocaleString()}`, "Revenue"]}
        />
        <Bar
          dataKey="revenue"
          fill="var(--primary)"
          radius={[6, 6, 0, 0]}
          activeBar={false}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
