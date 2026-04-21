export function main() {
  const obj = eqjs.object()
  obj[1] = 10
  obj[2] = 20
  obj.extra = 7

  const shaped = eqjs.promote_shape(obj)
  return shaped[1] + shaped[2] + shaped.extra
}
