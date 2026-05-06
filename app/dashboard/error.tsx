"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

type DashboardErrorProps = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  useEffect(() => {
    console.error("Dashboard route error", error)
  }, [error])

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-3xl flex-col items-start justify-center gap-4 px-4 py-8 md:px-8">
      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Dashboard Error</p>
      <h1 className="text-2xl font-semibold text-zinc-100 sm:text-3xl">Could not load this view</h1>
      <p className="max-w-prose text-sm text-zinc-400 sm:text-base">
        A runtime error interrupted this page. Retry first. If the issue persists, return to dashboard
        home and try again.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={reset} className="h-11 bg-emerald-500 px-4 text-black hover:bg-emerald-400">
          Retry
        </Button>
        <Button
          asChild
          variant="outline"
          className="h-11 border-zinc-700 bg-zinc-900 px-4 text-zinc-100 hover:bg-zinc-800"
        >
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    </main>
  )
}
