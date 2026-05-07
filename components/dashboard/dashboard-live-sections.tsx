"use client"

import { useEffect, useState } from "react"
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

  const filteredMonitors = monitors.filter(item => {
    const typeMatch = typeFilter === "all" || item.type === typeFilter
    const tagMatch = tagFilter === "all" || (item.tags ?? []).includes(tagFilter)
    return typeMatch && tagMatch
  })

  const visibleMonitorIds = new Set(filteredMonitors.map(item => item.id))
  const filteredSamples = samples.filter(item => visibleMonitorIds.has(item.monitorId))
  const hasActiveFilters = typeFilter !== "all" || tagFilter !== "all"
  const totalMonitors = monitors.length
  const normalizedTagFilter = tagFilter === "all" || availableTags.includes(tagFilter) ? tagFilter : "all"

  useEffect(() => {
    if (tagFilter !== normalizedTagFilter) {
      setTagFilter(normalizedTagFilter)
    }
  }, [normalizedTagFilter, tagFilter])

  useEffect(() => {
    const queryTypeValue = searchParams.get("type")
    const queryTagValue = searchParams.get("tag")
    const nextType: "all" | "http" | "tcp" =
      queryTypeValue === "http" || queryTypeValue === "tcp" ? queryTypeValue : "all"
    const nextTag = queryTagValue && queryTagValue.trim().length > 0 ? queryTagValue.trim() : "all"

    if (typeFilter !== nextType) {
      setTypeFilter(nextType)
    }
    if (tagFilter !== nextTag) {
      setTagFilter(nextTag)
    }
  }, [searchParams, tagFilter, typeFilter])

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    if (typeFilter === "all") {
      params.delete("type")
    } else {
      params.set("type", typeFilter)
    }
    if (tagFilter === "all") {
      params.delete("tag")
    } else {
      params.set("tag", tagFilter)
    }

    const current = searchParams.toString()
    const next = params.toString()
    if (next === current) {
      return
    }

    router.replace(next.length > 0 ? `${pathname}?${next}` : pathname, { scroll: false })
  }, [pathname, router, searchParams, tagFilter, typeFilter])

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
            <Select value={typeFilter} onValueChange={value => setTypeFilter(value as "all" | "http" | "tcp")}>
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
            <Select value={tagFilter} onValueChange={setTagFilter}>
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
