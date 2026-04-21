export function main() {
  const xs = new Float64Array(4)
  xs[0] = 1
  xs[1] = 2
  xs[2] = 3
  xs[3] = 4

  let total = 0
  let i = 0
  while (i < 100000) {
    total = total + xs[i % 4]
    i = i + 1
  }
  return total
}
