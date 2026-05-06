"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

const getWsUrl = () => {
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
        timeoutId = setTimeout(connect, 1500)
      }
    }

    connect()

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }

      if (refreshTimeoutId) {
        clearTimeout(refreshTimeoutId)
      }

      if (websocket && websocket.readyState === websocket.OPEN) {
        websocket.close()
      }
    }
  }, [router])

  return null
}
