export function main() {
  const obj = eqjs.dict_object({ alpha: 2, beta: 3 })

  let total = 0
  let i = 0
  while (i < 6) {
    total = total + obj.alpha
    i = i + 1
  }

  obj.gamma = 8
  obj.delta = 1

  return total + obj.beta + obj.gamma + obj.delta
}
