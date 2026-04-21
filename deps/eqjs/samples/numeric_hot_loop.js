export function main() {
  let total = 0
  let i = 0
  while (i < 100000) {
    total = total + i
    i = i + 1
  }
  return total
}
