export function add(a, b) {
  return a + b
}

export function twice(x) {
  return add(x, x)
}

function thrice(x) {
  return add(twice(x), x)
}

export function main() {
  return add(twice(3), thrice(2))
}
