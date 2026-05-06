"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Mode = "login" | "register"

type AuthFormProps = {
  mode: Mode
}

export const AuthForm = ({ mode }: AuthFormProps) => {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      setLoading(true)

      if (mode === "register") {
        const { error } = await authClient.signUp.email({
          name,
          email,
          password,
        })

        if (error) {
          toast.error(error.message || "Unable to register")
          return
        }

        toast.success("Account created")
        router.push("/dashboard")
        router.refresh()
        return
      }

      const { error } = await authClient.signIn.email({
        email,
        password,
      })

      if (error) {
        toast.error("Invalid email or password")
        return
      }

      toast.success("Welcome back")
      router.push("/dashboard")
      router.refresh()
    } catch {
      toast.error("Network error while submitting authentication request")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-zinc-800 bg-zinc-950/90 text-zinc-100 shadow-2xl">
      <CardHeader>
        <CardTitle className="text-xl font-semibold sm:text-2xl">
          {mode === "login" ? "Sign in" : "Create account"}
        </CardTitle>
        <CardDescription className="text-zinc-400">
          {mode === "login"
            ? "Enter your credentials to access monitoring dashboards."
            : "Create your account and start tracking website and socket checks."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 sm:gap-5" onSubmit={submit}>
          {mode === "register" && (
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={event => setName(event.target.value)}
                placeholder="Ops Engineer"
                required
                minLength={2}
                maxLength={100}
                className="h-11"
              />
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="name@company.com"
              type="email"
              required
              maxLength={254}
              autoComplete={mode === "login" ? "username" : "email"}
              className="h-11"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="h-11"
            />
          </div>
          <Button
            className="mt-2 h-10 w-full cursor-pointer bg-emerald-500 text-black transition-colors duration-200 hover:bg-emerald-400"
            disabled={loading}
            type="submit"
          >
            {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
          </Button>
        </form>
        <p className="mt-4 text-sm text-zinc-400">
          {mode === "login" ? "Need an account?" : "Already have an account?"}{" "}
          <Link
            href={mode === "login" ? "/auth/register" : "/auth/login"}
            className="cursor-pointer text-emerald-400 transition-colors duration-200 hover:text-emerald-300"
          >
            {mode === "login" ? "Register" : "Sign in"}
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
