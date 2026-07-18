import { createFileRoute } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { UAParser } from "ua-parser-js"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { authClient } from "@/lib/auth/client"
import { getUserSessions, revokeOtherUserSessions, revokeUserSession } from "@/lib/auth/account"

export const Route = createFileRoute("/o/$orgId/t/$teamId/account/sessions")({
  component: SessionsPage,
})

const SESSIONS_QUERY_KEY = ["user-sessions"]

function describeDevice(userAgent: string | null | undefined) {
  if (!userAgent) return "Unknown device"
  const { browser, os } = new UAParser(userAgent).getResult()
  const label = [browser.name, os.name].filter(Boolean).join(" on ")
  return label || "Unknown device"
}

function SessionsPage() {
  const { data: currentSession } = authClient.useSession()
  const queryClient = useQueryClient()

  const sessionsQuery = useQuery({
    queryKey: SESSIONS_QUERY_KEY,
    queryFn: () => getUserSessions(),
  })

  function invalidateSessions() {
    return queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY })
  }

  const revoke = useMutation({
    mutationFn: (token: string) => revokeUserSession({ data: { token } }),
    onSuccess: invalidateSessions,
  })

  const revokeOthers = useMutation({
    mutationFn: () => revokeOtherUserSessions(),
    onSuccess: invalidateSessions,
  })

  const sessions = sessionsQuery.data ?? []
  const hasOtherSessions = sessions.some(
    (session) => session.token !== currentSession?.session.token,
  )

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            disabled={!hasOtherSessions || revokeOthers.isPending}
            onClick={() => revokeOthers.mutate()}
          >
            Sign out of all other devices
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Device</TableHead>
              <TableHead>IP address</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.map((session) => {
              const isCurrent = session.token === currentSession?.session.token
              return (
                <TableRow key={session.id}>
                  <TableCell className="flex items-center gap-2">
                    {describeDevice(session.userAgent)}
                    {isCurrent && (
                      <Badge variant="secondary">this device</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {session.ipAddress ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(session.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {!isCurrent && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => revoke.mutate(session.token)}
                      >
                        Revoke
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
  )
}
