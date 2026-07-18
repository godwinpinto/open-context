import { useState } from "react"
import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { authClient } from "@/lib/auth/client"

const parentRoute = getRouteApi("/o/$orgId/t/$teamId")

export const Route = createFileRoute("/o/$orgId/t/$teamId/manage/roles")({
  component: RolesPage,
})

// Matches the organization plugin's default access-control statements.
const PERMISSION_MATRIX: Record<string, string[]> = {
  organization: ["update", "delete"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  team: ["create", "update", "delete"],
  ac: ["create", "read", "update", "delete"],
}

const BUILT_IN_ROLES = [
  { name: "owner", description: "Full control, including deleting the organization" },
  { name: "admin", description: "Manage members, teams, and invitations" },
  { name: "member", description: "Read-only access by default" },
]

type PermissionState = Record<string, Record<string, boolean>>

function emptyPermissionState(): PermissionState {
  const state: PermissionState = {}
  for (const [resource, actions] of Object.entries(PERMISSION_MATRIX)) {
    state[resource] = Object.fromEntries(actions.map((a) => [a, false]))
  }
  return state
}

function toPermissionRecord(state: PermissionState): Record<string, string[]> {
  const record: Record<string, string[]> = {}
  for (const [resource, actions] of Object.entries(state)) {
    const granted = Object.entries(actions)
      .filter(([, on]) => on)
      .map(([action]) => action)
    if (granted.length > 0) record[resource] = granted
  }
  return record
}

function fromPermissionRecord(
  record: Record<string, string[]> | undefined,
): PermissionState {
  const state = emptyPermissionState()
  if (!record) return state
  for (const [resource, actions] of Object.entries(record)) {
    if (!state[resource]) continue
    for (const action of actions) {
      if (action in state[resource]) state[resource][action] = true
    }
  }
  return state
}

function RolesPage() {
  const { organization } = parentRoute.useLoaderData()
  const queryClient = useQueryClient()

  const rolesQuery = useQuery({
    queryKey: ["org-roles", organization.id],
    queryFn: async () => {
      const { data, error } = await authClient.organization.listRoles({
        query: { organizationId: organization.id },
      })
      if (error) throw error
      return data
    },
  })

  function invalidateRoles() {
    return queryClient.invalidateQueries({
      queryKey: ["org-roles", organization.id],
    })
  }

  const deleteRole = useMutation({
    mutationFn: async (roleName: string) => {
      const { error } = await authClient.organization.deleteRole({
        roleName,
        organizationId: organization.id,
      })
      if (error) throw error
    },
    onSuccess: invalidateRoles,
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <RoleDialog
          organizationId={organization.id}
          onSaved={invalidateRoles}
          trigger={<Button>New role</Button>}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Built-in roles</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {BUILT_IN_ROLES.map((r) => (
            <div key={r.name} className="flex items-center gap-3">
              <Badge variant="secondary" className="w-16 justify-center">
                {r.name}
              </Badge>
              <span className="text-muted-foreground text-sm">
                {r.description}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Custom roles</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {rolesQuery.data?.length === 0 && (
            <p className="text-muted-foreground text-sm">
              No custom roles yet.
            </p>
          )}
          {rolesQuery.data?.map((role) => (
            <div key={role.role} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge className="w-fit">{role.role}</Badge>
                <span className="text-muted-foreground text-xs">
                  {Object.entries(
                    (role.permission ?? {}) as Record<string, string[]>,
                  )
                    .map(([resource, actions]) => `${resource}: ${actions.join(", ")}`)
                    .join(" · ") || "No permissions granted"}
                </span>
              </div>
              <div className="flex gap-2">
                <RoleDialog
                  organizationId={organization.id}
                  onSaved={invalidateRoles}
                  existing={{
                    role: role.role,
                    permission: role.permission as Record<string, string[]>,
                  }}
                  trigger={
                    <Button variant="ghost" size="sm">
                      Edit
                    </Button>
                  }
                />
                <AlertDialog>
                  <AlertDialogTrigger
                    render={<Button variant="ghost" size="sm" />}
                  >
                    Delete
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {role.role}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Members assigned this role will lose the permissions
                        it grants.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteRole.mutate(role.role)}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function RoleDialog({
  organizationId,
  onSaved,
  trigger,
  existing,
}: {
  organizationId: string
  onSaved: () => void
  trigger: React.ReactNode
  existing?: { role: string; permission: Record<string, string[]> }
}) {
  const [open, setOpen] = useState(false)
  const [roleName, setRoleName] = useState(existing?.role ?? "")
  const [permissions, setPermissions] = useState<PermissionState>(() =>
    fromPermissionRecord(existing?.permission),
  )
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function reset() {
    setRoleName(existing?.role ?? "")
    setPermissions(fromPermissionRecord(existing?.permission))
    setError(null)
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setLoading(true)

    const permission = toPermissionRecord(permissions)
    const { error: saveError } = existing
      ? await authClient.organization.updateRole({
          roleName: existing.role,
          organizationId,
          data: { permission },
        })
      : await authClient.organization.createRole({
          role: roleName,
          organizationId,
          permission,
        })

    setLoading(false)

    if (saveError) {
      setError(saveError.message ?? "Something went wrong.")
      return
    }

    setOpen(false)
    onSaved()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) reset()
      }}
    >
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? `Edit ${existing.role}` : "Create a role"}</DialogTitle>
          <DialogDescription>
            Pick exactly what this role can do.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <FieldGroup>
            {!existing && (
              <Field>
                <FieldLabel htmlFor="role-name">Role name</FieldLabel>
                <Input
                  id="role-name"
                  value={roleName}
                  onChange={(event) => setRoleName(event.target.value)}
                  placeholder="e.g. billing-manager"
                  required
                />
              </Field>
            )}
            <Field>
              <FieldLabel>Permissions</FieldLabel>
              <div className="flex flex-col gap-3 rounded-md border p-3">
                {Object.entries(PERMISSION_MATRIX).map(([resource, actions]) => (
                  <div key={resource} className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium capitalize">
                      {resource}
                    </span>
                    <div className="flex flex-wrap gap-3">
                      {actions.map((action) => (
                        <label
                          key={action}
                          className="flex items-center gap-1.5 text-sm"
                        >
                          <Checkbox
                            checked={permissions[resource]?.[action] ?? false}
                            onCheckedChange={(checked) =>
                              setPermissions((prev) => ({
                                ...prev,
                                [resource]: {
                                  ...prev[resource],
                                  [action]: checked === true,
                                },
                              }))
                            }
                          />
                          {action}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Field>
            {error && <p className="text-destructive text-sm">{error}</p>}
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : "Save role"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
