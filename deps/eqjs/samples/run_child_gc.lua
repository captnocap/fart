local eqjs = require("eqjs_runtime")
local js = assert(io.open("samples/child_gc.js")):read("*a")

local cart = eqjs.from_js(js, {
  transpiler = "zig run eqjs_transpiler.zig --",
  label = "child.gc.root",
})

print("main =", cart.exports.main())
cart:close()
