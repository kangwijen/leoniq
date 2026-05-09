import {
  countTrailingDownStreak,
  detectDashboardAnomalies,
  detectLatencyAnomaly,
  detectUptimeAnomaly,
  errorBudgetBurnRate,
  median,
  minUptimeFromRecentBuckets,
  shortWindowSampleCount,
  type AnomalyBucketPoint,
} from "@/lib/monitor/anomaly-detection"

describe("median", () => {
  it("returns zero for an empty list", () => {
    expect(median([])).toBe(0)
  })

  it("averages the middle pair for even-length lists", () => {
    expect(median([10, 20])).toBe(15)
  })

  it("returns the middle value for odd-length lists", () => {
    expect(median([10, 20, 30])).toBe(20)
  })
})

describe("countTrailingDownStreak", () => {
  it("returns zero when there are no trailing downs", () => {
    expect(countTrailingDownStreak([{ status: "down" }, { status: "up" }])).toBe(0)
  })

  it("counts consecutive downs from the latest sample", () => {
    expect(
      countTrailingDownStreak([
        { status: "up" },
        { status: "down" },
        { status: "down" },
        { status: "down" },
      ])
    ).toBe(3)
  })
})

describe("detectLatencyAnomaly", () => {
  it("returns insufficient_data when fewer than four buckets have checks", () => {
    const buckets: AnomalyBucketPoint[] = [
      { p95: 10, uptimePercent: 100, checks: 1 },
      { p95: 12, uptimePercent: 100, checks: 1 },
      { p95: 11, uptimePercent: 100, checks: 1 },
    ]
    const result = detectLatencyAnomaly(buckets)
    expect(result.status).toBe("insufficient_data")
    expect(result.reason).toContain("Not enough buckets")
  })

  it("returns normal when the latest bucket matches baseline variation", () => {
    const buckets: AnomalyBucketPoint[] = [
      { p95: 100, uptimePercent: 100, checks: 2 },
      { p95: 102, uptimePercent: 100, checks: 2 },
      { p95: 101, uptimePercent: 100, checks: 2 },
      { p95: 103, uptimePercent: 100, checks: 2 },
    ]
    const result = detectLatencyAnomaly(buckets)
    expect(result.status).toBe("normal")
    expect(result.deltaPercent).not.toBeNull()
  })

  it("flags ratio spike when latest p95 rises above baseline median threshold", () => {
    const buckets: AnomalyBucketPoint[] = [
      { p95: 100, uptimePercent: 100, checks: 3 },
      { p95: 100, uptimePercent: 100, checks: 3 },
      { p95: 100, uptimePercent: 100, checks: 3 },
      { p95: 200, uptimePercent: 100, checks: 3 },
    ]
    const result = detectLatencyAnomaly(buckets)
    expect(result.status).toBe("anomaly")
    expect(result.reason).toContain("Latest bucket p95")
  })

  it("flags cold-start spike when baseline median is near zero", () => {
    const buckets: AnomalyBucketPoint[] = [
      { p95: 0, uptimePercent: 100, checks: 1 },
      { p95: 0, uptimePercent: 100, checks: 1 },
      { p95: 0, uptimePercent: 100, checks: 1 },
      { p95: 150, uptimePercent: 100, checks: 2 },
    ]
    const result = detectLatencyAnomaly(buckets)
    expect(result.status).toBe("anomaly")
  })

  it("returns a null modified Z when MAD is zero", () => {
    const buckets: AnomalyBucketPoint[] = [
      { p95: 100, uptimePercent: 100, checks: 2 },
      { p95: 100, uptimePercent: 100, checks: 2 },
      { p95: 100, uptimePercent: 100, checks: 2 },
      { p95: 100, uptimePercent: 100, checks: 2 },
    ]
    const result = detectLatencyAnomaly(buckets)
    expect(result.status).toBe("normal")
    expect(result.modifiedZ).toBeNull()
  })

  it("ignores buckets with zero checks when forming the baseline", () => {
    const buckets: AnomalyBucketPoint[] = [
      { p95: 999, uptimePercent: 0, checks: 0 },
      { p95: 100, uptimePercent: 100, checks: 2 },
      { p95: 100, uptimePercent: 100, checks: 2 },
      { p95: 100, uptimePercent: 100, checks: 2 },
      { p95: 220, uptimePercent: 100, checks: 2 },
    ]
    const result = detectLatencyAnomaly(buckets)
    expect(result.status).toBe("anomaly")
  })
})

describe("errorBudgetBurnRate", () => {
  it("returns null for an empty sample list", () => {
    expect(errorBudgetBurnRate([])).toBeNull()
  })

  it("scales observed failure rate against the SLO allowance", () => {
    const samples = Array.from({ length: 100 }, (_, index) => ({
      status: index < 10 ? ("down" as const) : ("up" as const),
    }))
    expect(errorBudgetBurnRate(samples)).toBeCloseTo(10, 5)
  })
})

describe("shortWindowSampleCount", () => {
  it("returns zero when there are no samples", () => {
    expect(shortWindowSampleCount(0)).toBe(0)
  })

  it("uses at least eight samples when the window is large enough", () => {
    expect(shortWindowSampleCount(50)).toBe(8)
  })

  it("grows the short window with sample count once the fractional slice exceeds eight", () => {
    expect(shortWindowSampleCount(100)).toBe(12)
  })
})

describe("minUptimeFromRecentBuckets", () => {
  it("returns null when there are no buckets with checks", () => {
    expect(minUptimeFromRecentBuckets([], 3)).toBeNull()
  })

  it("returns the minimum uptime among the trailing window", () => {
    const buckets: AnomalyBucketPoint[] = [
      { p95: 0, uptimePercent: 99, checks: 1 },
      { p95: 0, uptimePercent: 88, checks: 1 },
      { p95: 0, uptimePercent: 92, checks: 1 },
    ]
    expect(minUptimeFromRecentBuckets(buckets, 3)).toBe(88)
  })
})

describe("detectUptimeAnomaly", () => {
  const neutralSamples = [{ status: "up" as const }, { status: "up" as const }]

  it("returns insufficient_data when fewer than two buckets have checks", () => {
    const buckets: AnomalyBucketPoint[] = [{ p95: 10, uptimePercent: 100, checks: 1 }]
    const result = detectUptimeAnomaly(buckets, neutralSamples)
    expect(result.status).toBe("insufficient_data")
    expect(result.shortWindowBurnRate).toBeNull()
  })

  it("flags multi-window error budget burn when recent and full-window failure rates are high", () => {
    const buckets: AnomalyBucketPoint[] = [
      { p95: 50, uptimePercent: 100, checks: 20 },
      { p95: 50, uptimePercent: 90, checks: 20 },
      { p95: 50, uptimePercent: 88, checks: 20 },
    ]
    const ups = Array.from({ length: 42 }, () => ({ status: "up" as const }))
    const mids = Array.from({ length: 5 }, () => ({ status: "down" as const }))
    const tail = Array.from({ length: 3 }, () => ({ status: "up" as const }))
    const samples = [...ups, ...mids, ...tail]
    const result = detectUptimeAnomaly(buckets, samples)
    expect(result.status).toBe("anomaly")
    expect(result.reason).toContain("Error budget burn")
    expect(result.reason).toContain("99%")
    expect(result.shortWindowBurnRate).not.toBeNull()
    expect(result.longWindowBurnRate).not.toBeNull()
    expect(result.reason).not.toContain("consecutive failures")
  })

  it("notes both burn and streak when the tail is failing and the window shows sustained burn", () => {
    const buckets: AnomalyBucketPoint[] = [
      { p95: 40, uptimePercent: 100, checks: 20 },
      { p95: 40, uptimePercent: 70, checks: 20 },
      { p95: 40, uptimePercent: 65, checks: 20 },
    ]
    const samples = [
      ...Array.from({ length: 42 }, () => ({ status: "up" as const })),
      ...Array.from({ length: 8 }, () => ({ status: "down" as const })),
    ]
    const result = detectUptimeAnomaly(buckets, samples)
    expect(result.status).toBe("anomaly")
    expect(result.trailingDownStreak).toBe(8)
    expect(result.reason).toContain("Error budget burn")
    expect(result.reason).toContain("consecutive failures")
  })

  it("flags trailing down streak at threshold", () => {
    const buckets: AnomalyBucketPoint[] = [
      { p95: 40, uptimePercent: 60, checks: 4 },
      { p95: 40, uptimePercent: 70, checks: 4 },
      { p95: 40, uptimePercent: 75, checks: 4 },
    ]
    const streakSamples = [
      { status: "up" as const },
      { status: "down" as const },
      { status: "down" as const },
      { status: "down" as const },
    ]
    const result = detectUptimeAnomaly(buckets, streakSamples)
    expect(result.status).toBe("anomaly")
    expect(result.trailingDownStreak).toBe(3)
    expect(result.reason).toContain("consecutive")
  })

  it("flags streak-only bursts when uptime buckets stay high but checks fail at end", () => {
    const buckets: AnomalyBucketPoint[] = [
      { p95: 40, uptimePercent: 99, checks: 10 },
      { p95: 40, uptimePercent: 99, checks: 10 },
      { p95: 40, uptimePercent: 99, checks: 10 },
    ]
    const streakSamples = [{ status: "down" as const }, { status: "down" as const }, { status: "down" as const }]
    const result = detectUptimeAnomaly(buckets, streakSamples)
    expect(result.status).toBe("anomaly")
    expect(result.reason).toContain("consecutive failed checks")
  })

  it("returns insufficient_data when there are not enough samples for burn and no streak", () => {
    const buckets: AnomalyBucketPoint[] = [
      { p95: 30, uptimePercent: 99, checks: 10 },
      { p95: 31, uptimePercent: 98, checks: 10 },
      { p95: 32, uptimePercent: 99, checks: 10 },
    ]
    const result = detectUptimeAnomaly(buckets, [{ status: "up" }, { status: "down" }])
    expect(result.status).toBe("insufficient_data")
    expect(result.reason).toContain("at least 10 checks")
  })

  it("returns normal when burn and streak stay within bounds", () => {
    const buckets: AnomalyBucketPoint[] = [
      { p95: 30, uptimePercent: 99, checks: 10 },
      { p95: 31, uptimePercent: 98, checks: 10 },
      { p95: 32, uptimePercent: 99, checks: 10 },
    ]
    const samples = Array.from({ length: 40 }, (_, index) => ({
      status: index === 20 ? ("down" as const) : ("up" as const),
    }))
    const result = detectUptimeAnomaly(buckets, samples)
    expect(result.status).toBe("normal")
    expect(result.reason).toBe("Uptime within expected range for error budget and trailing checks")
  })
})

describe("detectDashboardAnomalies", () => {
  it("combines latency and uptime signals", () => {
    const buckets: AnomalyBucketPoint[] = [
      { p95: 90, uptimePercent: 100, checks: 2 },
      { p95: 91, uptimePercent: 100, checks: 2 },
      { p95: 92, uptimePercent: 100, checks: 2 },
      { p95: 200, uptimePercent: 100, checks: 2 },
    ]
    const payload = detectDashboardAnomalies(
      buckets,
      Array.from({ length: 12 }, () => ({ status: "up" as const }))
    )
    expect(payload.latency.status).toBe("anomaly")
    expect(payload.uptime.status).toBe("normal")
  })
})
