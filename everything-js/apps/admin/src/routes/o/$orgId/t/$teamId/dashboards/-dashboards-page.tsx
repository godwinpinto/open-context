import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"

import { Button } from "@open-context/ui/components/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@open-context/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@open-context/ui/components/dialog"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@open-context/ui/components/field"
import { Input } from "@open-context/ui/components/input"
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

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Dashboards</h1>
          <p className="text-muted-foreground text-sm">
            Create a dashboard here, then add panels by talking to the MCP
            server (&quot;add a panel showing daily events by type&quot;).
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger
            render={(props) => <Button {...props}>Create dashboard</Button>}
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create dashboard</DialogTitle>
            </DialogHeader>
            <FieldGroup>
              <Field>
                <FieldLabel>Name</FieldLabel>
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Product Overview"
                />
              </Field>
              <Field>
                <FieldLabel>Group (optional)</FieldLabel>
                <Input
                  value={groupName}
                  onChange={(event) => setGroupName(event.target.value)}
                  placeholder="Shown as a collapsible section in the sidebar"
                />
              </Field>
              <Button
                onClick={() => create.mutate()}
                disabled={!name || create.isPending}
              >
                {create.isPending ? "Creating…" : "Create"}
              </Button>
            </FieldGroup>
          </DialogContent>
        </Dialog>
      </div>

      {dashboards.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No dashboards yet</CardTitle>
            <CardDescription>Create one to get started.</CardDescription>
          </CardHeader>
        </Card>
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
              </CardHeader>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive absolute top-3 right-3 z-10"
                onClick={() => remove.mutate(dashboard.id)}
              >
                Delete
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
