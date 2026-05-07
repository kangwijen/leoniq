"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type MonitorType = "http" | "tcp"

export const MonitorForm = () => {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [type, setType] = useState<MonitorType>("http")
  const [name, setName] = useState("")
  const [url, setUrl] = useState("https://example.com")
  const [host, setHost] = useState("example.com")
  const [port, setPort] = useState("443")
  const [intervalSeconds, setIntervalSeconds] = useState("60")
  const [timeoutMs, setTimeoutMs] = useState("5000")
  const [tags, setTags] = useState("")

  const readErrorMessage = async (response: Response, fallback: string) => {
    try {
      const payload = (await response.json()) as { error?: string; message?: string }
      if (payload.error && payload.error.trim().length > 0) {
        return payload.error
      }
      if (payload.message && payload.message.trim().length > 0) {
        return payload.message
      }
      return fallback
    } catch {
      return fallback
    }
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      setLoading(true)

      const payload = {
        name,
        type,
        url: type === "http" ? url : undefined,
        host: type === "tcp" ? host : undefined,
        port: type === "tcp" ? Number(port) : undefined,
        intervalSeconds: Number(intervalSeconds),
        timeoutMs: Number(timeoutMs),
        tags: tags
          .split(",")
          .map(item => item.trim())
          .filter(item => item.length > 0),
      }

      const response = await fetch("/api/monitors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        toast.error(await readErrorMessage(response, "Failed to create monitor"))
        return
      }

      toast.success("Monitor created")
      router.push("/dashboard")
      router.refresh()
    } catch {
      toast.error("Network error while creating monitor")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-zinc-800 bg-zinc-950/90 text-zinc-100 shadow-2xl">
      <CardHeader>
        <CardTitle className="text-xl font-semibold sm:text-2xl">New Monitor</CardTitle>
        <CardDescription className="text-zinc-400">
          Input what you want to monitor. Website checks use HTTP and socket checks use TCP.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 sm:gap-5" onSubmit={submit}>
          <div className="grid gap-2">
            <Label htmlFor="name">Monitor name</Label>
            <Input
              id="name"
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder="Public API Health"
              required
              maxLength={120}
              className="h-11"
            />
          </div>

          <div className="grid gap-2">
            <Label>Monitor type</Label>
            <Select value={type} onValueChange={value => setType(value as MonitorType)}>
              <SelectTrigger className="h-11 cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="http">Website HTTP or HTTPS</SelectItem>
                <SelectItem value="tcp">Socket TCP</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {type === "http" ? (
            <div className="grid gap-2">
              <Label htmlFor="url">URL to check</Label>
              <Input
                id="url"
                value={url}
                onChange={event => setUrl(event.target.value)}
                placeholder="https://api.example.com/health"
                required
                maxLength={2048}
                className="h-11"
              />
            </div>
          ) : (
            <>
              <div className="grid gap-2">
                <Label htmlFor="host">Host</Label>
                <Input
                  id="host"
                  value={host}
                  onChange={event => setHost(event.target.value)}
                  placeholder="example.com"
                  required
                  maxLength={253}
                  className="h-11"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="port">Port</Label>
                <Input
                  id="port"
                  value={port}
                  onChange={event => setPort(event.target.value)}
                  placeholder="443"
                  required
                  inputMode="numeric"
                  pattern="[0-9]{1,5}"
                  maxLength={5}
                  className="h-11"
                />
              </div>
            </>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="intervalSeconds">Interval seconds</Label>
              <Input
                id="intervalSeconds"
                value={intervalSeconds}
                onChange={event => setIntervalSeconds(event.target.value)}
                required
                inputMode="numeric"
                pattern="[0-9]{1,6}"
                maxLength={6}
                className="h-11"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="timeoutMs">Timeout ms</Label>
              <Input
                id="timeoutMs"
                value={timeoutMs}
                onChange={event => setTimeoutMs(event.target.value)}
                required
                inputMode="numeric"
                pattern="[0-9]{1,7}"
                maxLength={7}
                className="h-11"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="tags">Tags</Label>
            <Input
              id="tags"
              value={tags}
              onChange={event => setTags(event.target.value)}
              placeholder="prod, api, payments"
              maxLength={240}
              className="h-11"
            />
          </div>

          <Button
            className="h-10 cursor-pointer bg-emerald-500 text-black transition-colors duration-200 hover:bg-emerald-400"
            type="submit"
            disabled={loading}
          >
            {loading ? "Saving..." : "Create monitor"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
