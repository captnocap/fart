export function main() {
  let score = 0

  const a = eqjs.concat("eq", "js")
  if (a == "eqjs") {
    score = score + 1
  }

  const b = eqjs.concat(a, ":", "runtime")
  if (b == "eqjs:runtime") {
    score = score + 2
  }

  let built = ""
  let i = 0
  while (i < 8) {
    built = eqjs.concat(built, "x")
    i = i + 1
  }
  if (built == "xxxxxxxx") {
    score = score + 4
  }

  const c = eqjs.concat("hot", "-", "path")
  if (c == "hot-path") {
    score = score + 8
  }

  return score
}
