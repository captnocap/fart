export function main() {
  const stable = { alpha: 2, beta: 3 }
  const dyn = eqjs.object()

  dyn[stable.alpha] = stable.beta
  dyn[stable.alpha + stable.beta] = stable.alpha + stable.beta

  return stable.alpha + stable.beta + dyn[2] + dyn[5]
}
