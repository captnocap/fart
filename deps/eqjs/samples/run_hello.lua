local eqjs = require("eqjs_runtime")
local js = assert(io.open("samples/hello.js")):read("*a")

local cart = eqjs.from_js(js, {
  transpiler = "zig run eqjs_transpiler.zig --",
  label = "hello.eqjs",
})

print("main =", cart.exports.main())
cart:close()
