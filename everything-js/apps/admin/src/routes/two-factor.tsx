import { useState } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { authClient } from "@/lib/auth/client"

// No session guard here: at this point the user has passed the password
// check but does NOT have a full session yet — just the pending-2FA
// cookie the twoFactor plugin sets.
export const Route = createFileRoute("/two-factor")({
  component: TwoFactorPage,
})

function TwoFactorPage() {
  const navigate = useNavigate()
  const [code, setCode] = useState("")
  const [trustDevice, setTrustDevice] = useState(false)
  const [useBackupCode, setUseBackupCode] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = useBackupCode
      ? await authClient.twoFactor.verifyBackupCode({
          code: code.trim(),
          trustDevice,
        })
      : await authClient.twoFactor.verifyTotp({
          code: code.trim(),
          trustDevice,
        })
    setLoading(false)
    if (error) {
      setError(error.message ?? "That code didn't match. Try again.")
      return
    }
    await navigate({ to: "/dashboard" })
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Two-factor authentication</CardTitle>
          <CardDescription>
            {useBackupCode
              ? "Enter one of your backup codes."
              : "Enter the 6-digit code from your authenticator app."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="two-factor-code">
                  {useBackupCode ? "Backup code" : "Code"}
                </FieldLabel>
                <Input
                  id="two-factor-code"
                  autoFocus
                  inputMode={useBackupCode ? "text" : "numeric"}
                  autoComplete="one-time-code"
                  placeholder={useBackupCode ? "" : "123456"}
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  required
                />
              </Field>
              <Field orientation="horizontal">
                <Checkbox
                  id="trust-device"
                  checked={trustDevice}
                  onCheckedChange={(checked) =>
                    setTrustDevice(checked === true)
                  }
                />
                <FieldLabel htmlFor="trust-device" className="font-normal">
                  Trust this device for 30 days
                </FieldLabel>
              </Field>
              {error && <p className="text-destructive text-sm">{error}</p>}
              <Field>
                <Button type="submit" disabled={loading || !code.trim()}>
                  Verify
                </Button>
                <Button
                  type="button"
                  variant="link"
                  className="text-muted-foreground"
                  onClick={() => {
                    setUseBackupCode((value) => !value)
                    setError(null)
                    setCode("")
                  }}
                >
                  {useBackupCode
                    ? "Use authenticator code instead"
                    : "Use a backup code instead"}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
