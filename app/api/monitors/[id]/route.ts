import { NextResponse } from "next/server"
import { monitorRepository } from "@/lib/monitor/repository"
import {
  validateHttpUrl,
  validateMonitorTiming,
  validateTcpTarget,
} from "@/lib/monitor/validation"
import { requireSession } from "@/lib/session"

const getMonitorId = async (
  segmentData: {
    params: Promise<{ id: string }>
  }
) => (await segmentData.params).id

export async function GET(
  _request: Request,
  segmentData: {
    params: Promise<{ id: string }>
  }
) {
  const session = await requireSession()
  const id = await getMonitorId(segmentData)
  const monitor = await monitorRepository.getById(id, session.user.id)

  if (!monitor) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({ data: monitor })
}

export async function PATCH(
  request: Request,
  segmentData: {
    params: Promise<{ id: string }>
  }
) {
  const session = await requireSession()
  const id = await getMonitorId(segmentData)
  const body = await request.json()
  const existing = await monitorRepository.getById(id, session.user.id)

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const nextType =
    body.type === "http" || body.type === "tcp" ? body.type : existing.type
  const nextUrl =
    typeof body.url === "string" ? body.url.trim() : (existing.url ?? "")
  const nextHost =
    typeof body.host === "string" ? body.host.trim() : (existing.host ?? "")
  const nextPort =
    typeof body.port === "number"
      ? body.port
      : typeof body.port === "string"
      ? Number(body.port)
      : (existing.port ?? 0)
  const nextIntervalSeconds =
    typeof body.intervalSeconds === "number"
      ? body.intervalSeconds
      : existing.intervalSeconds
  const nextTimeoutMs =
    typeof body.timeoutMs === "number" ? body.timeoutMs : existing.timeoutMs

  const timingValidation = validateMonitorTiming(nextIntervalSeconds, nextTimeoutMs)

  if (!timingValidation.ok) {
    return NextResponse.json({ error: timingValidation.error }, { status: 400 })
  }

  if (nextType === "http") {
    const urlValidation = validateHttpUrl(nextUrl)

    if (!urlValidation.ok) {
      return NextResponse.json({ error: urlValidation.error }, { status: 400 })
    }
  }

  if (nextType === "tcp") {
    const tcpValidation = validateTcpTarget(nextHost, nextPort)

    if (!tcpValidation.ok) {
      return NextResponse.json({ error: tcpValidation.error }, { status: 400 })
    }
  }

  const monitor = await monitorRepository.update(id, session.user.id, {
    name: typeof body.name === "string" ? body.name : undefined,
    type: nextType,
    url: nextType === "http" ? nextUrl : null,
    host: nextType === "tcp" ? nextHost : null,
    port: nextType === "tcp" ? nextPort : null,
    method: typeof body.method === "string" ? body.method : existing.method,
    expectedStatusMin:
      typeof body.expectedStatusMin === "number"
        ? body.expectedStatusMin
        : existing.expectedStatusMin,
    expectedStatusMax:
      typeof body.expectedStatusMax === "number"
        ? body.expectedStatusMax
        : existing.expectedStatusMax,
    active: typeof body.active === "boolean" ? body.active : undefined,
    intervalSeconds: nextIntervalSeconds,
    timeoutMs: nextTimeoutMs,
    retries:
      typeof body.retries === "number" ? body.retries : existing.retries,
  })

  if (!monitor) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({ data: monitor })
}

export async function DELETE(
  _request: Request,
  segmentData: {
    params: Promise<{ id: string }>
  }
) {
  const session = await requireSession()
  const id = await getMonitorId(segmentData)
  const monitor = await monitorRepository.delete(id, session.user.id)

  if (!monitor) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({ data: monitor })
}
