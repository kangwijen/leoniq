import { Activity, Gauge, ShieldCheck, TimerReset } from "lucide-react"

type Monitor = {
  active: boolean
  lastStatus: "up" | "down" | null
}

type DashboardKpisProps = {
  monitors: Monitor[]
}

const iconClass = "size-4 text-emerald-300"

export const DashboardKpis = ({ monitors }: DashboardKpisProps) => {
  const total = monitors.length
  const active = monitors.filter(item => item.active).length
  const down = monitors.filter(item => item.active && item.lastStatus === "down").length
  const up = monitors.filter(item => item.active && item.lastStatus === "up").length
  const uptime = active > 0 ? Math.round((up / active) * 10000) / 100 : 0

  const cards = [
    {
      title: "Total monitors",
      value: String(total),
      helper: "All configured checks",
      icon: <Activity className={iconClass} />,
    },
    {
      title: "Active monitors",
      value: String(active),
      helper: "Currently running checks",
      icon: <ShieldCheck className={iconClass} />,
    },
    {
      title: "Issues detected",
      value: String(down),
      helper: "Active monitors currently down",
      icon: <TimerReset className={iconClass} />,
    },
    {
      title: "Current uptime",
      value: `${uptime}%`,
      helper: "Based on latest active status",
      icon: <Gauge className={iconClass} />,
    },
  ]

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(card => (
        <article
          key={card.title}
          className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 shadow-[0_0_0_1px_rgba(24,24,27,0.8)] transition-colors duration-200 hover:border-zinc-700 sm:p-5"
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-zinc-400">{card.title}</p>
            {card.icon}
          </div>
          <p className="text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">{card.value}</p>
          <p className="mt-1 text-xs text-zinc-500">{card.helper}</p>
        </article>
      ))}
    </section>
  )
}
