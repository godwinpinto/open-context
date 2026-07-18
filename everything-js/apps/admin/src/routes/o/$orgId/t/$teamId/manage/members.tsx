import { useState } from "react"
import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { authClient } from "@/lib/auth/client"

const parentRoute = getRouteApi("/o/$orgId/t/$teamId")

export const Route = createFileRoute("/o/$orgId/t/$teamId/manage/members")({
  component: MembersPage,
})

const BUILT_IN_ROLES = ["owner", "admin", "member"]

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

function MembersPage() {
  const { user } = parentRoute.useRouteContext()
  const { organization } = parentRoute.useLoaderData()
  const queryClient = useQueryClient()

  const membersQuery = useQuery({
    queryKey: ["members", organization.id],
    queryFn: async () => {
      const { data, error } = await authClient.organization.listMembers({
        query: { organizationId: organization.id },
      })
      if (error) throw error
      return data
    },
  })

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

  const invitationsQuery = useQuery({
    queryKey: ["invitations", organization.id],
    queryFn: async () => {
      const { data, error } = await authClient.organization.listInvitations({
        query: { organizationId: organization.id },
      })
      if (error) throw error
      return data
    },
  })

  const roleOptions = [
    ...BUILT_IN_ROLES,
    ...(rolesQuery.data ?? []).map((r) => r.role),
  ]

  function invalidateMembers() {
    return queryClient.invalidateQueries({
      queryKey: ["members", organization.id],
    })
  }

  const updateRole = useMutation({
    mutationFn: async ({
      memberId,
      role,
    }: {
      memberId: string
      role: string
    }) => {
      const { error } = await authClient.organization.updateMemberRole({
        memberId,
        role,
        organizationId: organization.id,
      })
      if (error) throw error
    },
    onSuccess: invalidateMembers,
  })

  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await authClient.organization.removeMember({
        memberIdOrEmail: memberId,
        organizationId: organization.id,
      })
      if (error) throw error
    },
    onSuccess: invalidateMembers,
  })

  const cancelInvitation = useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } =
        await authClient.organization.cancelInvitation({ invitationId })
      if (error) throw error
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["invitations", organization.id],
      }),
  })

  const pendingInvitations =
    invitationsQuery.data?.filter((i) => i.status === "pending") ?? []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <InviteMemberDialog
          organizationId={organization.id}
          roleOptions={roleOptions}
          onInvited={() =>
            queryClient.invalidateQueries({
              queryKey: ["invitations", organization.id],
            })
          }
        />
      </div>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {membersQuery.data?.members.map((member) => {
                const isSelf = member.userId === user.id
                const isOwner = member.role === "owner"
                return (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="size-6">
                          <AvatarFallback className="text-xs">
                            {initials(member.user.name)}
                          </AvatarFallback>
                        </Avatar>
                        {member.user.name}
                        {isSelf && (
                          <span className="text-muted-foreground text-xs">
                            (you)
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {member.user.email}
                    </TableCell>
                    <TableCell>
                      {isOwner || isSelf ? (
                        <Badge variant="secondary">{member.role}</Badge>
                      ) : (
                        <Select
                          value={member.role}
                          onValueChange={(role) => {
                            if (role) {
                              updateRole.mutate({ memberId: member.id, role })
                            }
                          }}
                        >
                          <SelectTrigger size="sm" className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {roleOptions.map((role) => (
                              <SelectItem key={role} value={role}>
                                {role}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!isOwner && !isSelf && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeMember.mutate(member.id)}
                        >
                          Remove
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {pendingInvitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending invitations</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell>{invitation.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{invitation.role}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          cancelInvitation.mutate(invitation.id)
                        }
                      >
                        Cancel
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function InviteMemberDialog({
  organizationId,
  roleOptions,
  onInvited,
}: {
  organizationId: string
  roleOptions: string[]
  onInvited: () => void
}) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("member")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setLoading(true)

    const { error: inviteError } = await authClient.organization.inviteMember(
      { email, role, organizationId },
    )

    setLoading(false)

    if (inviteError) {
      setError(inviteError.message ?? "Something went wrong.")
      return
    }

    setEmail("")
    setRole("member")
    setOpen(false)
    onInvited()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>Invite member</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a member</DialogTitle>
          <DialogDescription>
            They&apos;ll be able to accept this invite once they sign in with
            this email. No email is sent — share the invite yourself for now.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="invite-email">Email</FieldLabel>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="invite-role">Role</FieldLabel>
              <Select
                value={role}
                onValueChange={(value) => value && setRole(value)}
              >
                <SelectTrigger id="invite-role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions
                    .filter((r) => r !== "owner")
                    .map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>
            {error && <p className="text-destructive text-sm">{error}</p>}
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button type="submit" disabled={loading}>
              {loading ? "Sending…" : "Send invite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
