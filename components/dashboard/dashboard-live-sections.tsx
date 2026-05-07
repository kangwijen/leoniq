"use client"

import { useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MonitorTable } from "@/components/dashboard/monitor-table"
import { NeonOperationsWall, type RangeOption } from "@/components/dashboard/neon-operations-wall"

type Sample = {
  monitorId: string
  monitorName: string
  monitorType: "http" | "tcp"
  checkedAt: string
  status: "up" | "down"
  latencyMs: number | null
  statusCode: number | null
  errorMessage: string | null
  meta: Record<string, unknown> | null
}

type Monitor = {
  id: string
  name: string
  type: "http" | "tcp"
  active: boolean
  lastStatus: "up" | "down" | null
  intervalSeconds: number
  lastCheckedAt: string | Date | null
  uptimeSeries: number[]
  tags?: string[]
}

type DashboardLiveSectionsProps = {
  samples: Sample[]
  monitors: Monitor[]
}

export const DashboardLiveSections = ({ samples, monitors }: DashboardLiveSectionsProps) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const queryType = searchParams.get("type")
  const queryTag = searchParams.get("tag")
  const initialType: "all" | "http" | "tcp" =
    queryType === "http" || queryType === "tcp" ? queryType : "all"
  const initialTag = queryTag && queryTag.trim().length > 0 ? queryTag.trim() : "all"
  const [range, setRange] = useState<RangeOption>("24h")
  const [typeFilter, setTypeFilter] = useState<"all" | "http" | "tcp">(initialType)
  const [tagFilter, setTagFilter] = useState<string>(initialTag)

  const availableTags = Array.from(
    new Set(
      monitors.flatMap(item => item.tags ?? []).map(item => item.trim()).filter(item => item.length > 0)
    )
  ).sort((a, b) => a.localeCompare(b))

  const effectiveTagFilter = tagFilter === "all" || availableTags.includes(tagFilter) ? tagFilter : "all"

  const filteredMonitors = monitors.filter(item => {
    const typeMatch = typeFilter === "all" || item.type === typeFilter
    const tagMatch = effectiveTagFilter === "all" || (item.tags ?? []).includes(effectiveTagFilter)
    if (!typeMatch) {
      return false
    }
    if (!tagMatch) {
      return false
    }
    return true
  })

  const visibleMonitorIds = new Set(filteredMonitors.map(item => item.id))
  const filteredSamples = samples.filter(item => visibleMonitorIds.has(item.monitorId))
  const hasActiveFilters = typeFilter !== "all" || effectiveTagFilter !== "all"
  const totalMonitors = monitors.length
  const currentQuery = searchParams.toString()

  const updateUrl = useMemo(
    () => (nextType: "all" | "http" | "tcp", nextTag: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (nextType === "all") {
        params.delete("type")
      } else {
        params.set("type", nextType)
      }
      if (nextTag === "all") {
        params.delete("tag")
      } else {
        params.set("tag", nextTag)
      }

      const next = params.toString()
      if (next === currentQuery) {
        return
      }

      router.replace(next.length > 0 ? `${pathname}?${next}` : pathname, { scroll: false })
    },
    [currentQuery, pathname, router, searchParams]
  )

  return (
    <>
      <section className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div>
              <p className="text-xs uppercase tracking-[0.08em] text-zinc-500">Filter Monitors</p>
              <p className="text-sm text-zinc-300">
                Showing {filteredMonitors.length} of {totalMonitors} monitors
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-zinc-700 text-zinc-300">
                Visible {filteredMonitors.length}
              </Badge>
              {tagFilter !== "all" ? (
                <Badge className="bg-cyan-500/20 text-cyan-300">Tag {tagFilter}</Badge>
              ) : null}
              {typeFilter !== "all" ? (
                <Badge className="bg-emerald-500/20 text-emerald-300">Type {typeFilter.toUpperCase()}</Badge>
              ) : null}
            </div>
          </div>
          {hasActiveFilters ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setTypeFilter("all")
                setTagFilter("all")
                updateUrl("all", "all")
              }}
              className="h-11 border-zinc-700 text-zinc-200 hover:bg-zinc-800"
            >
              Reset filters
            </Button>
          ) : null}
        </div>
        <div className="mt-3 grid gap-3 sm:mt-4 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.08em] text-zinc-500">Type</p>
            <Select
              value={typeFilter}
              onValueChange={value => {
                const nextType = value as "all" | "http" | "tcp"
                setTypeFilter(nextType)
                updateUrl(nextType, effectiveTagFilter)
              }}
            >
              <SelectTrigger className="h-11 border-zinc-700 bg-zinc-900 text-zinc-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any type</SelectItem>
                <SelectItem value="http">HTTP</SelectItem>
                <SelectItem value="tcp">TCP</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.08em] text-zinc-500">Tag</p>
            <Select
              value={effectiveTagFilter}
              onValueChange={value => {
                setTagFilter(value)
                updateUrl(typeFilter, value)
              }}
            >
              <SelectTrigger className="h-11 border-zinc-700 bg-zinc-900 text-zinc-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any tag</SelectItem>
                {availableTags.map(tag => (
                  <SelectItem key={tag} value={tag}>
                    {tag}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>
      <NeonOperationsWall samples={filteredSamples} range={range} onRangeChange={setRange} />
      {filteredMonitors.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 text-zinc-300">
          No monitors match the current filters. Try another type or tag.
        </div>
      ) : (
        <MonitorTable monitors={filteredMonitors} range={range} />
      )}
    </>
  )
}
