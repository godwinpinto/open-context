import { useEffect, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
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
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@open-context/ui/components/field"
import { Checkbox } from "@open-context/ui/components/checkbox"
import { Input } from "@open-context/ui/components/input"
import {
  deleteClickHouseConnector,
  listTeamConnectors,
  saveClickHouseConnector,
  testClickHouseConnector,
} from "@/lib/connectors"

export const Route = createFileRoute("/o/$orgId/t/$teamId/manage/connectors")({
  component: ConnectorsPage,
})

function ConnectorsPage() {
  const { teamId } = Route.useParams()
  const queryClient = useQueryClient()

  const connectorsQuery = useQuery({
    queryKey: ["team-connectors", teamId],
    queryFn: () => listTeamConnectors({ data: { teamId } }),
  })
  const clickhouse = connectorsQuery.data?.clickhouse

  const [url, setUrl] = useState("")
  const [database, setDatabase] = useState("openmeter")
  const [username, setUsername] = useState("default")
  const [password, setPassword] = useState("")
  const [enabled, setEnabled] = useState(true)
  const [status, setStatus] = useState<string | null>(null)

  // Prefill from the saved connector (password stays blank — it's
  // never returned; leaving it blank on save keeps the stored one).
  useEffect(() => {
    if (clickhouse) {
      setUrl(clickhouse.url)
      setDatabase(clickhouse.database)
      setUsername(clickhouse.username)
      setEnabled(clickhouse.enabled)
    }
  }, [clickhouse])

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["team-connectors", teamId] })

  const save = useMutation({
    mutationFn: () =>
      saveClickHouseConnector({
        data: {
          teamId,
          url,
          database,
          username,
          password: password || undefined,
          enabled,
        },
      }),
    onSuccess: () => {
      setStatus("Saved.")
      setPassword("")
      invalidate()
    },
    onError: (error) => setStatus(error.message),
  })

  const test = useMutation({
    mutationFn: () => testClickHouseConnector({ data: { teamId } }),
    onSuccess: (result) =>
      setStatus(
        result.ok
          ? `Connected — ClickHouse ${result.version}. Table initialized.`
          : `Connection failed: ${result.error}`,
      ),
    onError: (error) => setStatus(error.message),
  })

  const remove = useMutation({
    mutationFn: () => deleteClickHouseConnector({ data: { teamId } }),
    onSuccess: () => {
      setStatus("Connector removed — this team is back on the built-in store.")
      setUrl("")
      setPassword("")
      invalidate()
    },
  })

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>ClickHouse</CardTitle>
          {clickhouse ? (
            clickhouse.enabled ? (
              <Badge>active</Badge>
            ) : (
              <Badge variant="secondary">disabled</Badge>
            )
          ) : (
            <Badge variant="secondary">not configured</Badge>
          )}
        </div>
        <CardDescription>
          Route this team's module events (Meter) to your own ClickHouse
          instead of the built-in store. Credentials are encrypted at rest
          and never shown again after saving.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="max-w-md"
          onSubmit={(event) => {
            event.preventDefault()
            save.mutate()
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="ch-url">URL</FieldLabel>
              <Input
                id="ch-url"
                placeholder="https://your-clickhouse:8123"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="ch-database">Database</FieldLabel>
              <Input
                id="ch-database"
                value={database}
                onChange={(event) => setDatabase(event.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="ch-username">Username</FieldLabel>
              <Input
                id="ch-username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="ch-password">
                Password{" "}
                {clickhouse?.hasPassword && (
                  <span className="text-muted-foreground font-normal">
                    (saved — leave blank to keep)
                  </span>
                )}
              </FieldLabel>
              <Input
                id="ch-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="off"
              />
            </Field>
            <Field orientation="horizontal">
              <Checkbox
                id="ch-enabled"
                checked={enabled}
                onCheckedChange={(checked) => setEnabled(checked === true)}
              />
              <FieldLabel htmlFor="ch-enabled" className="font-normal">
                Enabled — route events here
              </FieldLabel>
            </Field>
            {status && <p className="text-sm">{status}</p>}
            <Field orientation="horizontal">
              <Button type="submit" disabled={save.isPending}>
                Save
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={test.isPending || !clickhouse}
                onClick={() => test.mutate()}
              >
                Test & initialize
              </Button>
              {clickhouse && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate()}
                >
                  Remove
                </Button>
              )}
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
