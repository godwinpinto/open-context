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

// Segments — named predicates over identities; the shared filter
// primitive for all modules.
export { coreSegment, coreSegmentIdentity } from "./segments/schema"
export {
  evaluateRules,
  explainRules,
  splitBucket,
  variantFor,
  type SegmentCondition,
  type SegmentOperator,
  type SegmentRules,
} from "./segments/rules"
export {
  SEGMENT_NAMESPACE,
  identityInSegments,
  segmentId,
} from "./segments/store"
export { segmentsAdminRouter } from "./segments/admin"
export type {
  CoreDatabase,
  IdentityAdminContext,
  IdentityConsumerContext,
} from "./identity/context"

// Portal tokens — stateless HMAC-signed, the 4th auth surface.
export {
  createPortalToken,
  verifyPortalToken,
  type PortalClaims,
  type PortalScope,
} from "./portal/tokens"
