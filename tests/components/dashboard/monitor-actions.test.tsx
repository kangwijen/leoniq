import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MonitorActions } from "@/components/dashboard/monitor-actions"

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

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children }: {
    href: string
    children: React.ReactNode
  }) => (
    <a href={href}>{children}</a>
  ),
}))

jest.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => successMock(...args),
    error: (...args: unknown[]) => errorMock(...args),
  },
}))

jest.mock("@/components/ui/button", () => ({
  Button: ({
    asChild,
    children,
    ...props
  }: {
    asChild?: boolean
    children: React.ReactNode
    [key: string]: unknown
  }) => (asChild ? <>{children}</> : <button {...props}>{children}</button>),
}))

jest.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogCancel: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  AlertDialogAction: ({
    children,
    onClick,
  }: {
    children: React.ReactNode
    onClick?: () => void
  }) => <button onClick={onClick}>{children}</button>,
}))

describe("MonitorActions", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn()
  })

  it("toggles monitor state and refreshes dashboard", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
    })

    render(<MonitorActions monitorId="m-1" active />)

    fireEvent.click(screen.getByRole("button", { name: "Pause" }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/monitors/m-1", expect.objectContaining({ method: "PATCH" }))
    })
    expect(successMock).toHaveBeenCalledWith("Monitor paused")
    expect(refreshMock).toHaveBeenCalledTimes(1)
  })

  it("resumes monitor and shows resume success message", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
    })

    render(<MonitorActions monitorId="m-9" active={false} />)
    fireEvent.click(screen.getByRole("button", { name: "Resume" }))

    await waitFor(() => {
      expect(successMock).toHaveBeenCalledWith("Monitor resumed")
    })
  })

  it("deletes monitor and navigates back to dashboard", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
    })

    render(<MonitorActions monitorId="m-2" active={false} />)

    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/monitors/m-2", { method: "DELETE" })
    })
    expect(successMock).toHaveBeenCalledWith("Monitor deleted")
    expect(pushMock).toHaveBeenCalledWith("/dashboard")
    expect(refreshMock).toHaveBeenCalledTimes(1)
  })

  it("shows response message on pause failure", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ message: "Cannot pause right now" }),
    })

    render(<MonitorActions monitorId="m-3" active compact />)

    fireEvent.click(screen.getByRole("button", { name: "Pause" }))

    await waitFor(() => {
      expect(errorMock).toHaveBeenCalledWith("Cannot pause right now")
    })
    expect(refreshMock).not.toHaveBeenCalled()
  })

  it("falls back to default delete error when payload parsing fails", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => {
        throw new Error("bad payload")
      },
    })

    render(<MonitorActions monitorId="m-4" active={false} />)

    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }))

    await waitFor(() => {
      expect(errorMock).toHaveBeenCalledWith("Failed to delete monitor")
    })
  })

  it("shows network error when toggle request throws", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("offline"))

    render(<MonitorActions monitorId="m-5" active={false} />)

    fireEvent.click(screen.getByRole("button", { name: "Resume" }))

    await waitFor(() => {
      expect(errorMock).toHaveBeenCalledWith("Network error while updating monitor state")
    })
  })

  it("shows network error when delete request throws", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("offline"))

    render(<MonitorActions monitorId="m-6" active={false} />)

    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }))

    await waitFor(() => {
      expect(errorMock).toHaveBeenCalledWith("Network error while deleting monitor")
    })
  })

  it("uses payload.error value for delete error", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Cannot delete active monitor" }),
    })

    render(<MonitorActions monitorId="m-7" active={false} />)
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }))

    await waitFor(() => {
      expect(errorMock).toHaveBeenCalledWith("Cannot delete active monitor")
    })
  })

  it("uses fallback update message when payload has no message keys", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({}),
    })

    render(<MonitorActions monitorId="m-8" active />)
    fireEvent.click(screen.getByRole("button", { name: "Pause" }))

    await waitFor(() => {
      expect(errorMock).toHaveBeenCalledWith("Failed to update monitor state")
    })
  })
})
