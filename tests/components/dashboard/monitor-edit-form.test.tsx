import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MonitorEditForm } from "@/components/dashboard/monitor-edit-form"

const refreshMock = jest.fn()
const pushMock = jest.fn()
const successMock = jest.fn()
const errorMock = jest.fn()

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: refreshMock,
    push: pushMock,
  }),
}))

jest.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => successMock(...args),
    error: (...args: unknown[]) => errorMock(...args),
  },
}))

jest.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string
    onValueChange: (value: string) => void
    children: React.ReactNode
  }) => (
    <select aria-label="select" value={value} onChange={event => onValueChange(event.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: {
    value: string
    children: React.ReactNode
  }) => (
    <option value={value}>{children}</option>
  ),
}))

const monitor = {
  id: "monitor-99",
  name: "Orders API",
  type: "http" as const,
  url: "https://example.com",
  host: null,
  port: null,
  intervalSeconds: 60,
  timeoutMs: 5000,
  active: true,
}

const pausedTcpMonitor = {
  id: "monitor-100",
  name: "TCP Monitor",
  type: "tcp" as const,
  url: null,
  host: null,
  port: null,
  intervalSeconds: 120,
  timeoutMs: 7000,
  active: false,
}

describe("MonitorEditForm", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn()
  })

  it("submits updated monitor and navigates to details", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
    })

    render(<MonitorEditForm monitor={monitor} />)
    fireEvent.change(screen.getByLabelText("Monitor name"), { target: { value: "Orders API v2" } })
    fireEvent.submit(screen.getByRole("button", { name: "Save changes" }).closest("form") as HTMLFormElement)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/monitors/monitor-99",
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining('"name":"Orders API v2"'),
        })
      )
    })
    expect(successMock).toHaveBeenCalledWith("Monitor updated")
    expect(pushMock).toHaveBeenCalledWith("/dashboard/monitors/monitor-99")
    expect(refreshMock).toHaveBeenCalledTimes(1)
  })

  it("shows network error on request failure", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("offline"))

    render(<MonitorEditForm monitor={monitor} />)
    fireEvent.submit(screen.getByRole("button", { name: "Save changes" }).closest("form") as HTMLFormElement)

    await waitFor(() => {
      expect(errorMock).toHaveBeenCalledWith("Network error while updating monitor")
    })
    expect(pushMock).not.toHaveBeenCalled()
  })

  it("submits tcp payload with paused status", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
    })

    render(<MonitorEditForm monitor={monitor} />)
    const selects = screen.getAllByLabelText("select")
    fireEvent.change(selects[0], { target: { value: "tcp" } })
    fireEvent.change(selects[1], { target: { value: "paused" } })
    fireEvent.change(screen.getByLabelText("Host"), { target: { value: "tcp.example.com" } })
    fireEvent.change(screen.getByLabelText("Port"), { target: { value: "8443" } })
    fireEvent.submit(screen.getByRole("button", { name: "Save changes" }).closest("form") as HTMLFormElement)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })
    const requestBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body as string) as {
      type: string
      active: boolean
      host?: string
      port?: number
      url?: string
    }
    expect(requestBody.type).toBe("tcp")
    expect(requestBody.active).toBe(false)
    expect(requestBody.host).toBe("tcp.example.com")
    expect(requestBody.port).toBe(8443)
    expect(requestBody.url).toBeUndefined()
  })

  it("uses fallback error message for failed update payload", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ message: "   " }),
    })

    render(<MonitorEditForm monitor={monitor} />)
    fireEvent.submit(screen.getByRole("button", { name: "Save changes" }).closest("form") as HTMLFormElement)

    await waitFor(() => {
      expect(errorMock).toHaveBeenCalledWith("Failed to update monitor")
    })
    expect(pushMock).not.toHaveBeenCalled()
  })

  it("uses payload.error value for failed update response", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Interval is invalid" }),
    })

    render(<MonitorEditForm monitor={monitor} />)
    fireEvent.submit(screen.getByRole("button", { name: "Save changes" }).closest("form") as HTMLFormElement)

    await waitFor(() => {
      expect(errorMock).toHaveBeenCalledWith("Interval is invalid")
    })
  })

  it("uses payload.message value for failed update response", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ message: "Target mismatch" }),
    })

    render(<MonitorEditForm monitor={monitor} />)
    fireEvent.submit(screen.getByRole("button", { name: "Save changes" }).closest("form") as HTMLFormElement)

    await waitFor(() => {
      expect(errorMock).toHaveBeenCalledWith("Target mismatch")
    })
  })

  it("uses fallback update message when response json parsing fails", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => {
        throw new Error("bad json")
      },
    })

    render(<MonitorEditForm monitor={monitor} />)
    fireEvent.submit(screen.getByRole("button", { name: "Save changes" }).closest("form") as HTMLFormElement)

    await waitFor(() => {
      expect(errorMock).toHaveBeenCalledWith("Failed to update monitor")
    })
  })

  it("updates interval and timeout fields before submit", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
    })

    render(<MonitorEditForm monitor={monitor} />)
    fireEvent.change(screen.getByLabelText("Interval seconds"), { target: { value: "90" } })
    fireEvent.change(screen.getByLabelText("Timeout ms"), { target: { value: "6000" } })
    fireEvent.change(screen.getByLabelText("Tags"), { target: { value: "prod, backend" } })
    fireEvent.submit(screen.getByRole("button", { name: "Save changes" }).closest("form") as HTMLFormElement)

    await waitFor(() => {
      expect(successMock).toHaveBeenCalledWith("Monitor updated")
    })
  })

  it("updates url field in http mode", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
    })

    render(<MonitorEditForm monitor={monitor} />)
    fireEvent.change(screen.getByLabelText("URL to check"), { target: { value: "https://new.example.com" } })
    fireEvent.submit(screen.getByRole("button", { name: "Save changes" }).closest("form") as HTMLFormElement)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })
    const requestBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body as string) as {
      url?: string
    }
    expect(requestBody.url).toBe("https://new.example.com")
  })

  it("uses defaults for nullable tcp monitor fields", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
    })

    render(<MonitorEditForm monitor={pausedTcpMonitor} />)
    fireEvent.change(screen.getByLabelText("Host"), { target: { value: "tcp.edge.example.com" } })
    fireEvent.change(screen.getByLabelText("Port"), { target: { value: "9443" } })
    fireEvent.submit(screen.getByRole("button", { name: "Save changes" }).closest("form") as HTMLFormElement)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })
    const requestBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body as string) as {
      active: boolean
      host?: string
      port?: number
    }
    expect(requestBody.active).toBe(false)
    expect(requestBody.host).toBe("tcp.edge.example.com")
    expect(requestBody.port).toBe(9443)
  })
})
