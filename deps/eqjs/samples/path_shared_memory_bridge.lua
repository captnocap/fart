local eqjs = require("eqjs_runtime")

local function load_file(path)
  local f = assert(io.open(path, "r"))
  local data = f:read("*a")
  f:close()
  return data
end

local js = load_file("samples/shared_memory_bridge.js")
local path = assert(os.getenv("EQJS_SHARED_COMMANDS_PATH"))
local len = tonumber(assert(os.getenv("EQJS_SHARED_COMMANDS_LEN")))

local cart = eqjs.from_js(js, {
  transpiler = os.getenv("EQJS_TRANSPILER") or "zig run eqjs_transpiler.zig --",
  label = "path.shared_memory_bridge",
  shared_memory = {
    commands = {
      typename = "int32_t",
      path = path,
      len = len,
    },
  },
})

print("main =", cart.exports.main())
cart:close()
