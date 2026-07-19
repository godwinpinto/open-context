// @open-context/core — platform substrate shared by the host and all
// modules. First concern: IDENTITY (identities + groups with property
// ops). Modules reference identities loosely by (teamId, key) and may
// import the store helpers directly (getMergedProperties etc.) — core
// is below modules in the dependency graph, so this never creates
// module↔module coupling.
export {
  coreGroup,
  coreIdentity,
  coreIdentityGroup,
} from "./identity/schema"
export {
  GROUP_NAMESPACE,
  IDENTITY_NAMESPACE,
  groupId,
  identityId,
  uuidv5,
} from "./identity/ids"
export { applyOps, type PropertyOps } from "./identity/ops"
export {
  attachIdentityToGroup,
  getMergedProperties,
  upsertGroup,
  upsertIdentity,
} from "./identity/store"
export { identityConsumerRouter } from "./identity/consumer"
export { identityAdminRouter } from "./identity/admin"
export type {
  CoreDatabase,
  IdentityAdminContext,
  IdentityConsumerContext,
} from "./identity/context"
