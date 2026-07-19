// Results statistics — the same two lenses PostHog/GrowthBook lead
// with: Bayesian chance-to-win (primary) and a frequentist
// two-proportion z-test (secondary), plus SRM detection.

// Box-Muller standard normal.
function randomNormal(): number {
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

// Marsaglia–Tsang gamma sampler (shape >= 1 via boost for < 1).
function randomGamma(shape: number): number {
  if (shape < 1) {
    return randomGamma(shape + 1) * Math.pow(Math.random(), 1 / shape)
  }
  const d = shape - 1 / 3
  const c = 1 / Math.sqrt(9 * d)
  for (;;) {
    let x: number
    let v: number
    do {
      x = randomNormal()
      v = 1 + c * x
    } while (v <= 0)
    v = v * v * v
    const u = Math.random()
    if (u < 1 - 0.0331 * x * x * x * x) return d * v
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v
  }
}

function randomBeta(alpha: number, beta: number): number {
  const x = randomGamma(alpha)
  const y = randomGamma(beta)
  return x / (x + y)
}

// P(variant conversion rate > control conversion rate) under
// Beta(1 + conversions, 1 + failures) posteriors (uniform prior).
export function chanceToBeatControl(
  control: { exposures: number; conversions: number },
  variant: { exposures: number; conversions: number },
  samples = 5000,
): number {
  let wins = 0
  for (let index = 0; index < samples; index++) {
    const pControl = randomBeta(
      1 + control.conversions,
      1 + control.exposures - control.conversions,
    )
    const pVariant = randomBeta(
      1 + variant.conversions,
      1 + variant.exposures - variant.conversions,
    )
    if (pVariant > pControl) wins++
  }
  return wins / samples
}

function normalCdf(z: number): number {
  // Abramowitz–Stegun approximation.
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp((-z * z) / 2)
  let probability =
    d *
    t *
    (0.3193815 +
      t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  if (z > 0) probability = 1 - probability
  return probability
}

// Two-proportion z-test p-value (two-tailed).
export function twoProportionPValue(
  control: { exposures: number; conversions: number },
  variant: { exposures: number; conversions: number },
): number | null {
  const n1 = control.exposures
  const n2 = variant.exposures
  if (n1 === 0 || n2 === 0) return null
  const p1 = control.conversions / n1
  const p2 = variant.conversions / n2
  const pooled = (control.conversions + variant.conversions) / (n1 + n2)
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2))
  if (se === 0) return null
  const z = (p2 - p1) / se
  return 2 * (1 - normalCdf(Math.abs(z)))
}

// Sample Ratio Mismatch: chi-square goodness-of-fit of observed
// exposures vs configured weights. A tiny p-value means assignment is
// broken (biased exposure logging, targeting bugs) and results can't
// be trusted.
export function srmPValue(
  observed: number[],
  weights: number[],
): number | null {
  const total = observed.reduce((sum, count) => sum + count, 0)
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0)
  if (total < 20 || weightTotal === 0) return null

  let chiSquare = 0
  for (let index = 0; index < observed.length; index++) {
    const expected = (weights[index] / weightTotal) * total
    if (expected === 0) continue
    chiSquare += ((observed[index] - expected) ** 2) / expected
  }
  const degreesOfFreedom = observed.length - 1
  return 1 - chiSquareCdf(chiSquare, degreesOfFreedom)
}

// Chi-square CDF via the regularized lower incomplete gamma (series
// expansion — fine for the small dof we use).
function chiSquareCdf(x: number, k: number): number {
  if (x <= 0) return 0
  const a = k / 2
  const halfX = x / 2
  let sum = 1 / a
  let term = sum
  for (let n = 1; n < 200; n++) {
    term *= halfX / (a + n)
    sum += term
    if (term < 1e-12) break
  }
  const logResult = a * Math.log(halfX) - halfX - logGamma(a) + Math.log(sum)
  return Math.min(1, Math.exp(logResult))
}

function logGamma(x: number): number {
  // Lanczos approximation.
  const g = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5,
  ]
  let sum = 1.000000000190015
  for (let index = 0; index < 6; index++) {
    sum += g[index] / (x + index + 1)
  }
  return (
    (x + 0.5) * Math.log(x + 5.5) -
    (x + 5.5) +
    Math.log((2.5066282746310005 * sum) / x)
  )
}
