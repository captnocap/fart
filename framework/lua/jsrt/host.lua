-- Host FFI globals — functions that bridge from the evaluator into Zig:
--   __hostCreate, __hostAppend, __hostUpdate, __hostRemove, __hostFlush,
--   __dispatchEvent, __hostMeasureText, ...
--
-- Thin wrappers over host-fns registered by framework/luajit_runtime.zig.
-- install(scope) registers them as bindings in the given scope.
--
-- STUB. Wired when the evaluator is ready to drive React's hostConfig.

local M = {}

function M.install(scope)
  -- TODO
end

return M
