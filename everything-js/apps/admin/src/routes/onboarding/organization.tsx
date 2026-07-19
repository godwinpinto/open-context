import { useState } from "react"
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { useQueryClient } from "@tanstack/react-query"

import { Button } from "@open-context/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
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
import { Spinner } from "@open-context/ui/components/spinner"
import { authClient } from "@/lib/auth/client"
import { getCanCreateOrganization } from "@/lib/auth/organization"
import { getServerSession } from "@/lib/auth/session"

export const Route = createFileRoute("/onboarding/organization")({
  beforeLoad: async () => {
    const session = await getServerSession()
    if (!session) {
      throw redirect({ to: "/" })
    }
    // Ownership is capped at one org per user (enforced server-side in
    // lib/auth/index.ts) — no reason to show the form if they'd just get
    // rejected on submit.
    const canCreate = await getCanCreateOrganization()
    if (!canCreate) {
      throw redirect({ to: "/dashboard" })
    }
  },
  component: CreateOrganizationPage,
})

function slugify(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  const suffix = Math.random().toString(36).slice(2, 8)
  return `${base || "org"}-${suffix}`
}

function CreateOrganizationPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setLoading(true)

    const { data: organization, error: createError } =
      await authClient.organization.create({
        name,
        slug: slugify(name),
      })

    if (createError || !organization) {
      setLoading(false)
      setError(createError?.message ?? "Something went wrong. Please try again.")
      return
    }

    const { data: teams } = await authClient.organization.listTeams({
      query: { organizationId: organization.id },
    })

    setLoading(false)

    if (!teams || teams.length === 0) {
      setError("Organization created, but no default team was found.")
      return
    }

    await queryClient.invalidateQueries({ queryKey: ["organizations"] })

    await navigate({
      to: "/o/$orgId/t/$teamId",
      params: { orgId: organization.id, teamId: teams[0].id },
    })
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Create your organization</CardTitle>
          <CardDescription>
            You&apos;ll be able to invite teammates and create more projects
            afterwards.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="org-name">Organization name</FieldLabel>
                <Input
                  id="org-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </Field>
              {error && <FieldError>{error}</FieldError>}
              <Field>
                <Button type="submit" disabled={loading}>
                  {loading ? <Spinner data-icon="inline-start" /> : null}
                  Create organization
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
