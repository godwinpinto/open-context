import { Link, useParams } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"

import { Badge } from "@open-context/ui/components/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@open-context/ui/components/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@open-context/ui/components/table"
import { trailClient } from "@/lib/modules/trail-client"

// CSR_ONLY_TRAIL_PAGE_MARKER — used to verify this chunk never lands
// in the server bundle.
export default function TrailPage({ teamId }: { teamId: string }) {
  const marker = "CSR_ONLY_TRAIL_PAGE_MARKER"
  const { orgId } = useParams({ strict: false }) as { orgId: string }

  const eventsQuery = useQuery({
    queryKey: ["trail-events", teamId],
    queryFn: () => trailClient.listEvents({ teamId }),
  })

  const statsQuery = useQuery({
    queryKey: ["trail-stats", teamId],
    queryFn: () => trailClient.stats({ teamId }),
  })

  const events = eventsQuery.data?.events ?? []

  return (
    <div className="flex flex-col gap-4" data-marker={marker}>
      <div className="flex items-center gap-2">
        <div>
          <h1 className="text-lg font-medium">Trail</h1>
          <p className="text-muted-foreground text-sm">
            Know what your users did.
          </p>
        </div>
        {statsQuery.data && (
          <Badge variant="secondary" className="ml-auto">
            {statsQuery.data.totalEvents} events
          </Badge>
        )}
      </div>

      {events.length === 0 && !eventsQuery.isLoading ? (
        <Card>
          <CardHeader>
            <CardTitle>No events yet</CardTitle>
            <CardDescription>
              Send your first event with an API key scoped to this team:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted overflow-x-auto rounded-md p-3 font-mono text-xs">
              {`curl -X POST ${window.location.origin}/api/trail/v1/capture \\
  -H "x-api-key: oc_sk_..." \\
  -H "Content-Type: application/json" \\
  -d '{"name": "signed_up", "distinctId": "user-42"}'`}
            </pre>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Distinct ID</TableHead>
                  <TableHead>Properties</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-medium">{event.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {event.distinctId ? (
                        // distinctId IS an identity key — link into the
                        // core Identity page.
                        <Link
                          to="/o/$orgId/t/$teamId/identity"
                          params={{ orgId, teamId }}
                          search={{ key: event.distinctId }}
                          className="underline-offset-4 hover:underline"
                        >
                          {event.distinctId}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-64 truncate font-mono text-xs">
                      {event.properties
                        ? JSON.stringify(event.properties)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(event.timestamp).toLocaleString()}
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
