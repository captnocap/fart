# Per-Instance Component State

Components with `useState` inside their body get independent state slots per instance, preventing shared-state bugs when the same component is used multiple times.

## .tsz API

```tsx
function Counter(label, color) {
  const [count, setCount] = useState(0);
  return (
    <Box style={{ gap: 8 }}>
      <Text color={color}>{`${count}`}</Text>
      <Pressable onPress={() => { setCount(count + 1) }}>
        <Text>+1</Text>
      </Pressable>
    </Box>
  );
}

function App() {
  return (
    <Box style={{ flexDirection: "row", gap: 12 }}>
      <Counter label="A" color="#3b82f6" />
      <Counter label="B" color="#22c55e" />
      <Counter label="C" color="#f59e0b" />
    </Box>
  );
}
```

Each Counter instance gets its own `count` state slot. Clicking Counter A does NOT affect Counter B or C.

## Compiler files

| File | What it does |
|------|-------------|
| `compiler/codegen.zig` | `StateRemap` struct — maps getter/setter names to instance-specific slot IDs. `isState()` and `isSetter()` check remap stack before global slots. `state_remap` array + `state_remap_count` on Generator. |
| `compiler/components.zig` | `inlineComponent` Phase 4 scans component body for `useState` declarations. For each, allocates a NEW state slot (copy of original's type/initial value) and pushes a remap. Remaps are popped after inline returns. |
| `compiler/collect.zig` | `collectStateHooksTopLevel` collects ALL `useState` declarations including those in component bodies. These become the "template" slots that get duplicated per instance. |

## Framework files

No framework changes. Uses existing `framework/state.zig` slot system — just allocates more slots.

## How it works

1. `collectStateHooksTopLevel` scans source, finds `const [count, setCount] = useState(0)` inside Counter → creates slot N.
2. First `<Counter />` inline: scans body for `useState`, finds `count/setCount` at slot N. Allocates new slot M. Pushes remap: `count→M, setCount→M`. Parses body — all `isState("count")` calls return M. Pops remap.
3. Second `<Counter />` inline: allocates slot M+1. Pushes remap: `count→M+1`. Parses body. Pops.
4. Third inline: slot M+2. Each instance references its own slot.

## Known limitations

- **Max 32 remaps**: `state_remap` array is fixed at 32 entries. Deeply nested components with many useState each could overflow.
- **No nested component state**: If component A contains component B, and both have useState, the remap handles one level. Deeper nesting may not remap correctly.
- **Original slot unused**: The original slot from `collectStateHooksTopLevel` is never used at runtime — each instance gets a duplicate. The original wastes one slot.
