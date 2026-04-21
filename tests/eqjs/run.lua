package.path = table.concat({
  "./?.lua",
  "./?/init.lua",
  "./renderer/?.lua",
  "./runtime/?.lua",
  "./tests/eqjs/?.lua",
  package.path,
}, ";")

require("runtime.host").install()

local tests = {
  require("tests.eqjs.host_config_golden"),
  require("tests.eqjs.reconciler_smoke"),
  require("tests.eqjs.react_shim"),
  require("tests.eqjs.host_shim"),
  require("tests.eqjs.cursor_ide_smoke"),
  require("tests.eqjs.search_surface_smoke"),
  require("tests.eqjs.cursor_ide_dispatch_smoke"),
}

for _, test in ipairs(tests) do
  test()
end

print("eqjs: ok")
