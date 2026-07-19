import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { QRCodeSVG } from "qrcode.react"

import { Badge } from "@open-context/ui/components/badge"
import { Button } from "@open-context/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@open-context/ui/components/card"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@open-context/ui/components/field"
import { Input } from "@open-context/ui/components/input"
import { authClient } from "@/lib/auth/client"

export const Route = createFileRoute("/o/$orgId/t/$teamId/account/security")({
  component: SecurityPage,
})

type SetupData = {
  totpURI: string
  backupCodes: string[]
}

function SecurityPage() {
  const { data: session, refetch } = authClient.useSession()
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [setup, setSetup] = useState<SetupData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const twoFactorEnabled = Boolean(session?.user.twoFactorEnabled)

  async function onEnable(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setLoading(true)
    const { data, error } = await authClient.twoFactor.enable({ password })
    setLoading(false)
    if (error) {
      setError(error.message ?? "Wrong password. Please try again.")
      return
    }
    setPassword("")
    setSetup(data)
  }

  async function onVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await authClient.twoFactor.verifyTotp({ code })
    setLoading(false)
    if (error) {
      setError(error.message ?? "That code didn't match. Try again.")
      return
    }
    setSetup(null)
    setCode("")
    await refetch()
  }

  async function onDisable(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await authClient.twoFactor.disable({ password })
    setLoading(false)
    if (error) {
      setError(error.message ?? "Wrong password. Please try again.")
      return
    }
    setPassword("")
    await refetch()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Two-factor authentication
          {twoFactorEnabled ? (
            <Badge>Enabled</Badge>
          ) : (
            <Badge variant="secondary">Off</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Enabled → offer disable */}
        {twoFactorEnabled && !setup && (
          <form onSubmit={onDisable} className="max-w-sm">
            <FieldGroup>
              <p className="text-muted-foreground text-sm">
                Signing in requires a code from your authenticator app. Enter
                your password to turn this off.
              </p>
              <Field>
                <FieldLabel htmlFor="disable-password">Password</FieldLabel>
                <Input
                  id="disable-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </Field>
              {error && <FieldError>{error}</FieldError>}
              <Field>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={loading || !password}
                >
                  Disable two-factor
                </Button>
              </Field>
            </FieldGroup>
          </form>
        )}

        {/* Off → offer enable */}
        {!twoFactorEnabled && !setup && (
          <form onSubmit={onEnable} className="max-w-sm">
            <FieldGroup>
              <p className="text-muted-foreground text-sm">
                Add a second step at sign-in using an authenticator app like
                Google Authenticator or 1Password. Enter your password to
                begin.
              </p>
              <Field>
                <FieldLabel htmlFor="enable-password">Password</FieldLabel>
                <Input
                  id="enable-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </Field>
              {error && <FieldError>{error}</FieldError>}
              <Field>
                <Button type="submit" disabled={loading || !password}>
                  Enable two-factor
                </Button>
              </Field>
            </FieldGroup>
          </form>
        )}

        {/* Mid-setup → QR + backup codes + confirm code */}
        {setup && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <p className="text-sm">
                1. Scan this QR code with your authenticator app.
              </p>
              <div className="w-fit rounded-md bg-white p-3">
                <QRCodeSVG value={setup.totpURI} size={160} />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-sm">
                2. Save these backup codes somewhere safe. Each one can be
                used once if you lose access to your authenticator.
              </p>
              <div className="bg-muted grid w-fit grid-cols-2 gap-x-6 gap-y-1 rounded-md p-3 font-mono text-sm">
                {setup.backupCodes.map((backupCode) => (
                  <span key={backupCode}>{backupCode}</span>
                ))}
              </div>
            </div>
            <form onSubmit={onVerify} className="max-w-sm">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="verify-code">
                    3. Enter the 6-digit code from your app
                  </FieldLabel>
                  <Input
                    id="verify-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    required
                  />
                </Field>
                {error && <FieldError>{error}</FieldError>}
                <Field>
                  <Button type="submit" disabled={loading || !code}>
                    Confirm
                  </Button>
                </Field>
              </FieldGroup>
            </form>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
