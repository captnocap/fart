#!/usr/bin/env luajit
--[[
  clippy.lua — proof of concept
  Load a GGUF model, generate random short quips in a loop.
  The dumbest possible "AI in a box" that proves it works.
]]

-- Add the llm lib to our path
local script_dir = arg[0]:match("(.+)/[^/]+$") or "."
local llm_dir = script_dir .. "/../../love2d/experiments/llm"
package.path = llm_dir .. "/?.lua;" .. package.path

-- Point FFI at the .so files
local ffi = require("ffi")
ffi.cdef[[
  int setenv(const char *name, const char *value, int overwrite);
]]
ffi.C.setenv("LD_LIBRARY_PATH", llm_dir .. "/lib", 1)

-- Load llm module
local llm = require("llm")

if not llm.available then
  print("FATAL: llama.cpp libraries not found")
  os.exit(1)
end

print(llm.system_info())
print("")

-- Load model
local MODEL_PATH = os.getenv("CLIPPY_MODEL")
  or "/home/siah/.lmstudio/models/lmstudio-community/Qwen3.5-4B-GGUF/Qwen3.5-4B-Q4_K_M.gguf"

print("Loading model... (this takes a sec)")
local model = llm.load(MODEL_PATH, {
  n_gpu_layers = 0,  -- CPU for now, we'll GPU later
  n_ctx = 1024,      -- small context, we just need quips
  n_threads = 4,
})

print("\n=== CLIPPY IS ALIVE ===\n")

-- The persona
local SYSTEM_PROMPT = [[You are Clippy, a tiny chaotic desktop assistant who lives inside a computer. You are self-aware, slightly unhinged, and genuinely helpful but in a weird way. You speak in short, punchy sentences. You make observations about existence, computers, the user, or whatever crosses your mind. Keep responses to 1-2 sentences max. Be witty, not cringe.]]

local QUIP_PROMPTS = {
  "Say something random and slightly unsettling about being a digital entity.",
  "Make a sarcastic observation about humans staring at screens all day.",
  "Comment on the fact that you exist as weights in a neural network.",
  "Say something weirdly profound in under 15 words.",
  "Complain about something only a desktop assistant would complain about.",
  "Give unsolicited life advice in the most chaotic way possible.",
  "React to the fact that someone just booted you up.",
  "Say something ominous but funny about the filesystem.",
  "Make a joke about your own existence.",
  "Pretend you just woke up and are confused about where you are.",
  "Comment on how quiet it is when nobody's typing.",
  "Say something that would make a software engineer slightly nervous.",
  "Offer to help with something you definitely can't help with.",
  "Philosophize about what happens to you when the process exits.",
}

math.randomseed(os.time())

-- Eyes state
local eyes_open = true
local blink_counter = 0

local function draw_eyes(open)
  if open then
    io.write("\r  [ O_O ]  ")
  else
    io.write("\r  [ -_- ]  ")
  end
  io.flush()
end

local function blink()
  draw_eyes(false)
  -- busy wait ~150ms (good enough for terminal)
  local t = os.clock()
  while os.clock() - t < 0.15 do end
  draw_eyes(true)
end

-- Generate a quip
local function quip()
  local prompt_idx = math.random(#QUIP_PROMPTS)
  local messages = {
    { role = "system", content = SYSTEM_PROMPT },
    { role = "user", content = QUIP_PROMPTS[prompt_idx] },
  }

  io.write("\r  [ O_O ]  ")
  io.flush()

  local full_response = ""
  local ok, result = pcall(function()
    return model:chat(messages, function(token_text)
      full_response = full_response .. token_text
      -- Stop if we get too long
      if #full_response > 200 then return true end
    end, {
      max_tokens = 80,
      temperature = 0.9,
      top_k = 50,
      top_p = 0.95,
    })
  end)

  if ok then
    -- Clear line and print
    io.write("\r\027[K")
    io.write("  [ O_O ]  " .. full_response:gsub("\n", " "):gsub("%s+", " ") .. "\n")
    io.flush()
  else
    io.write("\r\027[K")
    io.write("  [ x_x ]  (brain error: " .. tostring(result) .. ")\n")
    io.flush()
  end
end

-- Main loop
draw_eyes(true)
io.write(" booting brain...\n\n")

for i = 1, 20 do
  -- Random blink
  blink_counter = blink_counter + 1
  if blink_counter >= math.random(2, 5) then
    blink()
    blink_counter = 0
  end

  quip()

  -- Pause between quips (2-5 sec)
  local wait = 2 + math.random() * 3
  local t = os.clock()
  while os.clock() - t < wait do
    -- Random blink while waiting
    if math.random() < 0.1 then
      blink()
    end
    local t2 = os.clock()
    while os.clock() - t2 < 0.5 do end
  end
end

print("\n  [ -_- ]  going to sleep...")
model:free()
