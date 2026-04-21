export function mix(a, b) {
  let total = a + b
  let nums = new Float64Array(3)
  nums[0] = 1.0
  nums[1] = 2.0
  nums[2] = 3.0
  let idx = 0
  let acc = 0
  while (idx < 3) {
    acc = acc + nums[idx]
    idx = idx + 1
  }
  return acc + total
}

export function main() {
  return mix(2, 3)
}
