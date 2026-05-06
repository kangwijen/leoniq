import { NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { userRepository } from "@/lib/user/repository"

const parseBody = async (request: Request) => {
  try {
    return await request.json()
  } catch {
    return null
  }
}

const validateWebhookUrl = (value: string) => {
  try {
    const parsed = new URL(value)
    const isHttp = parsed.protocol === "http:" || parsed.protocol === "https:"
    if (!isHttp) {
      return { ok: false as const, error: "Webhook URL must use http or https" }
    }
    return { ok: true as const }
  } catch {
    return { ok: false as const, error: "Webhook URL is invalid" }
  }
}

export async function GET() {
  const session = await requireSession()
  const row = await userRepository.getById(session.user.id)

  return NextResponse.json({
    data: {
      webhookUrl: row?.webhookUrl ?? null,
    },
  })
}

export async function PATCH(request: Request) {
  const session = await requireSession()
  const body = await parseBody(request)

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const webhookUrlRaw = typeof body.webhookUrl === "string" ? body.webhookUrl.trim() : ""
  const webhookUrl = webhookUrlRaw.length > 0 ? webhookUrlRaw : null

  if (webhookUrl) {
    const validation = validateWebhookUrl(webhookUrl)
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
  }

  const updated = await userRepository.updateWebhookUrl(session.user.id, webhookUrl)

  if (!updated) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  return NextResponse.json({
    data: {
      webhookUrl: updated.webhookUrl ?? null,
    },
  })
}
