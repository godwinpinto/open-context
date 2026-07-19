// OpenCtx Experiments — A/B testing module (PostHog/GrowthBook-style
// subset). Sticky variant assignment via core's frozen variantFor,
// server-side exposure recording, explicit goal reporting (POST /goal
// — self-contained, no Trail dependency), and a results engine with
// Bayesian chance-to-win, frequentist p-values, and SRM detection.
export { experimentsAdminRouter } from "./admin"
export { experimentsConsumerRouter } from "./consumer"
export {
  chanceToBeatControl,
  srmPValue,
  twoProportionPValue,
} from "./stats"
export type {
  ExperimentsAdminContext,
  ExperimentsConsumerContext,
  ModuleDatabase,
} from "./context"

export const experimentsModule = {
  id: "experiments",
  name: "Experiments",
  description: "A/B test features with real statistics.",
} as const
