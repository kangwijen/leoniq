import Link from "next/link"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { getServerSession } from "@/lib/session"

export default async function HomePage() {
  const session = await getServerSession()

  if (session) {
    redirect("/dashboard")
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-12">
      <section className="w-full max-w-3xl rounded-2xl border border-zinc-800 bg-zinc-950/80 p-8 shadow-2xl md:p-12">
        <p className="mb-4 text-sm uppercase tracking-[0.2em] text-zinc-400">Leoniq Monitor</p>
        <h1 className="text-4xl font-semibold leading-tight text-zinc-100 md:text-5xl">
          Monitor websites and socket services with live status graphs.
        </h1>
        <p className="mt-4 max-w-2xl text-zinc-400">
          Track HTTP and TCP availability, inspect latency trends, and review failures from a
          single dashboard.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button
            asChild
            className="h-10 cursor-pointer bg-emerald-500 text-black transition-colors duration-200 hover:bg-emerald-400"
          >
            <Link href="/auth/register">Create account</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-10 cursor-pointer border-zinc-700 bg-zinc-900 text-zinc-100 transition-colors duration-200 hover:bg-zinc-800"
          >
            <Link href="/auth/login">Sign in</Link>
          </Button>
        </div>
      </section>
    </main>
  )
}
