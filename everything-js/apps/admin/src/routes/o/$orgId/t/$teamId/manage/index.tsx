import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/o/$orgId/t/$teamId/manage/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/o/$orgId/t/$teamId/manage/members",
      params,
    })
  },
})
