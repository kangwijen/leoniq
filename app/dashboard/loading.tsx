export default function DashboardLoading() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 sm:gap-6 sm:py-8 md:px-8 md:py-10">
      <div className="h-36 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-950/60" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="h-28 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-950/60" />
        <div className="h-28 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-950/60" />
        <div className="h-28 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-950/60" />
        <div className="h-28 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-950/60" />
      </div>
      <div className="h-64 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-950/60" />
    </main>
  )
}
