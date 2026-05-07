import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MonitorForm } from "@/components/dashboard/monitor-form"

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
    <select aria-label="Monitor type" value={value} onChange={event => onValueChange(event.target.value)}>
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

describe("MonitorForm", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn()
  })

  it("submits HTTP monitor and redirects on success", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
    })

    render(<MonitorForm />)

    fireEvent.change(screen.getByLabelText("Monitor name"), { target: { value: "API Health" } })
    fireEvent.change(screen.getByLabelText("URL to check"), { target: { value: "https://example.com/health" } })
    fireEvent.submit(screen.getByRole("button", { name: "Create monitor" }).closest("form") as HTMLFormElement)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/monitors",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"type":"http"'),
        })
      )
    })
    expect(successMock).toHaveBeenCalledWith("Monitor created")
    expect(pushMock).toHaveBeenCalledWith("/dashboard")
    expect(refreshMock).toHaveBeenCalledTimes(1)
  })

  it("shows API error when create fails", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Invalid target" }),
    })

    render(<MonitorForm />)
    fireEvent.change(screen.getByLabelText("Monitor name"), { target: { value: "Broken" } })
    fireEvent.submit(screen.getByRole("button", { name: "Create monitor" }).closest("form") as HTMLFormElement)

    await waitFor(() => {
      expect(errorMock).toHaveBeenCalledWith("Invalid target")
    })
    expect(pushMock).not.toHaveBeenCalled()
  })

  it("submits TCP monitor payload with host and port", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
    })

    render(<MonitorForm />)

    fireEvent.change(screen.getByLabelText("Monitor name"), { target: { value: "Socket probe" } })
    fireEvent.change(screen.getByLabelText("Monitor type"), { target: { value: "tcp" } })
    fireEvent.change(screen.getByLabelText("Host"), { target: { value: "tcp.example.com" } })
    fireEvent.change(screen.getByLabelText("Port"), { target: { value: "9000" } })
    fireEvent.submit(screen.getByRole("button", { name: "Create monitor" }).closest("form") as HTMLFormElement)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/monitors",
        expect.objectContaining({
          body: expect.stringContaining('"type":"tcp"'),
        })
      )
    })
    const requestBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body as string) as {
      host?: string
      port?: number
      url?: string
    }
    expect(requestBody.host).toBe("tcp.example.com")
    expect(requestBody.port).toBe(9000)
    expect(requestBody.url).toBeUndefined()
  })

  it("uses fallback error message when create response has empty payload", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ message: "   " }),
    })

    render(<MonitorForm />)
    fireEvent.change(screen.getByLabelText("Monitor name"), { target: { value: "Broken" } })
    fireEvent.submit(screen.getByRole("button", { name: "Create monitor" }).closest("form") as HTMLFormElement)

    await waitFor(() => {
      expect(errorMock).toHaveBeenCalledWith("Failed to create monitor")
    })
  })

  it("shows network error when create request throws", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("offline"))

    render(<MonitorForm />)
    fireEvent.change(screen.getByLabelText("Monitor name"), { target: { value: "Broken" } })
    fireEvent.submit(screen.getByRole("button", { name: "Create monitor" }).closest("form") as HTMLFormElement)

    await waitFor(() => {
      expect(errorMock).toHaveBeenCalledWith("Network error while creating monitor")
    })
  })

  it("uses payload.error value for failed create response", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Host is blocked" }),
    })

    render(<MonitorForm />)
    fireEvent.change(screen.getByLabelText("Monitor name"), { target: { value: "Blocked" } })
    fireEvent.submit(screen.getByRole("button", { name: "Create monitor" }).closest("form") as HTMLFormElement)

    await waitFor(() => {
      expect(errorMock).toHaveBeenCalledWith("Host is blocked")
    })
  })

  it("uses payload.message value for failed create response", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ message: "Target does not respond" }),
    })

    render(<MonitorForm />)
    fireEvent.change(screen.getByLabelText("Monitor name"), { target: { value: "Unstable" } })
    fireEvent.submit(screen.getByRole("button", { name: "Create monitor" }).closest("form") as HTMLFormElement)

    await waitFor(() => {
      expect(errorMock).toHaveBeenCalledWith("Target does not respond")
    })
  })

  it("uses fallback error when response json parser throws", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => {
        throw new Error("bad json")
      },
    })

    render(<MonitorForm />)
    fireEvent.change(screen.getByLabelText("Monitor name"), { target: { value: "Broken" } })
    fireEvent.submit(screen.getByRole("button", { name: "Create monitor" }).closest("form") as HTMLFormElement)

    await waitFor(() => {
      expect(errorMock).toHaveBeenCalledWith("Failed to create monitor")
    })
  })

  it("touches all editable fields before successful submit", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
    })

    render(<MonitorForm />)
    fireEvent.change(screen.getByLabelText("Monitor name"), { target: { value: "Coverage Probe" } })
    fireEvent.change(screen.getByLabelText("URL to check"), { target: { value: "https://edge.example.com" } })
    fireEvent.change(screen.getByLabelText("Interval seconds"), { target: { value: "120" } })
    fireEvent.change(screen.getByLabelText("Timeout ms"), { target: { value: "7000" } })
    fireEvent.change(screen.getByLabelText("Tags"), { target: { value: "prod, api" } })
    fireEvent.submit(screen.getByRole("button", { name: "Create monitor" }).closest("form") as HTMLFormElement)

    await waitFor(() => {
      expect(successMock).toHaveBeenCalledWith("Monitor created")
    })
  })
})
