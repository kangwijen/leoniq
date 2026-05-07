import { Activity, Gauge, ShieldCheck, TimerReset } from "lucide-react"

type Monitor = {
  active: boolean
  lastStatus: "up" | "down" | null
}

type DashboardKpisProps = {
  monitors: Monitor[]
}

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
      helper: "Configured monitors in this workspace",
      icon: <Activity className="size-4 text-emerald-300" />,
      tone: "border-emerald-500/30 bg-emerald-500/10",
    },
    {
      title: "Active monitors",
      value: String(active),
      helper: "Monitors currently scheduled",
      icon: <ShieldCheck className="size-4 text-cyan-300" />,
      tone: "border-cyan-500/30 bg-cyan-500/10",
    },
    {
      title: "Monitors down",
      value: String(down),
      helper: "Active monitors currently failing",
      icon: <TimerReset className="size-4 text-red-300" />,
      tone: "border-red-500/30 bg-red-500/10",
    },
    {
      title: "Fleet uptime",
      value: `${uptime}%`,
      helper: "Computed from latest active checks",
      icon: <Gauge className="size-4 text-sky-300" />,
      tone: "border-sky-500/30 bg-sky-500/10",
    },
  ]

  return (
    <section className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
      {cards.map(card => (
        <article
          key={card.title}
          className={`rounded-2xl border p-4 shadow-[0_0_0_1px_rgba(24,24,27,0.8)] transition-colors duration-200 hover:border-zinc-600 sm:p-5 ${card.tone}`}
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-zinc-200">{card.title}</p>
            {card.icon}
          </div>
          <p className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">{card.value}</p>
          <p className="mt-1 text-xs text-zinc-300">{card.helper}</p>
        </article>
      ))}
    </section>
  )
}
