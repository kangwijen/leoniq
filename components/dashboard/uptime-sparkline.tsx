type UptimeSparklineProps = {
  values: number[]
}

export const UptimeSparkline = ({ values }: UptimeSparklineProps) => {
  if (values.length === 0) {
    return <span className="text-xs text-zinc-500">No data</span>
  }

  const width = 96
  const height = 24
  const maxIndex = Math.max(values.length - 1, 1)

  const points = values
    .map((value, index) => {
      const x = (index / maxIndex) * (width - 1)
      const y = value === 1 ? 4 : height - 4
      return `${x},${y}`
    })
    .join(" ")

  const fillPoints = `${points} ${width - 1},${height} 0,${height}`
  const last = values[values.length - 1]
  const strokeColor = last === 1 ? "#22c55e" : "#ef4444"
  const fillColor = last === 1 ? "rgba(34,197,94,0.18)" : "rgba(239,68,68,0.18)"
  const label = `Recent uptime trend, latest state ${last === 1 ? "up" : "down"}`

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={label}
      className="overflow-visible"
    >
      <polyline
        points={fillPoints}
        fill={fillColor}
        stroke="none"
      />
      <polyline
        points={points}
        fill="none"
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
