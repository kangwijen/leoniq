/** @jest-environment node */
jest.mock("@/lib/db/client", () => ({
  db: {
    select: jest.fn(),
    update: jest.fn(),
  },
}))

import { db } from "@/lib/db/client"
import { userRepository } from "@/lib/user/repository"

const mockedDb = db as unknown as {
  select: jest.Mock
  update: jest.Mock
}

describe("userRepository", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns user by id", async () => {
    const row = { id: "u1", webhookUrl: "https://example.com/hook" }
    mockedDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([row]),
        }),
      }),
    })

    const found = await userRepository.getById("u1")
    expect(found).toEqual(row)
  })

  it("returns null when user missing", async () => {
    mockedDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([]),
        }),
      }),
    })

    const found = await userRepository.getById("missing")
    expect(found).toBeNull()
  })

  it("updates webhook url", async () => {
    const updated = { id: "u1", webhookUrl: null }
    mockedDb.update.mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([updated]),
        }),
      }),
    })

    const row = await userRepository.updateWebhookUrl("u1", null)
    expect(row).toEqual(updated)
  })

  it("returns null when update affects no row", async () => {
    mockedDb.update.mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([]),
        }),
      }),
    })

    const row = await userRepository.updateWebhookUrl("missing", "https://example.com")
    expect(row).toBeNull()
  })
})
