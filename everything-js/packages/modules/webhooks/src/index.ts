// OpenCtx Webhooks — Svix-inspired webhooks-as-a-service module.
// Thin routers over the core webhook engine (@open-context/core
// webhooks/*): the tables (oc_webhook_*), Standard Webhooks signing,
// publish/deliver/retry logic all live in core so platform
// notifications can share them. This module is the team-facing API:
//   consumer — send events, manage endpoints for their customers
//   admin    — dashboard CRUD, delivery log, replay, manual sweep
// No cron: first attempt inline (waitUntil), retries swept on traffic
// and from the dashboard.
export { webhooksAdminRouter } from "./admin"
export { webhooksConsumerRouter } from "./consumer"
export type {
  ModuleDatabase,
  WebhooksAdminContext,
  WebhooksConsumerContext,
} from "./context"

export const webhooksModule = {
  id: "webhooks",
  name: "Webhooks",
  description: "Send signed webhooks to your customers' endpoints.",
} as const
