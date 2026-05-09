/** Protocol kind for HTTP vs TCP monitors */
export type MonitorKind = "http" | "tcp"

/** Result of a single health check */
export type MonitorCheckStatus = "up" | "down"

/** Dashboard wall and detail charts time window */
export type RangeOption = "1h" | "6h" | "24h" | "7d"

export const RANGE_MS: Record<RangeOption, number> = {
  "1h": 1 * 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
}

/** Serialized check row for dashboard clients (operations wall, live sections) */
export type DashboardCheckSample = {
  monitorId: string
  monitorName: string
  monitorType: MonitorKind
  checkedAt: string
  status: MonitorCheckStatus
  latencyMs: number | null
  statusCode: number | null
  errorMessage: string | null
  meta: Record<string, unknown> | null
}

/** Monitor row with sparkline series (table, live sections) */
export type DashboardMonitor = {
  id: string
  name: string
  type: MonitorKind
  active: boolean
  lastStatus: MonitorCheckStatus | null
  intervalSeconds: number
  lastCheckedAt: string | Date | null
  uptimeSeries: number[]
  latencySeries: number[]
  tags?: string[]
}

/** Subset for KPI cards */
export type DashboardKpiMonitor = Pick<DashboardMonitor, "active" | "lastStatus">

/** Point for latency and uptime charts */
export type MonitorChartPoint = {
  checkedAt: string
  latencyMs: number | null
  status: MonitorCheckStatus
}

/** Monitor detail analytics includes errors for incident reconstruction */
export type MonitorDetailPoint = MonitorChartPoint & {
  errorMessage: string | null
}
