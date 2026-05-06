"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export const getWsUrl = () => {
  if (process.env.NEXT_PUBLIC_WS_URL) {
    return process.env.NEXT_PUBLIC_WS_URL
  }

  if (typeof window === "undefined") {
    return "ws://localhost:4001"
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
  return `${protocol}//${window.location.hostname}:4001`
}

export const RealtimeRefresh = () => {
  const router = useRouter()

  useEffect(() => {
    let websocket: WebSocket | null = null
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let refreshTimeoutId: ReturnType<typeof setTimeout> | null = null
    let stopped = false

    const connect = () => {
      websocket = new WebSocket(getWsUrl())

      websocket.onmessage = () => {
        if (refreshTimeoutId) {
          clearTimeout(refreshTimeoutId)
        }

        refreshTimeoutId = setTimeout(() => {
          router.refresh()
        }, 250)
      }

      websocket.onclose = () => {
        if (!stopped) {
          timeoutId = setTimeout(connect, 1500)
        }
      }
    }

    connect()

    return () => {
      stopped = true

      if (timeoutId) {
        clearTimeout(timeoutId)
      }

      if (refreshTimeoutId) {
        clearTimeout(refreshTimeoutId)
      }

      if (websocket) {
        websocket.onclose = null
        websocket.close()
      }
    }
  }, [router])

  return null
}
