export function main() {
  function make_adder(base) {
    function add(x) {
      return base + x
    }
    return add(5)
  }

  return make_adder(10)
}
