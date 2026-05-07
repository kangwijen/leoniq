type LatencySparklineProps = {
  values: number[]
}

export const LatencySparkline = ({ values }: LatencySparklineProps) => {
  if (values.length === 0) {
    return <span className="text-xs text-zinc-500">No latency data</span>
  }

  const width = 96
  const height = 24
  const maxIndex = Math.max(values.length - 1, 1)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = Math.max(1, max - min)

  const points = values
    .map((value, index) => {
      const x = (index / maxIndex) * (width - 1)
      const normalized = (value - min) / span
      const y = height - 4 - normalized * (height - 8)
      return `${x},${y}`
    })
    .join(" ")

  const fillPoints = `${points} ${width - 1},${height} 0,${height}`
  const latest = values[values.length - 1]
  const label = `Recent latency trend, latest ${Math.round(latest)} milliseconds`

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={label}
      className="overflow-visible"
    >
      <polyline points={fillPoints} fill="rgba(56,189,248,0.18)" stroke="none" />
      <polyline
        points={points}
        fill="none"
        stroke="#38bdf8"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
