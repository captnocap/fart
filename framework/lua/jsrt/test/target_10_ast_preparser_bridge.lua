-- Target 10: AST pre-parser bridge.
--
-- Runs the real build pipeline: a .js file → acorn (via scripts/build-jsast.mjs)
-- → .lua file containing the AST as a table literal → JSRT loads + executes.
--
-- This is the first target that exercises actual JS source rather than a
-- hand-written AST. Before this target, the evaluator was proven. After this
-- target, the evaluator is proven to work end-to-end from real JS.

package.path = package.path .. ";./?.lua;./?/init.lua"

local JSRT = require("framework.lua.jsrt.init")

-- Regenerate the AST from JS source.
local here = debug.getinfo(1, "S").source:sub(2):match("(.+)/[^/]+$") or "."
local src  = here .. "/target_10_source.js"
local out  = here .. "/target_10_source.ast.lua"

-- Use os.execute; in LuaJIT this returns the exit status directly.
local build_cmd = string.format('node scripts/build-jsast.mjs %q %q', src, out)
local ok = os.execute(build_cmd)
-- Lua 5.1 returns exit code; LuaJIT may return true/false+status. Accept both.
assert(ok == 0 or ok == true, "build-jsast.mjs failed (exit status: " .. tostring(ok) .. ")")

-- Load the AST table from the generated file.
local loader = assert(loadfile(out), "failed to load generated AST: " .. out)
local ast = loader()
assert(type(ast) == "table" and ast.type == "Program", "loaded AST is not a Program")

local result = JSRT.run(ast)
assert(result == 10, "reduce over [1,2,3,4] expected 10, got " .. tostring(result))

print("target_10_ast_preparser_bridge: ok")
