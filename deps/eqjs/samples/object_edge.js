export function main() {
  const obj = {
    alpha: 1,
    2: 2,
    return: 3,
    "z": 4,
    if: 5
  }

  return obj.alpha + obj[2] + obj["return"] + obj["z"] + obj["if"]
}
