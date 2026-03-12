# useEffect Audit - 2026-03-12

Scope:
- Executable TypeScript source only.
- Included: `packages/*/src`, `examples/*/src`, `storybook/src`.
- Excluded: generated mirrors (`cli/runtime`, `web/reactjit`, local `reactjit/` copies), docs/content snippets, compiled/generated output.

Rule used for this audit:
- Every raw `useEffect` call is treated as a violation.
- `// rjit-ignore-next-line` is recorded as a bandaid, not an exemption.

Summary:

| Metric | Count |
| --- | ---: |
| Total raw `useEffect` calls | 223 |
| Unique files with violations | 94 |
| Calls carrying ignore comments | 15 |
| `useLayoutEffect` calls | 0 |

By area:

| Area | Calls | Files |
| --- | ---: | ---: |
| `packages/*/src` | 152 | 58 |
| `examples/*/src` | 18 | 10 |
| `storybook/src` | 53 | 26 |

Top offenders:

| File | Calls |
| --- | ---: |
| `packages/core/src/useUtils.ts` | 16 |
| `packages/core/src/hooks.ts` | 15 |
| `packages/core/src/MonacoMirror.tsx` | 10 |
| `storybook/src/stories/MathStory.tsx` | 8 |
| `packages/networking/src/hooks.ts` | 7 |
| `packages/time/src/hooks.ts` | 7 |
| `packages/media/src/hooks.ts` | 6 |
| `storybook/src/stories/ConversionsStory.tsx` | 6 |
| `examples/llm-studio/src/App.tsx` | 5 |
| `packages/chemistry/src/hooks.ts` | 5 |
| `storybook/src/stories/AudioStory.tsx` | 5 |
| `storybook/src/stories/CryptoStory.tsx` | 5 |
| `packages/wireguard/src/hooks.ts` | 4 |
| `examples/tor-irc/src/App.tsx` | 3 |
| `packages/core/src/useBreakpoint.ts` | 3 |

Ignored/bandaid call sites:

| File | Line | Ignore style |
| --- | ---: | --- |
| `examples/devctl/src/App.tsx` | 648 | previous line |
| `examples/llm-studio/src/App.tsx` | 138 | previous line |
| `examples/llm-studio/src/App.tsx` | 336 | previous line |
| `examples/llm-studio/src/App.tsx` | 1868 | previous line |
| `examples/llm-studio/src/App.tsx` | 2392 | previous line |
| `examples/llm-studio/src/App.tsx` | 2538 | previous line |
| `packages/core/src/useTray.ts` | 72 | previous line |
| `packages/networking/src/hooks.ts` | 64 | same line |
| `packages/networking/src/hooks.ts` | 83 | same line |
| `packages/networking/src/hooks.ts` | 95 | same line |
| `packages/networking/src/hooks.ts` | 114 | same line |
| `storybook/src/main.tsx` | 238 | previous line |
| `storybook/src/stories/AnimationStory.tsx` | 957 | previous line |
| `storybook/src/stories/AnimationStory.tsx` | 1158 | previous line |
| `storybook/src/stories/GamepadStory.tsx` | 329 | previous line |

Full table:
- [docs/useeffect-audit-2026-03-12.csv](/home/siah/creative/reactjit/docs/useeffect-audit-2026-03-12.csv)
