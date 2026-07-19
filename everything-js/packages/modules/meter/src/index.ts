// OpenCtx Meter — usage metering module (OpenMeter-inspired subset).
// Contributes:
//   - schema fragments (./schema — meter_event mirrors OpenMeter's
//     ClickHouse om_events layout for the future connector swap)
//   - EventStore interface + D1 implementation (./store) — the host
//     picks the store per team (D1 today, ClickHouse connector later)
//   - admin router  (meters/features/entitlements CRUD, meter query)
//   - consumer router (event ingest, entitlement value check, usage delta)
export { meterAdminRouter } from "./admin"
export { meterConsumerRouter } from "./consumer"
export { createD1EventStore } from "./store"
export {
  createClickHouseEventStore,
  type ClickHouseStoreConfig,
} from "./clickhouse"
export type {
  Aggregation,
  AggregateRow,
  EventStore,
  WindowSize,
} from "./store"
export type {
  MeterAdminContext,
  MeterConsumerContext,
  ModuleDatabase,
} from "./context"
export type { EntitlementValue } from "./value"

export const meterModule = {
  id: "meter",
  name: "Meter",
  description: "Usage metering and entitlements.",
} as const
