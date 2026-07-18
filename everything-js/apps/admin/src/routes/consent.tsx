import { useEffect, useState } from "react"
import { createFileRoute, redirect } from "@tanstack/react-router"

import { Badge } from "@open-context/ui/components/badge"
import { Button } from "@open-context/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@open-context/ui/components/card"
import { authClient } from "@/lib/auth/client"
import { getServerSession } from "@/lib/auth/session"

export const Route = createFileRoute("/consent")({
  beforeLoad: async () => {
    const session = await getServerSession()
    if (!session) {
      throw redirect({ to: "/" })
    }
  },
  component: ConsentPage,
})

type PublicClient = {
  name?: string
  client_name?: string
  uri?: string
  client_uri?: string
}

function ConsentPage() {
  const [query, setQuery] = useState<string | null>(null)
  const [clientId, setClientId] = useState<string | null>(null)
  const [scopes, setScopes] = useState<string[]>([])
  const [client, setClient] = useState<PublicClient | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const rawQuery = window.location.search.slice(1)
    const params = new URLSearchParams(rawQuery)
    const id = params.get("client_id")
    const scope = params.get("scope") ?? ""

    setQuery(rawQuery)
    setClientId(id)
    setScopes(scope.split(" ").filter(Boolean))

    if (id) {
      fetch(`/api/auth/oauth2/public-client?client_id=${encodeURIComponent(id)}`)
        .then((res) => (res.ok ? (res.json() as Promise<PublicClient>) : null))
        .then(setClient)
        .catch(() => setClient(null))
    }
  }, [])

  async function respond(accept: boolean) {
    if (!query) return
    setError(null)
    setLoading(true)
    const { error } = await authClient.oauth2.consent({
      accept,
      scope: scopes.join(" "),
      oauth_query: query,
    })
    setLoading(false)
    if (error) {
      setError(error.message ?? "Something went wrong. Please try again.")
    }
  }

  const clientName = client?.name ?? client?.client_name ?? clientId ?? "This application"

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Authorize {clientName}</CardTitle>
          <CardDescription>
            This application is requesting access to your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {scopes.length > 0 ? (
              scopes.map((scope) => (
                <Badge key={scope} variant="secondary">
                  {scope}
                </Badge>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">
                No specific permissions requested.
              </p>
            )}
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            disabled={loading}
            onClick={() => respond(false)}
          >
            Deny
          </Button>
          <Button className="flex-1" disabled={loading} onClick={() => respond(true)}>
            Allow
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
