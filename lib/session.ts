import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

export const getServerSession = async () =>
  auth.api.getSession({
    headers: await headers(),
  })

export const requireSession = async () => {
  const session = await getServerSession()

  if (!session) {
    redirect("/auth/login")
  }

  return session
}
