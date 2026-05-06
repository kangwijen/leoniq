import { redirect } from "next/navigation"
import { AuthForm } from "@/components/auth/auth-form"
import { getServerSession } from "@/lib/session"

export default async function RegisterPage() {
  const session = await getServerSession()

  if (session) {
    redirect("/dashboard")
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-10">
      <div className="w-full max-w-md">
        <AuthForm mode="register" />
      </div>
    </main>
  )
}
