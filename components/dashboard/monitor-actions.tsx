"use client"

import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

type MonitorActionsProps = {
  monitorId: string
  active: boolean
  compact?: boolean
}

export const MonitorActions = ({ monitorId, active, compact = false }: MonitorActionsProps) => {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const toggleActive = async () => {
    setLoading(true)

    const response = await fetch(`/api/monitors/${monitorId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        active: !active,
      }),
    })

    setLoading(false)

    if (!response.ok) {
      toast.error("Failed to update monitor state")
      return
    }

    toast.success(active ? "Monitor paused" : "Monitor resumed")
    router.refresh()
  }

  const removeMonitor = async () => {
    setLoading(true)

    const response = await fetch(`/api/monitors/${monitorId}`, {
      method: "DELETE",
    })

    setLoading(false)

    if (!response.ok) {
      toast.error("Failed to delete monitor")
      return
    }

    toast.success("Monitor deleted")
    router.push("/dashboard")
    router.refresh()
  }

  return (
    <div className={compact ? "flex flex-wrap items-center gap-2" : "flex flex-wrap items-center gap-2"}>
      <Button
        asChild
        variant="outline"
        size={compact ? "default" : "sm"}
        className="h-11 cursor-pointer border-zinc-700 bg-zinc-900 px-4 text-zinc-100 transition-colors duration-200 hover:bg-zinc-800 sm:h-9 sm:px-3"
      >
        <Link href={`/dashboard/monitors/${monitorId}/edit`}>Edit</Link>
      </Button>
      <Button
        variant="outline"
        size={compact ? "default" : "sm"}
        className="h-11 cursor-pointer border-zinc-700 bg-zinc-900 px-4 text-zinc-100 transition-colors duration-200 hover:bg-zinc-800 sm:h-9 sm:px-3"
        onClick={toggleActive}
        disabled={loading}
      >
        {active ? "Pause" : "Resume"}
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="destructive"
            size={compact ? "default" : "sm"}
            className="h-11 cursor-pointer px-4 sm:h-9 sm:px-3"
            disabled={loading}
          >
            Delete
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete monitor?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes monitor configuration and historical check data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={removeMonitor}>
              Confirm delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
