import { useState } from "react"
import { createFileRoute, redirect } from "@tanstack/react-router"

import { Button } from "@open-context/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@open-context/ui/components/card"
import { Field, FieldGroup, FieldLabel } from "@open-context/ui/components/field"
import { Input } from "@open-context/ui/components/input"
import { authClient } from "@/lib/auth/client"
import { getServerSession } from "@/lib/auth/session"

export const Route = createFileRoute("/device")({
  validateSearch: (search: Record<string, unknown>) => ({
    user_code: typeof search.user_code === "string" ? search.user_code : undefined,
  }),
  beforeLoad: async () => {
    const session = await getServerSession()
    if (!session) {
      throw redirect({ to: "/" })
    }
  },
  component: DevicePage,
})

type Status = "pending" | "approved" | "denied"

function DevicePage() {
  const { user_code } = Route.useSearch()
  const [code, setCode] = useState(user_code ?? "")
  const [verifiedCode, setVerifiedCode] = useState<string | null>(null)
  const [status, setStatus] = useState<Status | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setLoading(true)
    const { data, error } = await authClient.device({
      query: { user_code: code.trim() },
    })
    setLoading(false)
    if (error) {
      setError(error.error_description ?? "That code isn't valid. Check it and try again.")
      return
    }
    setVerifiedCode(code.trim())
    setStatus(data.status as Status)
  }

  async function respond(accept: boolean) {
    if (!verifiedCode) return
    setError(null)
    setLoading(true)
    const { error } = accept
      ? await authClient.device.approve({ userCode: verifiedCode })
      : await authClient.device.deny({ userCode: verifiedCode })
    setLoading(false)
    if (error) {
      setError(error.error_description ?? "Something went wrong. Please try again.")
      return
    }
    setStatus(accept ? "approved" : "denied")
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Device sign-in</CardTitle>
          <CardDescription>
            {status === null
              ? "Enter the code shown on your device."
              : status === "pending"
                ? "Confirm this is the code shown on your device."
                : status === "approved"
                  ? "Device signed in."
                  : "Sign-in request denied."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {status === null && (
            <form id="device-verify-form" onSubmit={verify}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="user-code">Code</FieldLabel>
                  <Input
                    id="user-code"
                    autoFocus
                    autoComplete="off"
                    value={code}
                    onChange={(event) => setCode(event.target.value.toUpperCase())}
                    placeholder="XXXXXXXX"
                    required
                  />
                </Field>
              </FieldGroup>
            </form>
          )}
          {status === "pending" && (
            <p className="text-center font-mono text-2xl tracking-widest">
              {verifiedCode}
            </p>
          )}
          {error && <p className="text-destructive text-sm">{error}</p>}
        </CardContent>
        <CardFooter className="flex gap-2">
          {status === null && (
            <Button
              form="device-verify-form"
              type="submit"
              className="flex-1"
              disabled={loading || !code.trim()}
            >
              Continue
            </Button>
          )}
          {status === "pending" && (
            <>
              <Button
                variant="outline"
                className="flex-1"
                disabled={loading}
                onClick={() => respond(false)}
              >
                Deny
              </Button>
              <Button className="flex-1" disabled={loading} onClick={() => respond(true)}>
                Approve
              </Button>
            </>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
