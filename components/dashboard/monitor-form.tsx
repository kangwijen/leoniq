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

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)

    const payload = {
      name,
      type,
      url: type === "http" ? url : undefined,
      host: type === "tcp" ? host : undefined,
      port: type === "tcp" ? Number(port) : undefined,
      intervalSeconds: Number(intervalSeconds),
      timeoutMs: Number(timeoutMs),
    }

    const response = await fetch("/api/monitors", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()
    setLoading(false)

    if (!response.ok) {
      toast.error(data.error || "Failed to create monitor")
      return
    }

    toast.success("Monitor created")
    router.push("/dashboard")
    router.refresh()
  }

  return (
    <Card className="border-zinc-800 bg-zinc-950/90 text-zinc-100 shadow-2xl">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold">New Monitor</CardTitle>
        <CardDescription className="text-zinc-400">
          Input what you want to monitor. Website checks use HTTP and socket checks use TCP.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={submit}>
          <div className="grid gap-2">
            <Label htmlFor="name">Monitor name</Label>
            <Input
              id="name"
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder="Public API Health"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label>Monitor type</Label>
            <Select value={type} onValueChange={value => setType(value as MonitorType)}>
              <SelectTrigger className="cursor-pointer">
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
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="timeoutMs">Timeout ms</Label>
              <Input
                id="timeoutMs"
                value={timeoutMs}
                onChange={event => setTimeoutMs(event.target.value)}
                required
              />
            </div>
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
