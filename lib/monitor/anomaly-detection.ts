import type { MonitorCheckStatus } from "@/lib/types"

export type AnomalyBucketPoint = {
  p95: number
  uptimePercent: number
  checks: number
}

export type LatencyAnomalySignal = {
  status: "normal" | "anomaly" | "insufficient_data"
  baselineP95: number | null
  observedP95: number | null
  deltaPercent: number | null
  modifiedZ: number | null
  reason: string
}

export type UptimeAnomalySignal = {
  status: "normal" | "anomaly" | "insufficient_data"
  minRecentUptime: number | null
  recentBucketsChecked: number
  trailingDownStreak: number
  shortWindowBurnRate: number | null
  longWindowBurnRate: number | null
  sloAvailability: number
  reason: string
}

export type DashboardAnomalyPayload = {
  latency: LatencyAnomalySignal
  uptime: UptimeAnomalySignal
}

const MIN_BUCKETS_FOR_LATENCY = 4
const MIN_BUCKETS_FOR_UPTIME_RECENT = 2
const RECENT_UPTIME_WINDOW = 3
const DOWN_STREAK_THRESHOLD = 3
/** Availability target for error budget burn (multi-window style) */
const SLO_AVAILABILITY = 0.99
const MIN_SAMPLES_FOR_BURN = 10
const SHORT_WINDOW_MIN = 8
const SHORT_WINDOW_FRACTION = 0.12
/** Recent tail must burn this many times faster than the SLO allows */
const FAST_BURN_THRESHOLD = 8
/** Full window must show at least this much burn to confirm (reduces noise) */
const SLOW_BURN_THRESHOLD = 2
const MAD_SCALE = 0.6745
const MODIFIED_Z_THRESHOLD = 3.5
const RATIO_SPIKE_THRESHOLD = 1.5

const medianSorted = (sorted: number[]) => {
  if (sorted.length === 0) {
    return 0
  }
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) {
    return sorted[mid]
  }
  return (sorted[mid - 1] + sorted[mid]) / 2
}

export const median = (values: number[]) => medianSorted([...values].sort((a, b) => a - b))

export const detectLatencyAnomaly = (buckets: AnomalyBucketPoint[]): LatencyAnomalySignal => {
  const withChecks = buckets.filter(b => b.checks > 0)
  if (withChecks.length < MIN_BUCKETS_FOR_LATENCY) {
    return {
      status: "insufficient_data",
      baselineP95: null,
      observedP95: null,
      deltaPercent: null,
      modifiedZ: null,
      reason: "Not enough buckets with checks to compare latency",
    }
  }

  const observed = withChecks[withChecks.length - 1]
  const baselineBuckets = withChecks.slice(0, -1)
  const baselineValues = baselineBuckets.map(b => b.p95)
  const baselineMedian = median(baselineValues)
  const deviations = baselineValues.map(v => Math.abs(v - baselineMedian))
  const mad = median(deviations)

  let modifiedZ: number | null = null
  if (mad > 1e-9) {
    modifiedZ = (MAD_SCALE * (observed.p95 - baselineMedian)) / mad
  }

  let spikeByRatio = false
  if (baselineMedian > 1e-9 && observed.p95 > baselineMedian * RATIO_SPIKE_THRESHOLD) {
    spikeByRatio = true
  }

  const coldStartSpike = baselineMedian < 1 && observed.p95 > 100

  const anomalyByZ = modifiedZ !== null && modifiedZ > MODIFIED_Z_THRESHOLD
  const anomaly = anomalyByZ || spikeByRatio || coldStartSpike

  const deltaPercent =
    baselineMedian > 1e-9 ? Math.round(((observed.p95 - baselineMedian) / baselineMedian) * 1000) / 10 : null

  return {
    status: anomaly ? "anomaly" : "normal",
    baselineP95: Math.round(baselineMedian * 10) / 10,
    observedP95: Math.round(observed.p95 * 10) / 10,
    deltaPercent,
    modifiedZ: modifiedZ !== null ? Math.round(modifiedZ * 100) / 100 : null,
    reason: anomaly
      ? `Latest bucket p95 ${Math.round(observed.p95)} ms vs baseline median ${Math.round(baselineMedian)} ms`
      : "Latency within expected variation for recent buckets",
  }
}

export const countTrailingDownStreak = (
  samplesOrderedOldestFirst: Array<{ status: MonitorCheckStatus }>
): number => {
  let streak = 0
  for (let i = samplesOrderedOldestFirst.length - 1; i >= 0; i -= 1) {
    if (samplesOrderedOldestFirst[i].status !== "down") {
      break
    }
    streak += 1
  }
  return streak
}

const allowedErrorRate = () => Math.max(1e-9, 1 - SLO_AVAILABILITY)

/** Error budget burn: observed failure rate divided by SLO-tolerated failure rate */
export const errorBudgetBurnRate = (samples: Array<{ status: MonitorCheckStatus }>): number | null => {
  if (samples.length === 0) {
    return null
  }
  const downs = samples.filter(s => s.status === "down").length
  const observed = downs / samples.length
  return observed / allowedErrorRate()
}

export const shortWindowSampleCount = (totalSamples: number) => {
  if (totalSamples <= 0) {
    return 0
  }
  const fromFraction = Math.floor(totalSamples * SHORT_WINDOW_FRACTION)
  return Math.min(totalSamples, Math.max(SHORT_WINDOW_MIN, fromFraction))
}

/** Lowest uptime percent among the last `window` buckets with checks, or null when none */
export const minUptimeFromRecentBuckets = (
  withChecks: AnomalyBucketPoint[],
  window: number
): number | null => {
  const recentSlice = withChecks.slice(-window)
  if (recentSlice.length === 0) {
    return null
  }
  const raw = Math.min(...recentSlice.map(b => b.uptimePercent))
  return Math.round(raw * 10) / 10
}

const baseUptimeSignal = (
  buckets: AnomalyBucketPoint[],
  samplesOrderedOldestFirst: Array<{ status: MonitorCheckStatus }>
): Pick<
  UptimeAnomalySignal,
  "minRecentUptime" | "recentBucketsChecked" | "trailingDownStreak" | "shortWindowBurnRate" | "longWindowBurnRate"
> => {
  const withChecks = buckets.filter(b => b.checks > 0)
  const recentSlice = withChecks.slice(-RECENT_UPTIME_WINDOW)
  const minRecentUptime = minUptimeFromRecentBuckets(withChecks, RECENT_UPTIME_WINDOW)
  const streak = countTrailingDownStreak(samplesOrderedOldestFirst)

  let shortBurn: number | null = null
  let longBurn: number | null = null
  if (samplesOrderedOldestFirst.length >= MIN_SAMPLES_FOR_BURN) {
    const shortLen = shortWindowSampleCount(samplesOrderedOldestFirst.length)
    const shortSamples = samplesOrderedOldestFirst.slice(-shortLen)
    shortBurn = errorBudgetBurnRate(shortSamples)
    longBurn = errorBudgetBurnRate(samplesOrderedOldestFirst)
  }

  return {
    minRecentUptime,
    recentBucketsChecked: recentSlice.length,
    trailingDownStreak: streak,
    shortWindowBurnRate: shortBurn === null ? null : Math.round(shortBurn * 10) / 10,
    longWindowBurnRate: longBurn === null ? null : Math.round(longBurn * 10) / 10,
  }
}

export const detectUptimeAnomaly = (
  buckets: AnomalyBucketPoint[],
  samplesOrderedOldestFirst: Array<{ status: MonitorCheckStatus }>
): UptimeAnomalySignal => {
  const streak = countTrailingDownStreak(samplesOrderedOldestFirst)
  const withChecks = buckets.filter(b => b.checks > 0)

  if (withChecks.length < MIN_BUCKETS_FOR_UPTIME_RECENT) {
    return {
      status: "insufficient_data",
      minRecentUptime: null,
      recentBucketsChecked: 0,
      trailingDownStreak: streak,
      shortWindowBurnRate: null,
      longWindowBurnRate: null,
      sloAvailability: SLO_AVAILABILITY,
      reason: "Not enough buckets with checks to judge uptime trend",
    }
  }

  const partial = baseUptimeSignal(buckets, samplesOrderedOldestFirst)

  const streakAnomaly =
    samplesOrderedOldestFirst.length >= DOWN_STREAK_THRESHOLD &&
    streak >= DOWN_STREAK_THRESHOLD

  const shortBurn = partial.shortWindowBurnRate
  const longBurn = partial.longWindowBurnRate
  const burnAnomaly =
    samplesOrderedOldestFirst.length >= MIN_SAMPLES_FOR_BURN &&
    shortBurn !== null &&
    longBurn !== null &&
    shortBurn >= FAST_BURN_THRESHOLD &&
    longBurn >= SLOW_BURN_THRESHOLD

  const insufficientForBurn =
    samplesOrderedOldestFirst.length < MIN_SAMPLES_FOR_BURN && !streakAnomaly

  if (insufficientForBurn) {
    return {
      status: "insufficient_data",
      minRecentUptime: partial.minRecentUptime,
      recentBucketsChecked: partial.recentBucketsChecked,
      trailingDownStreak: partial.trailingDownStreak,
      shortWindowBurnRate: partial.shortWindowBurnRate,
      longWindowBurnRate: partial.longWindowBurnRate,
      sloAvailability: SLO_AVAILABILITY,
      reason: `Need at least ${MIN_SAMPLES_FOR_BURN} checks in the range to score error budget burn`,
    }
  }

  const anomaly = burnAnomaly || streakAnomaly

  const sloPct = Math.round(SLO_AVAILABILITY * 1000) / 10
  let reason = "Uptime within expected range for error budget and trailing checks"
  if (burnAnomaly && streakAnomaly) {
    reason = `Error budget burn is high on recent checks (~${shortBurn}x) and elevated over the full window (~${longBurn}x) vs ${sloPct}% availability, and ${streak} consecutive failures`
  } else if (burnAnomaly) {
    reason = `Error budget burn is high on recent checks (~${shortBurn}x) and elevated over the full window (~${longBurn}x) vs ${sloPct}% availability`
  } else if (streakAnomaly) {
    reason = `${streak} consecutive failed checks at end of range`
  }

  return {
    status: anomaly ? "anomaly" : "normal",
    minRecentUptime: partial.minRecentUptime,
    recentBucketsChecked: partial.recentBucketsChecked,
    trailingDownStreak: partial.trailingDownStreak,
    shortWindowBurnRate: partial.shortWindowBurnRate,
    longWindowBurnRate: partial.longWindowBurnRate,
    sloAvailability: SLO_AVAILABILITY,
    reason,
  }
}

export const detectDashboardAnomalies = (
  buckets: AnomalyBucketPoint[],
  samplesOrderedOldestFirst: Array<{ status: MonitorCheckStatus }>
): DashboardAnomalyPayload => ({
  latency: detectLatencyAnomaly(buckets),
  uptime: detectUptimeAnomaly(buckets, samplesOrderedOldestFirst),
})
