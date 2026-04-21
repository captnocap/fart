export function main() {
  const obj = eqjs.dict_object({ alpha: 2, beta: 3 })
  let penalty = 0
  if (eqjs.shape_kind(obj) !== "dynamic") {
    penalty = penalty + 100
  }
  eqjs.shape_hint(obj, { hot_reads: 2, hot_writes: 2 })

  let sum = 0
  let i = 0
  while (i < 3) {
    sum = sum + obj.alpha
    i = i + 1
  }

  obj.gamma = 5
  obj.delta = 6

  if (eqjs.shape_kind(obj) !== "shaped") {
    penalty = penalty + 200
  }

  return sum + obj.beta + obj.gamma + obj.delta + penalty
}
