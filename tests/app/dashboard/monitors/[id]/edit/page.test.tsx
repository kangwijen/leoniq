import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import EditMonitorPage from "@/app/dashboard/monitors/[id]/edit/page"
import { requireSession } from "@/lib/session"
import { monitorRepository } from "@/lib/monitor/repository"
import { notFound } from "next/navigation"

jest.mock("next/link", () => {
  return {
    __esModule: true,
    default: ({ href, children }: { href: string; children: ReactNode }) => (
      <a href={href}>{children}</a>
    ),
  }
})

jest.mock("next/navigation", () => ({
  notFound: jest.fn(() => {
    throw new Error("not-found")
  }),
}))

jest.mock("@/components/ui/button", () => ({
  Button: ({ children }: { children: ReactNode; asChild?: boolean }) => <>{children}</>,
}))

jest.mock("@/components/dashboard/monitor-edit-form", () => ({
  MonitorEditForm: () => <div data-testid="monitor-edit-form" />,
}))

jest.mock("@/lib/session", () => ({
  requireSession: jest.fn(),
}))

jest.mock("@/lib/monitor/repository", () => ({
  monitorRepository: {
    getById: jest.fn(),
  },
}))

const mockRequireSession = requireSession as jest.MockedFunction<typeof requireSession>
const mockGetById = monitorRepository.getById as jest.MockedFunction<typeof monitorRepository.getById>

const monitorRow = {
  id: "mon-1",
  userId: "user-1",
  name: "API",
  type: "http" as const,
  url: "https://api.example.com",
  host: null,
  port: null,
  method: "GET",
  expectedStatusMin: 200,
  expectedStatusMax: 399,
  intervalSeconds: 60,
  timeoutMs: 5000,
  retries: 1,
  tags: ["prod"],
  active: true,
  createdAt: new Date("2026-05-01T00:00:00.000Z"),
  updatedAt: new Date("2026-05-02T00:00:00.000Z"),
  lastStatus: "up" as const,
  lastLatencyMs: 50,
  lastCheckedAt: new Date("2026-05-07T12:00:00.000Z"),
}

describe("EditMonitorPage", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("calls notFound when monitor is missing", async () => {
    mockRequireSession.mockResolvedValue({
      user: { id: "user-1" },
    } as Awaited<ReturnType<typeof requireSession>>)
    const getByIdMock = mockGetById as jest.Mock
    getByIdMock.mockResolvedValue(null)

    await expect(
      EditMonitorPage({ params: Promise.resolve({ id: "missing" }) })
    ).rejects.toThrow("not-found")

    expect(notFound).toHaveBeenCalledTimes(1)
  })

  it("renders edit form when monitor exists", async () => {
    mockRequireSession.mockResolvedValue({
      user: { id: "user-1" },
    } as Awaited<ReturnType<typeof requireSession>>)
    mockGetById.mockResolvedValue(monitorRow)

    render(await EditMonitorPage({ params: Promise.resolve({ id: "mon-1" }) }))

    expect(screen.getByRole("heading", { name: "Edit Monitor" })).toBeInTheDocument()
    expect(screen.getByTestId("monitor-edit-form")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Back to monitor" })).toHaveAttribute(
      "href",
      "/dashboard/monitors/mon-1"
    )
  })

  it("passes empty tags when monitor tags are null", async () => {
    mockRequireSession.mockResolvedValue({
      user: { id: "user-1" },
    } as Awaited<ReturnType<typeof requireSession>>)
    mockGetById.mockResolvedValue({ ...monitorRow, tags: null } as never)

    render(await EditMonitorPage({ params: Promise.resolve({ id: "mon-1" }) }))

    expect(screen.getByTestId("monitor-edit-form")).toBeInTheDocument()
  })
})
