local ffi = require("ffi")
local eqjs = require("eqjs_runtime")

local function load_file(path)
  local f = assert(io.open(path, "r"))
  local data = f:read("*a")
  f:close()
  return data
end

local function shell_quote(value)
  return "'" .. tostring(value):gsub("'", "'\\''") .. "'"
end

local function file_exists(path)
  local f = io.open(path, "r")
  if f then
    f:close()
    return true
  end
  return false
end

local function resolve_transpiler()
  local override = os.getenv("EQJS_TRANSPILER")
  if override and #override > 0 then
    return override
  end
  if file_exists("./eqjs_transpiler") then
    return "./eqjs_transpiler"
  end
  return "zig run eqjs_transpiler.zig --"
end

local TRANSPILER = resolve_transpiler()

local function fail(message)
  error("matrix failure: " .. message, 0)
end

local function assert_eq(name, got, expected)
  if got ~= expected then
    fail(string.format("%s expected %s, got %s", name, tostring(expected), tostring(got)))
  end
end

local function assert_raises(name, fn)
  local ok, err = pcall(fn)
  if ok then
    fail(name .. " expected failure, got success")
  end
  return err
end

local function run_case(name, path, label, expected)
  local js = load_file(path)
  local cart = eqjs.from_js(js, {
    transpiler = TRANSPILER,
    label = label,
  })

  local ok, result = pcall(function()
    return cart.exports.main()
  end)
  cart:close()

  if not ok then
    fail(name .. " failed: " .. tostring(result))
  end
  assert_eq(name, result, expected)
  print(name .. " =", result)
end

local function run_timed_case(name, path, label, expected)
  local js = load_file(path)
  local cart = eqjs.from_js(js, {
    transpiler = TRANSPILER,
    label = label,
  })

  local t0 = os.clock()
  local ok, result = pcall(function()
    return cart.exports.main()
  end)
  local elapsed_ms = (os.clock() - t0) * 1000
  cart:close()

  if not ok then
    fail(name .. " failed: " .. tostring(result))
  end
  assert_eq(name, result, expected)
  print(string.format("%s = %s (%.3f ms)", name, tostring(result), elapsed_ms))
end

local function run_parent_close_case()
  local parent = eqjs.from_js([[
export function main() {
  return 1
}
]], {
    transpiler = TRANSPILER,
    label = "parent.close.root",
  })

  local child = parent:spawn_child([[
export function ping() {
  return 42
}
]], {
    label = "parent.close.child",
  })

  local ping = child.exports.ping
  parent:close()

  assert_raises("parent-close case should have invalidated child export", function()
    return ping()
  end)

  print("parent_close =", "ok")
end

local function run_transpiler_error_case()
  local bad_js = "samples/bad_syntax.js"
  local out_path = os.tmpname() .. ".lua"
  local err_path = os.tmpname() .. ".txt"
  local cmd = table.concat({
    TRANSPILER,
    shell_quote(bad_js),
    shell_quote(out_path),
    ">",
    shell_quote(err_path),
    "2>&1",
  }, " ")
  local ok, _, _ = os.execute(cmd)
  if ok == true or ok == 0 then
    fail("expected transpiler failure for malformed input")
  end

  local err = load_file(err_path)
  if err:find("EQJS parse error", 1, true) == nil then
    fail("expected useful parse error output")
  end
  if err:find("bad_syntax.js", 1, true) == nil then
    fail("expected source filename in parse error output")
  end
  print("bad_syntax =", "ok")
end

local function run_shared_memory_case()
  local js = load_file("samples/shared_memory_bridge.js")
  local commands = ffi.new("int32_t[?]", 16)
  local cart = eqjs.from_js(js, {
    transpiler = TRANSPILER,
    label = "matrix.shared_memory_bridge",
    shared_memory = {
      commands = {
        typename = "int32_t",
        ptr = commands,
        len = 16,
      },
    },
  })

  local ok, result = pcall(function()
    return cart.exports.main()
  end)
  cart:close()

  if not ok then
    fail("shared_memory_bridge failed: " .. tostring(result))
  end
  assert_eq("shared_memory_bridge", result, 180)
  assert_eq("shared_memory_bridge[0]", commands[0], 1)
  assert_eq("shared_memory_bridge[4]", commands[4], 40)
  assert_eq("shared_memory_bridge[8]", commands[8], 2)
  assert_eq("shared_memory_bridge[12]", commands[12], 80)
  print("shared_memory_bridge =", result)
end

local function main()
  run_case("hello", "samples/hello.js", "matrix.hello", 11)
  run_timed_case("numeric_hot_loop", "samples/numeric_hot_loop.js", "matrix.numeric_hot_loop", 4999950000)
  run_case("typed_array_hot_loop", "samples/typed_array_hot_loop.js", "matrix.typed_array_hot_loop", 250000)
  run_case("string_heavy", "samples/string_heavy.js", "matrix.string_heavy", 15)
  run_case("object_edge", "samples/object_edge.js", "matrix.object_edge", 15)
  run_case("closure_deep", "samples/closure_deep.js", "matrix.closure_deep", 34)
  run_case("module_three", "samples/module_three.js", "matrix.module_three", 12)
  run_case("child_gc", "samples/child_gc.js", "matrix.child_gc", 42)
  run_case("closure", "samples/closure.js", "matrix.closure", 15)
  run_case("dynamic_object", "samples/dynamic_object.js", "matrix.dynamic_object", 13)
  run_case("auto_promote", "samples/auto_promote.js", "matrix.auto_promote", 24)
  run_case("promote_shape", "samples/promote_shape.js", "matrix.promote_shape", 37)
  run_case("shape_hint", "samples/shape_hint.js", "matrix.shape_hint", 20)
  run_shared_memory_case()
  run_parent_close_case()
  run_transpiler_error_case()
end

local ok, err = pcall(main)
if ok then
  print("matrix: ok")
else
  io.stderr:write("matrix: fail: " .. tostring(err) .. "\n")
  os.exit(1)
end
