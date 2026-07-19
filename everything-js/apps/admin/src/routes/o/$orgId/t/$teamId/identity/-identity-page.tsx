import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Badge } from "@open-context/ui/components/badge"
import { Button } from "@open-context/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@open-context/ui/components/card"
import { Input } from "@open-context/ui/components/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@open-context/ui/components/table"
import { Tabs, TabsList, TabsTrigger } from "@open-context/ui/components/tabs"
import { identityClient } from "@/lib/modules/identity-client"

export default function IdentityPage({
  teamId,
  initialKey,
}: {
  teamId: string
  initialKey?: string
}) {
  const [tab, setTab] = useState("identities")

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-medium">Identity</h1>
        <p className="text-muted-foreground text-sm">
          Who your product's usage is about — identities and their groups.
        </p>
      </div>
      <Tabs value={tab} onValueChange={(value) => value && setTab(value)}>
        <TabsList>
          <TabsTrigger value="identities">Identities</TabsTrigger>
          <TabsTrigger value="groups">Groups</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === "identities" && (
        <IdentitiesTab teamId={teamId} initialKey={initialKey} />
      )}
      {tab === "groups" && <GroupsTab teamId={teamId} />}
    </div>
  )
}

function IdentitiesTab({
  teamId,
  initialKey,
}: {
  teamId: string
  initialKey?: string
}) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [selectedKey, setSelectedKey] = useState<string | null>(
    initialKey ?? null,
  )

  const identitiesQuery = useQuery({
    queryKey: ["identities", teamId, search],
    queryFn: () =>
      identityClient.listIdentities({
        teamId,
        search: search || undefined,
      }),
  })
  const identities = identitiesQuery.data?.identities ?? []

  const detailQuery = useQuery({
    queryKey: ["identity-detail", teamId, selectedKey],
    queryFn: () =>
      identityClient.getIdentity({ teamId, key: selectedKey! }),
    enabled: !!selectedKey,
  })

  const remove = useMutation({
    mutationFn: (key: string) => identityClient.deleteIdentity({ teamId, key }),
    onSuccess: () => {
      setSelectedKey(null)
      queryClient.invalidateQueries({ queryKey: ["identities", teamId] })
    },
  })

  const detail = detailQuery.data

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-4">
          <Input
            className="max-w-xs"
            placeholder="Search by key…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {identities.length === 0 && !identitiesQuery.isLoading ? (
            <div className="flex flex-col gap-2">
              <p className="text-muted-foreground text-sm">
                No identities yet. Identify one with an API key scoped to this
                team:
              </p>
              <pre className="bg-muted overflow-x-auto rounded-md p-3 font-mono text-xs">
                {`curl -X POST ${window.location.origin}/api/identity/v1/identify \\
  -H "x-api-key: oc_sk_..." -H "Content-Type: application/json" \\
  -d '{"identity": "user-42", "set": {"plan": "pro"}, "setOnce": {"signup_date": "2026-07-19"}}'`}
              </pre>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Properties</TableHead>
                  <TableHead>First seen</TableHead>
                  <TableHead>Last seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {identities.map((identity) => (
                  <TableRow
                    key={identity.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedKey(identity.key)}
                  >
                    <TableCell className="font-mono font-medium">
                      {identity.key}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-64 truncate font-mono text-xs">
                      {JSON.stringify(identity.properties)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {new Date(identity.firstSeenAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {new Date(identity.lastSeenAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selectedKey && detail?.identity && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle className="font-mono">{detail.identity.key}</CardTitle>
              <Badge variant="secondary">{detail.identity.id.slice(0, 8)}…</Badge>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={() => remove.mutate(selectedKey)}
              >
                Delete
              </Button>
            </div>
            <CardDescription>
              Merged view: group properties under identity properties —
              identity wins.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div>
              <p className="mb-1 text-sm font-medium">Own properties</p>
              <pre className="bg-muted overflow-x-auto rounded-md p-3 font-mono text-xs">
                {JSON.stringify(detail.identity.properties, null, 2)}
              </pre>
            </div>
            {detail.merged && detail.merged.groups.length > 0 && (
              <>
                <div>
                  <p className="mb-1 text-sm font-medium">Groups</p>
                  <div className="flex flex-wrap gap-2">
                    {detail.merged.groups.map((group) => (
                      <Badge key={group.key} variant="secondary">
                        {group.key}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-sm font-medium">Merged properties</p>
                  <pre className="bg-muted overflow-x-auto rounded-md p-3 font-mono text-xs">
                    {JSON.stringify(detail.merged.properties, null, 2)}
                  </pre>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function GroupsTab({ teamId }: { teamId: string }) {
  const groupsQuery = useQuery({
    queryKey: ["identity-groups", teamId],
    queryFn: () => identityClient.listGroups({ teamId }),
  })
  const groups = groupsQuery.data?.groups ?? []

  return (
    <Card>
      <CardContent>
        {groups.length === 0 && !groupsQuery.isLoading ? (
          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground text-sm">
              No groups yet. Create one and attach identities:
            </p>
            <pre className="bg-muted overflow-x-auto rounded-md p-3 font-mono text-xs">
              {`curl -X POST ${window.location.origin}/api/identity/v1/group \\
  -H "x-api-key: oc_sk_..." -H "Content-Type: application/json" \\
  -d '{"group": "acme-corp", "set": {"tier": "enterprise"}}'

curl -X POST ${window.location.origin}/api/identity/v1/attach \\
  -H "x-api-key: oc_sk_..." -H "Content-Type: application/json" \\
  -d '{"identity": "user-42", "group": "acme-corp"}'`}
            </pre>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Properties</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => (
                <TableRow key={group.id}>
                  <TableCell className="font-mono font-medium">
                    {group.key}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-72 truncate font-mono text-xs">
                    {JSON.stringify(group.properties)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {new Date(group.createdAt).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
