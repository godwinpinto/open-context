import { createFileRoute, redirect } from "@tanstack/react-router"

import { LoginForm } from "@/components/login-form"
import { getServerSession } from "@/lib/auth/session"

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const session = await getServerSession()
    if (session) {
      throw redirect({ to: "/dashboard" })
    }
  },
  component: AuthPage,
})

function AuthPage() {
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  )
}
