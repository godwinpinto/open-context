import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/o/$orgId/t/$teamId/account/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/o/$orgId/t/$teamId/account/profile",
      params,
    })
  },
})
