export function main() {
  function make_counter(seed) {
    let total = seed

    function step(delta) {
      total = total + delta
      return total
    }

    return step
  }

  const counter = make_counter(10)
  let i = 0
  let sum = 0
  while (i < 3) {
    let captured = i
    function apply() {
      return counter(captured)
    }
    sum = sum + apply()
    i = i + 1
  }

  return sum
}
