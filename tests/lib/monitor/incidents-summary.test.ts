import {
  buildIncidentsForMonitorTimeline,
  summarizeRecentIncidentsFromSamples,
} from "@/lib/monitor/incidents-summary"

describe("summarizeRecentIncidentsFromSamples", () => {
  it("returns empty timeline for empty monitor rows", () => {
    expect(buildIncidentsForMonitorTimeline([], "API")).toEqual([])
  })
  it("returns empty when samples are empty", () => {
    expect(summarizeRecentIncidentsFromSamples([], 5)).toEqual([])
  })

  it("builds closed incidents from down then up transitions", () => {
    const base = new Date("2026-05-01T12:00:00.000Z").getTime()
    const rows = summarizeRecentIncidentsFromSamples(
      [
        {
          monitorId: "m1",
          monitorName: "API",
          checkedAt: new Date(base),
          status: "up",
          errorMessage: null,
        },
        {
          monitorId: "m1",
          monitorName: "API",
          checkedAt: new Date(base + 60000),
          status: "down",
          errorMessage: "timeout",
        },
        {
          monitorId: "m1",
          monitorName: "API",
          checkedAt: new Date(base + 120000),
          status: "up",
          errorMessage: null,
        },
      ],
      10
    )

    expect(rows).toHaveLength(1)
    expect(rows[0].monitorName).toBe("API")
    expect(rows[0].reason).toBe("timeout")
    expect(rows[0].closedAt).toBe(new Date(base + 120000).toISOString())
    expect(rows[0].durationMinutes).toBe(1)
  })

  it("merges multiple monitors and sorts by openedAt descending", () => {
    const t0 = new Date("2026-05-02T10:00:00.000Z")
    const t1 = new Date("2026-05-02T11:00:00.000Z")
    const rows = summarizeRecentIncidentsFromSamples(
      [
        {
          monitorId: "a",
          monitorName: "A",
          checkedAt: t0,
          status: "down",
          errorMessage: "e1",
        },
        {
          monitorId: "b",
          monitorName: "B",
          checkedAt: t1,
          status: "down",
          errorMessage: "e2",
        },
      ],
      10
    )

    expect(rows).toHaveLength(2)
    expect(rows[0].monitorId).toBe("b")
    expect(rows[1].monitorId).toBe("a")
  })

  it("respects limit", () => {
    const t = new Date("2026-05-03T08:00:00.000Z")
    const rows = summarizeRecentIncidentsFromSamples(
      [
        {
          monitorId: "x",
          monitorName: "X",
          checkedAt: t,
          status: "down",
          errorMessage: null,
        },
        {
          monitorId: "y",
          monitorName: "Y",
          checkedAt: new Date(t.getTime() + 3600000),
          status: "down",
          errorMessage: null,
        },
      ],
      1
    )

    expect(rows).toHaveLength(1)
  })
})
