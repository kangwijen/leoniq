"use client"

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type MonitorPoint = {
  checkedAt: string
  latencyMs: number | null
  status: "up" | "down"
}

type MonitorChartProps = {
  title: string
  data: MonitorPoint[]
  mode?: "latency" | "uptime"
}

export const MonitorChart = ({ title, data, mode = "latency" }: MonitorChartProps) => {
  const chartData =
    mode === "uptime"
      ? data.map(point => ({
          ...point,
          uptimeValue: point.status === "up" ? 1 : 0,
        }))
      : data

  return (
    <Card className="border-zinc-800 bg-zinc-950/80 text-zinc-100">
      <CardHeader>
        <CardTitle className="text-base sm:text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-56 w-full sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                dataKey="checkedAt"
                tick={{ fill: "#a1a1aa", fontSize: 12 }}
                tickFormatter={value => new Date(value).toLocaleTimeString()}
              />
              <YAxis
                tick={{ fill: "#a1a1aa", fontSize: 12 }}
                domain={mode === "uptime" ? [0, 1] : undefined}
                ticks={mode === "uptime" ? [0, 1] : undefined}
                tickFormatter={value =>
                  mode === "uptime"
                    ? Number(value) === 1
                      ? "Up"
                      : "Down"
                    : String(value)
                }
              />
              <Tooltip
                contentStyle={{
                  background: "#09090b",
                  border: "1px solid #27272a",
                  borderRadius: "0.75rem",
                }}
                labelFormatter={value => new Date(value).toLocaleString()}
                formatter={value =>
                  mode === "uptime"
                    ? Number(value) === 1
                      ? "Up"
                      : "Down"
                    : `${value} ms`
                }
              />
              <Area
                type={mode === "uptime" ? "stepAfter" : "monotone"}
                dataKey={mode === "uptime" ? "uptimeValue" : "latencyMs"}
                stroke={mode === "uptime" ? "#60a5fa" : "#22c55e"}
                fill={mode === "uptime" ? "#60a5fa33" : "#22c55e33"}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
