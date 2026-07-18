import { createFileRoute } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Badge } from "@open-context/ui/components/badge"
import { Button } from "@open-context/ui/components/button"
import { Card, CardContent } from "@open-context/ui/components/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@open-context/ui/components/table"
import { getUserOAuthConsents, revokeUserOAuthConsent } from "@/lib/auth/account"

export const Route = createFileRoute(
  "/o/$orgId/t/$teamId/account/connected-apps",
)({
  component: ConnectedAppsPage,
})

const CONSENTS_QUERY_KEY = ["user-oauth-consents"]

function ConnectedAppsPage() {
  const queryClient = useQueryClient()

  const consentsQuery = useQuery({
    queryKey: CONSENTS_QUERY_KEY,
    queryFn: () => getUserOAuthConsents(),
  })

  const revoke = useMutation({
    mutationFn: (id: string) => revokeUserOAuthConsent({ data: { id } }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: CONSENTS_QUERY_KEY }),
  })

  const consents = consentsQuery.data ?? []

  return (
    <Card>
      <CardContent>
        {consents.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No applications have been granted access to your account.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Application</TableHead>
                <TableHead>Scopes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {consents.map((consent) => (
                <TableRow key={consent.id}>
                  <TableCell className="font-medium">
                    {consent.clientName}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {consent.scopes.map((scope) => (
                        <Badge key={scope} variant="secondary">
                          {scope}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => revoke.mutate(consent.id)}
                    >
                      Revoke
                    </Button>
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
