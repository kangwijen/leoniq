import { NextResponse } from "next/server"
import { monitorRepository } from "@/lib/monitor/repository"
import { requireSession } from "@/lib/session"
import {
  validateHttpUrl,
  validateMonitorTiming,
  validateTcpTarget,
} from "@/lib/monitor/validation"

const parseBody = async (request: Request) => {
  try {
    return await request.json()
  } catch {
    return null
  }
}

export async function GET() {
  const session = await requireSession()
  const items = await monitorRepository.list({ userId: session.user.id })

  return NextResponse.json({ data: items })
}

export async function POST(request: Request) {
  const session = await requireSession()
  const body = await parseBody(request)

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const name = typeof body.name === "string" ? body.name.trim() : ""
  const type = body.type === "tcp" ? "tcp" : body.type === "http" ? "http" : null
  const url = typeof body.url === "string" ? body.url.trim() : ""
  const host = typeof body.host === "string" ? body.host.trim() : ""
  const port = Number(body.port)
  const intervalSeconds = Number(body.intervalSeconds)
  const timeoutMs = Number(body.timeoutMs)
  const retries = Number(body.retries ?? 1)

  if (!name || !type) {
    return NextResponse.json(
      { error: "name and type are required" },
      { status: 400 }
    )
  }

  const timing = validateMonitorTiming(intervalSeconds, timeoutMs)

  if (!timing.ok) {
    return NextResponse.json({ error: timing.error }, { status: 400 })
  }

  if (type === "http") {
    const urlValidation = validateHttpUrl(url)

    if (!urlValidation.ok) {
      return NextResponse.json({ error: urlValidation.error }, { status: 400 })
    }
  }

  if (type === "tcp") {
    const tcpValidation = validateTcpTarget(host, port)

    if (!tcpValidation.ok) {
      return NextResponse.json({ error: tcpValidation.error }, { status: 400 })
    }
  }

  const monitor = await monitorRepository.create({
    userId: session.user.id,
    name,
    type,
    url: type === "http" ? url : null,
    host: type === "tcp" ? host : null,
    port: type === "tcp" ? port : null,
    method: typeof body.method === "string" ? body.method : "GET",
    expectedStatusMin: Number(body.expectedStatusMin ?? 200),
    expectedStatusMax: Number(body.expectedStatusMax ?? 399),
    intervalSeconds,
    timeoutMs,
    retries: Number.isInteger(retries) ? retries : 1,
  })

  return NextResponse.json({ data: monitor }, { status: 201 })
}
