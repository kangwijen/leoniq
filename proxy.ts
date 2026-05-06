import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"

const protectedPrefixes = ["/dashboard", "/api/monitors"]
const publicAuthPages = ["/auth/login", "/auth/register"]

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname

  const session = await auth.api.getSession({
    headers: request.headers,
  })

  const isProtectedRoute = protectedPrefixes.some(prefix => path.startsWith(prefix))
  const isAuthPage = publicAuthPages.some(route => path.startsWith(route))

  if (isProtectedRoute && !session) {
    return NextResponse.redirect(new URL("/auth/login", request.url))
  }

  if (isAuthPage && session) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
