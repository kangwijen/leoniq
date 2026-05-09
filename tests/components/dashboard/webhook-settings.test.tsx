import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { WebhookSettings } from "@/components/dashboard/webhook-settings"

const successMock = jest.fn()
const errorMock = jest.fn()

jest.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => successMock(...args),
    error: (...args: unknown[]) => errorMock(...args),
  },
}))

jest.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}))

describe("WebhookSettings", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn()
  })

  it("submits webhook URL and shows success toast", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    })

    render(<WebhookSettings initialWebhookUrl={null} />)

    fireEvent.click(screen.getByRole("button", { name: "Webhook settings" }))
    fireEvent.change(screen.getByLabelText("Webhook URL"), {
      target: { value: "https://hooks.example.com/x" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save webhook" }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/settings/webhook",
        expect.objectContaining({
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ webhookUrl: "https://hooks.example.com/x" }),
        })
      )
      expect(successMock).toHaveBeenCalledWith("Webhook updated")
    })
  })

  it("shows server error message when response is not ok", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "invalid url" }),
    })

    render(<WebhookSettings initialWebhookUrl={null} />)

    fireEvent.click(screen.getByRole("button", { name: "Webhook settings" }))
    fireEvent.click(screen.getByRole("button", { name: "Save webhook" }))

    await waitFor(() => {
      expect(errorMock).toHaveBeenCalledWith("invalid url")
    })
  })

  it("shows generic error when error json cannot be parsed", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => {
        throw new Error("invalid json")
      },
    })

    render(<WebhookSettings initialWebhookUrl={null} />)

    fireEvent.click(screen.getByRole("button", { name: "Webhook settings" }))
    fireEvent.click(screen.getByRole("button", { name: "Save webhook" }))

    await waitFor(() => {
      expect(errorMock).toHaveBeenCalledWith("Failed to update webhook")
    })
  })

  it("shows generic error when response body has no error field", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({}),
    })

    render(<WebhookSettings initialWebhookUrl={null} />)

    fireEvent.click(screen.getByRole("button", { name: "Webhook settings" }))
    fireEvent.click(screen.getByRole("button", { name: "Save webhook" }))

    await waitFor(() => {
      expect(errorMock).toHaveBeenCalledWith("Failed to update webhook")
    })
  })

  it("shows network error when fetch throws", async () => {
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error("offline"))

    render(<WebhookSettings initialWebhookUrl={null} />)

    fireEvent.click(screen.getByRole("button", { name: "Webhook settings" }))
    fireEvent.click(screen.getByRole("button", { name: "Save webhook" }))

    await waitFor(() => {
      expect(errorMock).toHaveBeenCalledWith("Network error while updating webhook")
    })
  })
})
