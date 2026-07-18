import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { authClient } from "@/lib/auth/client"

export function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [revokeOtherSessions, setRevokeOtherSessions] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  function reset() {
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
    setRevokeOtherSessions(false)
    setError(null)
    setSuccess(false)
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(false)

    if (newPassword !== confirmPassword) {
      setError("New passwords don't match.")
      return
    }

    setLoading(true)
    const { error: changeError } = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions,
    })
    setLoading(false)

    if (changeError) {
      setError(changeError.message ?? "Something went wrong.")
      return
    }

    setSuccess(true)
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) reset()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>
            You&apos;ll stay signed in on this device.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="current-password">
                Current password
              </FieldLabel>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="new-password">New password</FieldLabel>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                minLength={8}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="confirm-password">
                Confirm new password
              </FieldLabel>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                minLength={8}
                required
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={revokeOtherSessions}
                onCheckedChange={(checked) =>
                  setRevokeOtherSessions(checked === true)
                }
              />
              Sign out of other devices
            </label>
            {error && <p className="text-destructive text-sm">{error}</p>}
            {success && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                Password changed.
              </p>
            )}
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : "Change password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
