import {
  DEFAULT_SEVERITY_POLICIES,
  dedupKeyForAlert,
  severityFromDownStreak,
  shouldSuppressForCooldown,
  type AlertCandidate,
} from "@/lib/alerts/notification-policy"

describe("notification policy", () => {
  it("classifies severity from down streak", () => {
    expect(severityFromDownStreak(1)).toBe("info")
    expect(severityFromDownStreak(2)).toBe("warning")
    expect(severityFromDownStreak(3)).toBe("critical")
    expect(severityFromDownStreak(10)).toBe("critical")
  })

  it("normalizes dedup key for error variants", () => {
    const base: AlertCandidate = {
      monitorId: "monitor-1",
      errorMessage: "Timeout after 5000 ms at https://api.example.com",
      downStreak: 2,
      severity: "warning",
    }
    const variant: AlertCandidate = {
      ...base,
      errorMessage: "Timeout after 10000 ms at https://api.example.com/health",
    }

    expect(dedupKeyForAlert(base)).toBe(dedupKeyForAlert(variant))
  })

  it("uses unknown placeholder when error message is null", () => {
    const candidate: AlertCandidate = {
      monitorId: "monitor-null-error",
      errorMessage: null,
      downStreak: 1,
      severity: "info",
    }

    expect(dedupKeyForAlert(candidate)).toContain(":info:unknown")
  })

  it("suppresses only inside cooldown window", () => {
    const now = new Date("2026-05-07T10:00:00.000Z")
    const candidate: AlertCandidate = {
      monitorId: "monitor-1",
      errorMessage: "socket timeout",
      downStreak: 3,
      severity: "critical",
    }
    const key = dedupKeyForAlert(candidate)

    expect(
      shouldSuppressForCooldown(
        candidate,
        [{ createdAt: new Date("2026-05-07T09:58:00.000Z"), dedupKey: key }],
        now,
        DEFAULT_SEVERITY_POLICIES
      )
    ).toBe(true)

    expect(
      shouldSuppressForCooldown(
        candidate,
        [{ createdAt: new Date("2026-05-07T09:40:00.000Z"), dedupKey: key }],
        now,
        DEFAULT_SEVERITY_POLICIES
      )
    ).toBe(false)
  })

  it("suppresses when severity policy is disabled", () => {
    const now = new Date("2026-05-07T10:00:00.000Z")
    const candidate: AlertCandidate = {
      monitorId: "monitor-1",
      errorMessage: "socket timeout",
      downStreak: 1,
      severity: "info",
    }

    expect(
      shouldSuppressForCooldown(candidate, [], now, {
        ...DEFAULT_SEVERITY_POLICIES,
        info: {
          ...DEFAULT_SEVERITY_POLICIES.info,
          enabled: false,
        },
      })
    ).toBe(true)
  })
})
