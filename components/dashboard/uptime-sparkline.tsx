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

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label="Recent uptime trend"
      className="overflow-visible"
    >
      <polyline
        points={fillPoints}
        fill="rgba(34,197,94,0.18)"
        stroke="none"
      />
      <polyline
        points={points}
        fill="none"
        stroke="#22c55e"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
