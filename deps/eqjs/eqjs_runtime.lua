local ffi = require("ffi")
local bit = bit or bit32

ffi.cdef([[
typedef long ssize_t;
typedef long off_t;
int open(const char *pathname, int flags, ...);
int close(int fd);
int ftruncate(int fd, off_t length);
void *mmap(void *addr, size_t length, int prot, int flags, int fd, off_t offset);
int munmap(void *addr, size_t length);
]])

local C = ffi.C

local Runtime = {}
Runtime.__index = Runtime
Runtime._next_instance_id = 0

local function next_instance_id()
  Runtime._next_instance_id = Runtime._next_instance_id + 1
  return Runtime._next_instance_id
end

local function shell_quote(value)
  if value == nil then
    return "''"
  end
  return "'" .. tostring(value):gsub("'", "'\\''") .. "'"
end

local function normalize_typename(name)
  if name == nil then return nil end
  local map = {
    Float64Array = "double",
    Float32Array = "float",
    Int32Array = "int32_t",
    Uint32Array = "uint32_t",
    Int16Array = "int16_t",
    Uint16Array = "uint16_t",
    Int8Array = "int8_t",
    Uint8Array = "uint8_t",
    Uint8ClampedArray = "uint8_t",
    double = "double",
    float = "float",
    int32_t = "int32_t",
    uint32_t = "uint32_t",
    int16_t = "int16_t",
    uint16_t = "uint16_t",
    int8_t = "int8_t",
    uint8_t = "uint8_t",
  }
  return map[name] or map[tostring(name)]
end

local O_RDWR = 2
local O_CREAT = 64
local O_TRUNC = 512
local PROT_READ = 1
local PROT_WRITE = 2
local MAP_SHARED = 1
local MAP_FAILED = ffi.cast("void *", -1)

local typed_array_mt = {}

function typed_array_mt.__index(self, key)
  if key == "raw" then
    return self._raw
  end
  if key == "len" or key == "length" then
    return self._len
  end
  if key == "ffi_type" then
    return self._ctype
  end
  if type(key) == "number" then
    if key < 0 or key >= self._len then
      return nil
    end
    return self._raw[key]
  end
  return rawget(typed_array_mt, key) or rawget(self, key)
end

function typed_array_mt.__newindex(self, key, value)
  if type(key) == "number" then
    if key < 0 then
      error("typed array index must be >= 0 in EQJS view", 2)
    end
    if key >= self._len then
      error("typed array index out of range", 2)
    end
    self._raw[key] = value
    return
  end
  rawset(self, key, value)
end

function typed_array_mt.__len(self)
  return self._len
end

function typed_array_mt.__pairs(self)
  local i = -1
  return function()
    i = i + 1
    if i >= self._len then
      return nil
    end
    return i, self._raw[i]
  end
end

function typed_array_mt.__ipairs(self)
  local i = -1
  return function()
    i = i + 1
    if i >= self._len then
      return nil
    end
    return i, self._raw[i]
  end
end

local dynamic_object_mt = {}

local function dynamic_object_is_promotable(data)
  local count = 0
  for key, _ in pairs(data) do
    if type(key) ~= "string" then
      return false
    end
    count = count + 1
    if count > 12 then
      return false
    end
  end
  return count > 0
end

local function dynamic_object_promote_in_place(self)
  local data = rawget(self, "_data")
  if data == nil or not dynamic_object_is_promotable(data) then
    return false
  end

  for key, value in pairs(data) do
    rawset(self, key, value)
  end
  rawset(self, "_data", nil)
  rawset(self, "_reads", nil)
  rawset(self, "_writes", nil)
  rawset(self, "_shape_hot_reads", nil)
  rawset(self, "_shape_hot_writes", nil)
  rawset(self, "_shape_forced", nil)
  rawset(self, "_shape_pinned", nil)
  setmetatable(self, nil)
  return true
end

local function dynamic_object_maybe_promote(self)
  local data = rawget(self, "_data")
  if data == nil then
    return false
  end

  if rawget(self, "_shape_pinned") then
    return false
  end

  if rawget(self, "_shape_forced") then
    return dynamic_object_promote_in_place(self)
  end

  local reads = rawget(self, "_reads") or 0
  local writes = rawget(self, "_writes") or 0
  local hot_reads = rawget(self, "_shape_hot_reads") or 6
  local hot_writes = rawget(self, "_shape_hot_writes") or 4
  if dynamic_object_is_promotable(data) and (reads >= hot_reads or writes >= hot_writes) then
    return dynamic_object_promote_in_place(self)
  end
  return false
end

function dynamic_object_mt.__index(self, key)
  local data = rawget(self, "_data")
  if data ~= nil then
    local value = data[key]
    local reads = (rawget(self, "_reads") or 0) + 1
    rawset(self, "_reads", reads)
    dynamic_object_maybe_promote(self)
    return value
  end
  return rawget(dynamic_object_mt, key)
end

function dynamic_object_mt.__newindex(self, key, value)
  local data = rawget(self, "_data")
  if data ~= nil then
    data[key] = value
    local writes = (rawget(self, "_writes") or 0) + 1
    rawset(self, "_writes", writes)
    dynamic_object_maybe_promote(self)
    return
  end
  rawset(self, key, value)
end

function dynamic_object_mt.__pairs(self)
  local data = rawget(self, "_data") or {}
  return pairs(data)
end

function dynamic_object_mt.__len(self)
  local data = rawget(self, "_data") or {}
  return #data
end

local function make_typed_array(owner, typename, size_or_init)
  local ctype = normalize_typename(typename)
  if not ctype then
    error("unknown typed array typename: " .. tostring(typename))
  end
  local n = 0
  local init = nil

  if type(size_or_init) == "number" then
    n = size_or_init
  elseif type(size_or_init) == "table" then
    init = size_or_init
    n = #init
  else
    error("expected number or initializer table for typed array")
  end

  local data = ffi.new(ctype .. "[?]", n)
  if init then
    local i = 1
    while i <= n do
      data[i - 1] = tonumber(init[i]) or 0
      i = i + 1
    end
  end

  local value = {
    _raw = data,
    _len = n,
    _ctype = ctype,
  }

  if owner and owner._ffi_refs then
    owner._ffi_refs[#owner._ffi_refs + 1] = value
  end

  return setmetatable(value, typed_array_mt)
end

local function make_shared_typed_array(typename, ptr, len)
  local ctype = normalize_typename(typename)
  if not ctype then
    error("unknown shared typed array typename: " .. tostring(typename))
  end
  if ptr == nil then
    error("shared typed array requires a pointer")
  end
  if len == nil then
    error("shared typed array requires a length")
  end

  local data = ffi.cast(ctype .. "*", ptr)
  local value = {
    _raw = data,
    _len = len,
    _ctype = ctype,
    _shared = true,
    _source = ptr,
  }

  return setmetatable(value, typed_array_mt)
end

local function make_shared_typed_array_from_path(typename, path, len, offset)
  local ctype = normalize_typename(typename)
  if not ctype then
    error("unknown shared typed array typename: " .. tostring(typename))
  end
  if path == nil then
    error("shared typed array requires a path")
  end
  if len == nil then
    error("shared typed array requires a length")
  end

  local elem_size = ffi.sizeof(ctype)
  local bytes = elem_size * len
  local fd = C.open(path, O_RDWR)
  if fd < 0 then
    error("failed to open shared memory file: " .. tostring(path))
  end

  local map = C.mmap(nil, bytes, bit.bor(PROT_READ, PROT_WRITE), MAP_SHARED, fd, offset or 0)
  if map == MAP_FAILED then
    C.close(fd)
    error("failed to mmap shared memory file: " .. tostring(path))
  end

  local data = ffi.cast(ctype .. "*", map)
  local value = {
    _raw = data,
    _len = len,
    _ctype = ctype,
    _shared = true,
    _source = path,
  }

  return setmetatable(value, typed_array_mt), map, fd, bytes
end

local function is_shape_candidate(initial)
  if type(initial) ~= "table" then
    return false
  end
  local count = 0
  for key, _ in pairs(initial) do
    if type(key) ~= "string" then
      return false
    end
    count = count + 1
    if count > 12 then
      return false
    end
  end
  return true
end

local function make_object_with_proto(proto)
  local mt = {}
  if proto ~= nil then
    if type(proto) ~= "table" then
      error("prototype must be a table, got " .. type(proto))
    end
    mt.__index = proto
  end
  mt.__metatable = false
  return setmetatable({}, mt)
end

local function make_shape_object(initial, proto)
  local obj = {}
  if type(initial) == "table" then
    for key, value in pairs(initial) do
      obj[key] = value
    end
  elseif initial ~= nil then
    error("shape object initial value must be a table or nil")
  end
  if proto ~= nil then
    if type(proto) ~= "table" then
      error("prototype must be a table, got " .. type(proto))
    end
    return setmetatable(obj, { __index = proto, __metatable = false })
  end
  return obj
end

local function make_dynamic_object(initial)
  local data = {}
  if type(initial) == "table" then
    for key, value in pairs(initial) do
      data[key] = value
    end
  elseif initial ~= nil then
    error("dynamic object initial value must be a table or nil")
  end
  return setmetatable({ _data = data, _reads = 0, _writes = 0 }, dynamic_object_mt)
end

local function shared_descriptor_fields(spec)
  local typename = spec.typename or spec.ctype or spec.type
  local ptr = spec.ptr or spec.buffer or spec.cdata or spec.source
  local path = spec.path or spec.file or spec.pathname
  local len = spec.len or spec.length or spec.count or spec.items
  local offset = spec.offset or spec.off or 0
  return typename, ptr, path, len, offset
end

function Runtime:typed_array(typename, size_or_init)
  return make_typed_array(self, typename, size_or_init)
end

function Runtime:new_typed_array(typename, size_or_init)
  return self:typed_array(typename, size_or_init)
end

function Runtime:shared_typed_array(typename, ptr, len)
  return make_shared_typed_array(typename, ptr, len)
end

function Runtime:new_object(proto)
  return make_object_with_proto(proto)
end

function Runtime:shape_object(initial, proto)
  return make_shape_object(initial, proto)
end

function Runtime:dict_object(initial)
  return make_dynamic_object(initial)
end

function Runtime:object(initial, proto)
  if is_shape_candidate(initial) then
    return make_shape_object(initial, proto)
  end
  return make_dynamic_object(initial)
end

function Runtime:promote_shape(obj, proto)
  if type(obj) ~= "table" then
    error("promote_shape expects a table-like object")
  end

  local source = rawget(obj, "_data")
  local data = {}
  if source ~= nil then
    for key, value in pairs(source) do
      data[key] = value
    end
  else
    for key, value in pairs(obj) do
      if key ~= "_data" then
        data[key] = value
      end
    end
  end
  return make_shape_object(data, proto)
end

function Runtime:shape_hint(obj, hint)
  if type(obj) ~= "table" then
    error("shape_hint expects a table-like object")
  end

  if rawget(obj, "_data") == nil then
    return obj
  end

  if hint == nil then
    rawset(obj, "_shape_forced", true)
  elseif type(hint) == "string" then
    if hint == "stable" then
      rawset(obj, "_shape_hot_reads", 3)
      rawset(obj, "_shape_hot_writes", 2)
    elseif hint == "hot" then
      rawset(obj, "_shape_hot_reads", 2)
      rawset(obj, "_shape_hot_writes", 1)
    elseif hint == "pinned" then
      rawset(obj, "_shape_pinned", true)
    else
      error("unknown shape hint: " .. hint)
    end
  elseif type(hint) == "table" then
    if hint.promote or hint.force then
      rawset(obj, "_shape_forced", true)
    end
    if hint.pinned then
      rawset(obj, "_shape_pinned", true)
    end
    if hint.hot_reads ~= nil then
      rawset(obj, "_shape_hot_reads", tonumber(hint.hot_reads) or 0)
    end
    if hint.hot_writes ~= nil then
      rawset(obj, "_shape_hot_writes", tonumber(hint.hot_writes) or 0)
    end
  else
    error("shape_hint expects a string or table hint")
  end

  dynamic_object_maybe_promote(obj)
  return obj
end

function Runtime:shape_kind(obj)
  if type(obj) ~= "table" then
    error("shape_kind expects a table-like object")
  end
  if rawget(obj, "_data") ~= nil then
    return "dynamic"
  end
  return "shaped"
end

function Runtime:concat(...)
  local n = select("#", ...)
  if n == 0 then
    return ""
  end
  local parts = {}
  for i = 1, n do
    parts[i] = tostring(select(i, ...))
  end
  return table.concat(parts)
end

function Runtime:seal_object(obj)
  local mt = getmetatable(obj) or {}
  mt.__metatable = false
  setmetatable(obj, mt)
  return obj
end

function Runtime:freeze_prototype(obj, proto)
  local mt = getmetatable(obj)
  if mt == nil then
    mt = {}
    setmetatable(obj, mt)
  end
  if proto ~= nil then
    if type(proto) ~= "table" then
      error("prototype must be table")
    end
    mt.__index = proto
  end
  mt.__metatable = false
end

function Runtime:object(proto)
  return make_object_with_proto(proto)
end

function Runtime:new(typename, ...)
  if normalize_typename(typename) then
    return self:typed_array(typename, ...)
  end
  error("unknown constructor: " .. tostring(typename))
end

function Runtime:render(...)
  local render = self._render
  if render then
    return render(...)
  end
  return nil
end

function Runtime:spawn_child(js_source, opts)
  opts = opts or {}
  opts.parent = self
  opts.js_source = js_source
  return Runtime.from_js(js_source, opts)
end

function Runtime:_install_shared_memory(shared_memory)
  self.shared_memory = {}
  self._shared_maps = {}
  if shared_memory == nil then
    return
  end

  local function add(name, spec)
    if type(spec) ~= "table" then
      error("shared_memory entries must be tables")
    end
    local typename, ptr, path, len, offset = shared_descriptor_fields(spec)
    if typename == nil then
      error("shared_memory entry " .. tostring(name) .. " is missing typename/ctype/type")
    end
    if ptr ~= nil then
      self.shared_memory[name] = make_shared_typed_array(typename, ptr, len)
      return
    end
    if path ~= nil then
      local wrapped, map, fd, bytes = make_shared_typed_array_from_path(typename, path, len, offset)
      self.shared_memory[name] = wrapped
      self._shared_maps[#self._shared_maps + 1] = {
        map = map,
        fd = fd,
        bytes = bytes,
      }
      return
    end
    error("shared_memory entry " .. tostring(name) .. " must provide ptr or path")
  end

  if shared_memory.ptr ~= nil or shared_memory.buffer ~= nil or shared_memory.cdata ~= nil or shared_memory.source ~= nil then
    add(shared_memory.name or "default", shared_memory)
    return
  end

  for name, spec in pairs(shared_memory) do
    if type(spec) == "table" then
      add(name, spec)
    end
  end
end

function Runtime:_wrap_export(fn)
  if type(fn) ~= "function" then
    return fn
  end

  local wrapped = function(...)
    if not self.alive then
      error("attempt to call function from closed instance " .. tostring(self.id), 2)
    end
    return fn(...)
  end

  -- Keep closure roots explicit to prevent accidental GC bleed.
  self._roots[#self._roots + 1] = wrapped
  return wrapped
end

function Runtime:_adopt_child(child)
  if child == nil then
    return
  end
  self._children[#self._children + 1] = child
end

function Runtime:_release_child(child)
  if child == nil then
    return
  end
  for i = #self._children, 1, -1 do
    if self._children[i] == child then
      table.remove(self._children, i)
      break
    end
  end
end

function Runtime:_install_exports(raw_exports)
  self.exports = {}
  for key, value in pairs(raw_exports or {}) do
    self.exports[key] = self:_wrap_export(value)
  end
end

function Runtime:_make_environment()
  local env = {
    -- Keep the JS runtime handle available as `eqjs` in transpiled script.
    eqjs = self,
    print = print,
    tonumber = tonumber,
    tostring = tostring,
    pairs = pairs,
    ipairs = ipairs,
    type = type,
    next = next,
    select = select,
    pcall = pcall,
    xpcall = xpcall,
    math = math,
    string = string,
    table = table,
    bit = bit,
    ffi = ffi,
    exports = self.exports,
    shared_memory = self.shared_memory,
  }
  setmetatable(env, { __index = _G })
  return env
end

function Runtime:_run_lua(lua_source, source_name)
  local chunk, err = load(lua_source, source_name, "t", self.env)
  if not chunk then
    error("failed to load transpiled cartridge: " .. tostring(err))
  end
  local result = chunk()
  if type(result) ~= "table" then
    result = { exports = {} }
  end
  self:_install_exports(result.exports)
end

function Runtime:close()
  if not self.alive then
    return
  end
  local children = self._children or {}
  self._children = {}
  for i = 1, #children do
    local child = children[i]
    if child and child.alive then
      child:close()
    end
  end
  if self.parent and self.parent._release_child then
    self.parent:_release_child(self)
  end
  self.alive = false
  self.exports = {}
  self._roots = {}
  self._ffi_refs = {}
  if self._shared_maps then
    for i = 1, #self._shared_maps do
      local entry = self._shared_maps[i]
      if entry and entry.map ~= nil then
        C.munmap(entry.map, entry.bytes)
      end
      if entry and entry.fd ~= nil then
        C.close(entry.fd)
      end
    end
  end
  self._shared_maps = {}
  self.shared_memory = {}
  self.env = nil
  collectgarbage("collect")
end

function Runtime:reset_env()
  self.env = self:_make_environment()
end

local function transpile_via_zig(js_source, opts)
  if type(js_source) ~= "string" then
    error("js_source must be a string")
  end

  local transpiler = opts.transpiler or "zig run ./eqjs_transpiler.zig --"
  local in_path = os.tmpname() .. ".js"
  local out_path = os.tmpname() .. ".lua"
  local f = assert(io.open(in_path, "w"))
  f:write(js_source)
  f:close()

  local cmd = string.format("%s %s %s", transpiler, shell_quote(in_path), shell_quote(out_path))
  local ok = os.execute(cmd)
  if type(ok) == "number" then
    if ok ~= 0 then
      error("transpiler failed: " .. tostring(ok))
    end
  elseif ok == false then
    error("transpiler failed to execute")
  end

  local out_f = assert(io.open(out_path, "r"))
  local lua_source = out_f:read("*a")
  out_f:close()
  return lua_source
end

function Runtime.from_js(js_source, opts)
  opts = opts or {}
  local self = setmetatable({}, Runtime)
  self.id = next_instance_id()
  self.alive = true
  self._roots = {}
  self._children = {}
  self._ffi_refs = {}
  self._render = opts.render
  self.parent = opts.parent
  self.label = opts.label
  self.shared_memory = {}
  self.env = nil
  self.exports = {}
  self:reset_env()
  self:_install_shared_memory(opts.shared_memory)

  local lua_source = opts.lua_source
  if lua_source == nil then
    if opts.transpiler == false then
      error("no transpiler configured for JS input")
    end
    lua_source = transpile_via_zig(js_source, opts)
  end

  self:_run_lua(lua_source, self.label or ("eqjs-" .. self.id))
  if self.parent and self.parent._adopt_child then
    self.parent:_adopt_child(self)
  end
  return self
end

function Runtime.from_lua(lua_source, opts)
  opts = opts or {}
  local copy = {}
  for k, v in pairs(opts) do
    copy[k] = v
  end
  copy.lua_source = lua_source
  copy.js_source = nil
  return Runtime.from_js("", copy)
end

Runtime.new = Runtime.from_js

return Runtime
