"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type WebhookSettingsProps = {
  initialWebhookUrl: string | null
}

export const WebhookSettings = ({ initialWebhookUrl }: WebhookSettingsProps) => {
  const [loading, setLoading] = useState(false)
  const [value, setValue] = useState(initialWebhookUrl ?? "")

  const saveWebhook = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/settings/webhook", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          webhookUrl: value,
        }),
      })

      if (!response.ok) {
        let errorMessage = "Failed to update webhook"
        try {
          const payload = (await response.json()) as { error?: string }
          if (payload.error && payload.error.trim().length > 0) {
            errorMessage = payload.error
          }
        } catch {}
        toast.error(errorMessage)
        return
      }

      toast.success("Webhook updated")
    } catch {
      toast.error("Network error while updating webhook")
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 sm:p-5">
      <div className="mb-3">
        <h2 className="text-base font-semibold text-zinc-100">Webhook alerts</h2>
        <p className="text-sm text-zinc-400">
          Sends a summary every 5 minutes when at least one service is down
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="grid gap-2">
          <Label htmlFor="webhookUrl">Webhook URL</Label>
          <Input
            id="webhookUrl"
            type="url"
            value={value}
            onChange={event => setValue(event.target.value)}
            placeholder="https://hooks.example.com/monitoring"
            className="h-11"
          />
        </div>
        <Button
          onClick={saveWebhook}
          disabled={loading}
          className="h-11 cursor-pointer bg-emerald-500 text-black transition-colors duration-200 hover:bg-emerald-400"
        >
          {loading ? "Saving..." : "Save webhook"}
        </Button>
      </div>
    </section>
  )
}
