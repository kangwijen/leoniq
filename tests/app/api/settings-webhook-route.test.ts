/** @jest-environment node */
jest.mock("@/lib/session", () => ({
  requireSession: jest.fn(),
}))

jest.mock("@/lib/user/repository", () => ({
  userRepository: {
    getById: jest.fn(),
    updateWebhookUrl: jest.fn(),
  },
}))

import { GET, PATCH } from "@/app/api/settings/webhook/route"
import { requireSession } from "@/lib/session"
import { userRepository } from "@/lib/user/repository"

const mockedRequireSession = requireSession as jest.MockedFunction<typeof requireSession>
const mockedGetById = userRepository.getById as jest.MockedFunction<typeof userRepository.getById>
const mockedUpdate = userRepository.updateWebhookUrl as jest.MockedFunction<
  typeof userRepository.updateWebhookUrl
>

describe("app/api/settings/webhook/route", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedRequireSession.mockResolvedValue({
      user: { id: "user-1", email: "u@example.com", emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
      session: { id: "s1", userId: "user-1", expiresAt: new Date(), token: "t" },
    } as never)
  })

  it("GET returns webhook url", async () => {
    mockedGetById.mockResolvedValue({ id: "user-1", webhookUrl: "https://hooks.example.com/x" } as never)
    const res = await GET()
    expect(await res.json()).toEqual({
      data: { webhookUrl: "https://hooks.example.com/x" },
    })
  })

  it("GET defaults webhook when missing", async () => {
    mockedGetById.mockResolvedValue({ id: "user-1", webhookUrl: null } as never)
    const res = await GET()
    expect(await res.json()).toEqual({
      data: { webhookUrl: null },
    })
  })

  it("PATCH rejects invalid payload", async () => {
    const req = new Request("http://localhost/api/settings/webhook", {
      method: "PATCH",
      body: "not-json",
    })
    const res = await PATCH(req)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "Invalid payload" })
  })

  it("PATCH rejects malformed webhook URL", async () => {
    const req = new Request("http://localhost/api/settings/webhook", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ webhookUrl: "not a valid url" }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: "Webhook URL is invalid",
    })
  })

  it("PATCH rejects invalid webhook protocol", async () => {
    const req = new Request("http://localhost/api/settings/webhook", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ webhookUrl: "ftp://example.com/hook" }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: "Webhook URL must use http or https",
    })
  })

  it("PATCH clears webhook when webhookUrl is not a string", async () => {
    mockedUpdate.mockResolvedValue({ id: "user-1", webhookUrl: null } as never)
    const req = new Request("http://localhost/api/settings/webhook", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ webhookUrl: 123 }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    expect(mockedUpdate).toHaveBeenCalledWith("user-1", null)
  })

  it("PATCH clears webhook when empty string", async () => {
    mockedUpdate.mockResolvedValue({ id: "user-1", webhookUrl: null } as never)
    const req = new Request("http://localhost/api/settings/webhook", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ webhookUrl: "   " }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    expect(mockedUpdate).toHaveBeenCalledWith("user-1", null)
    expect(await res.json()).toEqual({ data: { webhookUrl: null } })
  })

  it("PATCH updates webhook", async () => {
    mockedUpdate.mockResolvedValue({ id: "user-1", webhookUrl: "https://discord.com/api/webhooks/x" } as never)
    const req = new Request("http://localhost/api/settings/webhook", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ webhookUrl: "https://discord.com/api/webhooks/x" }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      data: { webhookUrl: "https://discord.com/api/webhooks/x" },
    })
  })

  it("PATCH returns 404 when user row missing", async () => {
    const updateMock = mockedUpdate as jest.Mock
    updateMock.mockResolvedValue(null)
    const req = new Request("http://localhost/api/settings/webhook", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ webhookUrl: "https://example.com/hook" }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: "User not found" })
  })
})
