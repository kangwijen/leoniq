export type AlertSeverity = "info" | "warning" | "critical"

export type SeverityPolicy = {
  cooldownMs: number
  enabled: boolean
}

export type SeverityPolicies = Record<AlertSeverity, SeverityPolicy>

export type AlertCandidate = {
  monitorId: string
  errorMessage: string | null
  downStreak: number
  severity: AlertSeverity
}

export type AlertAttemptRecord = {
  createdAt: Date
  dedupKey: string | null
}

export const DEFAULT_SEVERITY_POLICIES: SeverityPolicies = {
  info: {
    cooldownMs: 30 * 60 * 1000,
    enabled: true,
  },
  warning: {
    cooldownMs: 15 * 60 * 1000,
    enabled: true,
  },
  critical: {
    cooldownMs: 5 * 60 * 1000,
    enabled: true,
  },
}

const normalizeError = (value: string | null) =>
  (value ?? "unknown")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "<url>")
    .replace(/\d+/g, "#")
    .replace(/\s+/g, " ")
    .trim()

export const severityFromDownStreak = (downStreak: number): AlertSeverity => {
  if (downStreak >= 3) {
    return "critical"
  }
  if (downStreak >= 2) {
    return "warning"
  }
  return "info"
}

export const dedupKeyForAlert = (candidate: AlertCandidate) =>
  `${candidate.monitorId}:${candidate.severity}:${normalizeError(candidate.errorMessage)}`

export const shouldSuppressForCooldown = (
  candidate: AlertCandidate,
  attempts: AlertAttemptRecord[],
  now: Date,
  policies: SeverityPolicies
) => {
  const policy = policies[candidate.severity]
  if (!policy.enabled) {
    return true
  }

  const dedupKey = dedupKeyForAlert(candidate)
  const cutoff = now.getTime() - policy.cooldownMs
  const existing = attempts.find(item => item.dedupKey === dedupKey && item.createdAt.getTime() >= cutoff)
  return Boolean(existing)
}
