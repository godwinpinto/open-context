import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { LayoutDashboardIcon, PlusIcon, Trash2Icon } from "lucide-react"

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
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@open-context/ui/components/card"
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
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@open-context/ui/components/empty"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@open-context/ui/components/field"
import { Input } from "@open-context/ui/components/input"
import { Spinner } from "@open-context/ui/components/spinner"
import { dashboardsClient } from "@/lib/modules/dashboards-client"

export default function DashboardsPage({
  orgId,
  teamId,
}: {
  orgId: string
  teamId: string
}) {
  const queryClient = useQueryClient()
  const dashboardsQuery = useQuery({
    queryKey: ["dashboards", teamId],
    queryFn: () => dashboardsClient.listDashboards({ teamId }),
  })
  const dashboards = dashboardsQuery.data?.dashboards ?? []

  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState("")
  const [groupName, setGroupName] = useState("")
  const create = useMutation({
    mutationFn: () =>
      dashboardsClient.createDashboard({
        teamId,
        name,
        ...(groupName.trim() ? { groupName: groupName.trim() } : {}),
      }),
    onSuccess: () => {
      setName("")
      setGroupName("")
      setCreateOpen(false)
      queryClient.invalidateQueries({ queryKey: ["dashboards", teamId] })
    },
  })
  const remove = useMutation({
    mutationFn: (id: string) => dashboardsClient.deleteDashboard({ teamId, id }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["dashboards", teamId] }),
  })

  const createDialog = (
    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
      <DialogTrigger
        render={(props) => (
          <Button {...props}>
            <PlusIcon data-icon="inline-start" />
            Create dashboard
          </Button>
        )}
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create dashboard</DialogTitle>
          <DialogDescription>
            Panels are added afterwards by talking to the MCP server.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="dashboard-name">Name</FieldLabel>
            <Input
              id="dashboard-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Product Overview"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="dashboard-group">Group (optional)</FieldLabel>
            <Input
              id="dashboard-group"
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
            />
            <FieldDescription>
              Shown as a collapsible section in the sidebar.
            </FieldDescription>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button
            onClick={() => create.mutate()}
            disabled={!name || create.isPending}
          >
            {create.isPending ? <Spinner data-icon="inline-start" /> : null}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold">Dashboards</h1>
          <p className="text-muted-foreground text-sm">
            Create a dashboard here, then add panels by talking to the MCP
            server (&quot;add a panel showing daily events by type&quot;).
          </p>
        </div>
        {createDialog}
      </div>

      {dashboards.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LayoutDashboardIcon />
            </EmptyMedia>
            <EmptyTitle>No dashboards yet</EmptyTitle>
            <EmptyDescription>Create one to get started.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dashboards.map((dashboard) => (
            <Card key={dashboard.id} className="relative">
              <CardHeader>
                <CardTitle className="text-base">
                  <Link
                    to="/o/$orgId/t/$teamId/dashboards/$dashboardId"
                    params={{ orgId, teamId, dashboardId: dashboard.id }}
                    className="after:absolute after:inset-0"
                  >
                    {dashboard.name}
                  </Link>
                </CardTitle>
                <CardDescription>
                  {dashboard.layout.length} panel
                  {dashboard.layout.length === 1 ? "" : "s"}
                  {dashboard.groupName ? ` · ${dashboard.groupName}` : ""}
                </CardDescription>
                <CardAction>
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={(props) => (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Delete ${dashboard.name}`}
                          className="relative"
                          {...props}
                        >
                          <Trash2Icon />
                        </Button>
                      )}
                    />
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Delete &quot;{dashboard.name}&quot;?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Its panels, queries, and share links are deleted too.
                          This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => remove.mutate(dashboard.id)}
                        >
                          Delete dashboard
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardAction>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
