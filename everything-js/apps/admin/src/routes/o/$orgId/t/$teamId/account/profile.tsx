import { useState } from "react"
import { createFileRoute, getRouteApi, useRouter } from "@tanstack/react-router"

import { Avatar, AvatarFallback } from "@open-context/ui/components/avatar"
import { Button } from "@open-context/ui/components/button"
import { Card, CardContent } from "@open-context/ui/components/card"
import { Field, FieldGroup, FieldLabel } from "@open-context/ui/components/field"
import { Input } from "@open-context/ui/components/input"
import { updateUserName } from "@/lib/auth/account"

const parentRoute = getRouteApi("/o/$orgId/t/$teamId")

export const Route = createFileRoute("/o/$orgId/t/$teamId/account/profile")({
  component: ProfilePage,
})

function initials(name: string) {
  return (
    name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  )
}

function ProfilePage() {
  const { user } = parentRoute.useRouteContext()
  const router = useRouter()
  const [name, setName] = useState(user.name)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(false)
    setLoading(true)

    try {
      await updateUserName({ data: { name } })
      setSuccess(true)
      await router.invalidate()
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Avatar className="size-12">
              <AvatarFallback>{initials(user.name)}</AvatarFallback>
            </Avatar>
            <div className="text-sm">
              <p className="font-medium">{user.name}</p>
              <p className="text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="profile-name">Name</FieldLabel>
              <Input
                id="profile-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </Field>
            {error && <p className="text-destructive text-sm">{error}</p>}
            {success && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                Saved.
              </p>
            )}
            <Field>
              <Button type="submit" disabled={loading || name === user.name}>
                {loading ? "Saving…" : "Save changes"}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
