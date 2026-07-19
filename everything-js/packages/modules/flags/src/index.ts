// OpenCtx Flags — feature flags module (Flagsmith-inspired). Flags
// are defined per team; state is per environment (an API key IS an
// environment key via metadata.environment). Evaluation precedence:
// identity override → segment overrides (priority) → env default.
// Percentage rollouts come from segments (split conditions);
// multivariate testing is the Experiments module.
export { flagsAdminRouter } from "./admin"
export { flagsConsumerRouter } from "./consumer"
export { evaluateFlags, type FlagResult } from "./evaluate"
export type {
  FlagsAdminContext,
  FlagsConsumerContext,
  ModuleDatabase,
} from "./context"

export const flagsModule = {
  id: "flags",
  name: "Flags",
  description: "Feature flags with environments and targeting.",
} as const
