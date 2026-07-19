import { useState } from "react"
import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { PlusIcon } from "lucide-react"

import { Badge } from "@open-context/ui/components/badge"
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
} from "@open-context/ui/components/alert-dialog"
import { Button } from "@open-context/ui/components/button"
import { Card, CardContent } from "@open-context/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@open-context/ui/components/dialog"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@open-context/ui/components/field"
import { Input } from "@open-context/ui/components/input"
import { Spinner } from "@open-context/ui/components/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@open-context/ui/components/table"
import { authClient } from "@/lib/auth/client"

const parentRoute = getRouteApi("/o/$orgId/t/$teamId")

export const Route = createFileRoute("/o/$orgId/t/$teamId/manage/teams")({
  component: TeamsPage,
})

function TeamsPage() {
  const { organization, team: activeTeam } = parentRoute.useLoaderData()
  const queryClient = useQueryClient()

  const teamsQuery = useQuery({
    queryKey: ["organization-teams", organization.id],
    queryFn: async () => {
      const { data, error } = await authClient.organization.listTeams({
        query: { organizationId: organization.id },
      })
      if (error) throw error
      return data
    },
  })

  function invalidateTeams() {
    return queryClient.invalidateQueries({
      queryKey: ["organization-teams", organization.id],
    })
  }

  const renameTeam = useMutation({
    mutationFn: async ({ teamId, name }: { teamId: string; name: string }) => {
      const { error } = await authClient.organization.updateTeam({
        teamId,
        data: { name },
      })
      if (error) throw error
    },
    onSuccess: invalidateTeams,
  })

  const removeTeam = useMutation({
    mutationFn: async (teamId: string) => {
      const { error } = await authClient.organization.removeTeam({
        teamId,
        organizationId: organization.id,
      })
      if (error) throw error
    },
    onSuccess: invalidateTeams,
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <CreateTeamDialog
          organizationId={organization.id}
          onCreated={invalidateTeams}
        />
      </div>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamsQuery.data?.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="flex items-center gap-2">
                    {t.name}
                    {t.id === activeTeam.id && (
                      <Badge variant="secondary">current</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <RenameTeamDialog
                        teamId={t.id}
                        currentName={t.name}
                        onRename={(name) =>
                          renameTeam.mutate({ teamId: t.id, name })
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
                            <AlertDialogTitle>Delete {t.name}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This can&apos;t be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => removeTeam.mutate(t.id)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function CreateTeamDialog({
  organizationId,
  onCreated,
}: {
  organizationId: string
  onCreated: () => void
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setLoading(true)

    const { error: createError } = await authClient.organization.createTeam({
      name,
      organizationId,
    })

    setLoading(false)

    if (createError) {
      setError(createError.message ?? "Something went wrong.")
      return
    }

    setName("")
    setOpen(false)
    onCreated()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <PlusIcon data-icon="inline-start" />
        New team
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a team</DialogTitle>
          <DialogDescription>
            Teams are projects within your organization — data stays scoped
            to whichever team is active.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="team-name">Name</FieldLabel>
              <Input
                id="team-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </Field>
            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button type="submit" disabled={loading}>
              {loading ? <Spinner data-icon="inline-start" /> : null}
              Create team
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function RenameTeamDialog({
  currentName,
  onRename,
}: {
  teamId: string
  currentName: string
  onRename: (name: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(currentName)

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onRename(name)
    setOpen(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setName(currentName)
      }}
    >
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        Rename
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename team</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="rename-team">Name</FieldLabel>
              <Input
                id="rename-team"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
