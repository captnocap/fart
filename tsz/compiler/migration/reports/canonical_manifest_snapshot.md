# canonical_manifest_snapshot generated: 2026-04-09T00:23:52-07:00

# COMPILER MANIFEST — Phase 0 Pre-Cleanup Inventory
Generated: 2026-04-08  
Active files: 200 JS + 6 Zig (excluding `dead/`, `v4_reference/`, `dist/`, `patterns/`)  
Total unique functions: 652 (verified 2026-04-08)  
Breakdown: 525 as named table rows + 95 atom _applies/_emit/internal + 32 named in atom helper description cells

---

## Legend

| Field | Values |
|---|---|
| ownership | `meta` compiler infra · `zig` generates Zig · `lua` generates Lua · `qjs` generates QuickJS JS |
| fragility | `high` = 5+ callers OR in critical parse/emit path · `low` = leaf / single-caller |
| called-by | representative callers (not exhaustive) |

---

## 1. ZIG HOST — `tsz/compiler/*.zig`

### `cli.zig` (1459 lines)
**Purpose:** Top-level `forge` binary entry — parses CLI flags, dispatches build/check/bundle/sync sub-commands, file I/O wrapper.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `main` | 219 | 1459 | meta | high | OS entrypoint |

---

### `forge.zig` (503 lines)
**Purpose:** Zig kernel — loads Smith bundle into QuickJS, drives lexer, passes tokens + source to JS, collects Zig output.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `classifyFile` | 25 | 40 | meta | low | `main` (cli.zig) |
| `resolveImportPath` | 41 | 99 | meta | low | `main` |
| `findImportPaths` | 100 | 133 | meta | low | `main` |
| `stripAppStub` | 134 | 153 | meta | low | `main` |
| `mergeImports` | 154 | 218 | meta | low | `main` |
| `main` | 219 | 503 | meta | high | OS entrypoint |

---

### `lexer.zig` (483 lines)
**Purpose:** Tokenizer — scans `.tsz` source, emits flat token stream consumed by Smith.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `Token.text` | 84 | 97 | meta | low | forge.zig, smith_bridge.zig |
| `Lexer.init` | 98 | 108 | meta | high | forge.zig |
| `Lexer.peek` | 109 | 113 | meta | low | `Lexer.tokenize` |
| `Lexer.peekAt` | 114 | 119 | meta | low | `Lexer.tokenize` |
| `Lexer.advance` | 120 | 126 | meta | low | `Lexer.tokenize` |
| `Lexer.emit` | 127 | 138 | meta | low | `Lexer.tokenize` |
| `Lexer.skipWhitespace` | 139 | 149 | meta | low | `Lexer.tokenize` |
| `Lexer.tokenize` | 150 | 465 | meta | high | forge.zig |
| `Lexer.get` | 466 | 471 | meta | low | forge.zig |
| `isIdentStart` | 472 | 480 | meta | low | `Lexer.tokenize` |
| `isIdentCont` | 481 | 483 | meta | low | `Lexer.tokenize` |

---

### `smith_bridge.zig` (184 lines)
**Purpose:** QuickJS↔Zig bridge — init/deinit QJS context, load module, read/write globals, call `compile()` and `check()`.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `init` | 18 | 25 | meta | high | `forge.zig` |
| `deinit` | 26 | 33 | meta | high | `forge.zig` |
| `loadModule` | 34 | 51 | meta | high | `forge.zig` |
| `setGlobalString` | 52 | 61 | meta | high | `forge.zig` |
| `getGlobalString` | 62 | 76 | meta | high | `forge.zig` |
| `setGlobalInt` | 77 | 85 | meta | low | `forge.zig` |
| `setTokenData` | 86 | 104 | meta | high | `forge.zig` |
| `callCompile` | 105 | 130 | meta | high | `forge.zig` |
| `callCheck` | 131 | 152 | meta | high | `forge.zig` |
| `getGlobalInt` | 153 | 163 | meta | low | `forge.zig` |
| `dumpException` | 164 | 184 | meta | low | internal |

---

### `smith_bundle.zig` (56 lines)
**Purpose:** Build tool — concatenates Smith JS source files into `dist/smith.bundle.js`.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `main` | — | 56 | meta | low | `zig build smith-bundle` |

---

### `smith_sync.zig` (229 lines)
**Purpose:** Sync tool — verifies manifest coverage, checks all Smith files are registered in the bundle.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `main` | — | 229 | meta | low | `zig build smith-sync` |

---

## 2. SMITH ENTRY — `smith/*.js`

### `smith/index.js` (616 lines)
**Purpose:** Top-level compiler entry — `compile()` called by Forge, routes to lane, calls preflight + collect + parse + emit, exports `smithCheck()`. Also contains mod/module compile paths.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `stampIntegrity` | 19 | 23 | meta | high | `compile`, `compileMod`, `compileModLua`, `compileModJS` |
| `compile` | 24 | 35 | meta | high | Forge via `callCompile` |
| `smithCheck` | 36 | 308 | meta | high | Forge via `callCheck` |
| `compileMod` | 309 | 439 | meta | high | `compile` |
| `transpileType` | 440 | 454 | meta | low | `compileMod`, `compileModLua` |
| `transpileParams` | 455 | 464 | meta | low | `compileMod`, `compileModLua` |
| `transpileModExpr` | 465 | 484 | meta | low | `compileMod` |
| `compileModLua` | 485 | 571 | lua | high | `compileMod` |
| `compileModJS` | 572 | 616 | qjs | high | `compileMod` |

---

### `smith/core.js` (431 lines)
**Purpose:** Shared compiler state — cursor factory (`mkCursor`), context (`ctx`) singleton with all collected state, slot lookup helpers, Zig codegen utilities, runtime log helpers, const-OA resolver.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `zigEscape` | 5 | 9 | zig | low | emit/* |
| `leftFoldExpr` | 10 | 30 | meta | low | parse/*, resolve/* |
| `utf8ByteLen` | 31 | 44 | zig | low | emit/preamble |
| `indentLines` | 45 | 51 | meta | low | emit/* |
| `zigStringLiteral` | 52 | 60 | zig | low | emit/* |
| `zigEscapeFormatText` | 61 | 64 | zig | low | emit/* |
| `mkCursor` | 65 | 129 | meta | high | index.js, lanes/*, preflight/route_scan.js |
| `resetCtx` | 130 | 185 | meta | high | index.js, lanes/app.js, lanes/chad.js, lanes/soup, lanes/page |
| `tracePattern` | 186 | 193 | meta | low | patterns/* |
| `tracePatternFail` | 194 | 201 | meta | low | patterns/* |
| `traceEnter` | 202 | 202 | meta | low | patterns/* |
| `traceExit` | 203 | 203 | meta | low | patterns/* |
| `dumpPatternTrace` | 206 | 214 | meta | low | debug.js |
| `findSlot` | 215 | 222 | meta | high | attrs.js, collect/state.js, collect/components.js, emit/* |
| `isGetter` | 223 | 227 | meta | high | attrs.js, collect/render_locals.js, parse/element/*, emit/* |
| `isSetter` | 228 | 232 | meta | high | attrs.js, parse/element/*, emit/* |
| `slotGet` | 233 | 244 | meta | high | attrs.js, parse/*, emit/runtime_updates.js, emit_ops/* |
| `tryResolveObjectStateAccess` | 245 | 259 | meta | high | attrs.js, parse/children/brace.js |
| `peekPropsAccess` | 260 | 296 | meta | high | parse/element/component_*, attrs.js, parse/children/brace.js |
| `skipPropsAccess` | 297 | 301 | meta | high | parse/element/component_*, parse/children/brace.js |
| `markRuntimeLogNeeded` | 302 | 307 | meta | low | emit/runtime_updates.js |
| `nextRuntimeLogId` | 308 | 313 | meta | low | emit/runtime_updates.js |
| `zigLogCall` | 314 | 325 | zig | low | emit/runtime_updates.js |
| `zigLogStmt` | 326 | 348 | zig | low | emit/runtime_updates.js |
| `zigLogExpr` | 349 | 363 | zig | low | emit/runtime_updates.js |
| `zigPrintStmt` | 364 | 367 | zig | low | emit/runtime_updates.js |
| `zigPrintExpr` | 368 | 375 | zig | low | emit/runtime_updates.js |
| `resolveConstOaAccess` | 376 | 415 | meta | high | attrs.js, parse/children/brace.js, emit/* |
| `resolveConstOaFieldFromRef` | 416 | 431 | meta | high | emit_ops/rebuild_map.js, emit/object_arrays.js, emit_atoms/* |

---

### `smith/logs.js` (116 lines)
**Purpose:** Runtime log formatting — wraps compiler output with structured log sections; `LOG_EMIT` is the main logger.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `LOG_EMIT` | 68 | 116 | meta | high | index.js, validate.js, lanes/* |

---

### `smith/debug.js` (296 lines)
**Purpose:** Debug dump helpers — pretty-prints ctx state, node trees, OA structures to stderr during development.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `__dgb` | 34 | 39 | meta | low | debug wrappers |
| `__summarize` | 40 | 69 | meta | low | `__dumpField`, `__dumpCtx` |
| `__dumpField` | 70 | 93 | meta | low | `__dumpCtx` |
| `__dumpCtx` | 94 | 117 | meta | low | monkey-patched wrappers |
| *(monkey-patch: buildNode wrapper)* | 118 | 133 | meta | low | debug mode — wraps global `buildNode` |
| *(monkey-patch: emitRuntimeEntrypoints wrapper)* | 134 | 165 | meta | low | debug mode — wraps global `emitRuntimeEntrypoints` |
| *(monkey-patch: emitOutput wrapper)* | 166 | 212 | meta | low | debug mode — wraps global `emitOutput` |
| *(monkey-patch: finalizeEmitOutput wrapper)* | 213 | 286 | meta | low | debug mode — wraps global `finalizeEmitOutput` |
| *(monkey-patch: finishParsedLane wrapper)* | 287 | 296 | meta | low | debug mode — wraps global `finishParsedLane` |

---

### `smith/rules.js` (106 lines)
**Purpose:** Tag classification — `isNativeTag`, `isPrimitive`, `isContainerTag` etc. used during parse to classify JSX tags.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| *(constants only — no functions)* | — | 106 | meta | high | everywhere |

Constants: `TK` (token kinds enum), `styleKeys`, `colorKeys`, `enumKeys`, `htmlTags`, `namedColors`, `soupTags`, `soupFonts`, `soupColors`. Lookup tables consumed by parse/element/tags.js, collect/components.js, and broadly across Smith.

---

### `smith/validate.js` (72 lines)
**Purpose:** Post-emit validation — checks generated Zig output for known bad patterns, surfaces errors via `LOG_EMIT`.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `validate` | 6 | 61 | meta | high | emit.js emitOutput |
| `validateErrorZig` | 62 | 72 | meta | low | `validate` |

---

## 3. LANES — `smith/lanes/`

### `smith/lanes/dispatcher.js` (19 lines)
**Purpose:** Lane router — `compileLane()` checks source for soup/module/page/chad/app and dispatches to the correct lane compile function.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `compileLane` | 1 | 19 | meta | high | index.js `compile` |

---

### `smith/lanes/shared.js` (114 lines)
**Purpose:** Shared lane utilities — tier detection, route plan building, `finishParsedLane` wraps parse→emit for app/chad/page lanes.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `detectSurfaceTier` | 1 | 18 | meta | high | `assignSurfaceTier` |
| `assignSurfaceTier` | 19 | 29 | meta | high | lanes/app.js, lanes/chad.js, lanes/page.js |
| `buildRoutePlan` | 30 | 48 | meta | high | lanes/app.js, lanes/chad.js, lanes/page.js, index.js |
| `finishParsedLane` | 49 | 114 | meta | high | lanes/app.js, lanes/chad.js, lanes/page.js |

---

### `smith/lanes/app.js` (81 lines)
**Purpose:** App lane compile — standard `.app.tsz` path; finds app start, moves to return, calls `finishParsedLane`.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `findAppStart` | 1 | 12 | meta | low | `compileAppLane` |
| `moveToAppReturn` | 13 | 42 | meta | high | `compileAppLane` |
| `flushInlineDebugLogs` | 43 | 49 | meta | low | `compileAppLane` |
| `compileAppLane` | 50 | 81 | meta | high | lanes/dispatcher.js |

---

### `smith/lanes/chad.js` (365 lines)
**Purpose:** Chad-tier lane — detects `<block>` syntax, extracts inner source, runs chad-specific preflight + `finishParsedLane`.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `detectChadBlock` | 26 | 47 | meta | high | lanes/shared.js, lanes/dispatcher.js |
| `chadSourcePreflight` | 48 | 77 | meta | high | `compileChadLane` |
| `extractChadInner` | 78 | 89 | meta | low | `compileChadLane` |
| `compileChadLane` | 90 | 365 | meta | high | lanes/dispatcher.js |

---

### `smith/lanes/page.js` (17 lines)
**Purpose:** Page lane compile — detects page source, calls `finishParsedLane`.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `isPageLaneSource` | 1 | 4 | meta | low | lanes/dispatcher.js |
| `isChadBlockSource` | 5 | 10 | meta | low | lanes/dispatcher.js, lanes/chad.js |
| `compilePageLane` | 11 | 17 | meta | low | lanes/dispatcher.js |

---

### `smith/lanes/module.js` (10 lines)
**Purpose:** Module lane detection — `isModuleLaneBuild()` checks global flag set by Forge for `--mod` builds.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `isModuleLaneBuild` | 1 | 4 | meta | low | lanes/dispatcher.js |
| `compileModuleLane` | 5 | 10 | meta | low | lanes/dispatcher.js |

---

### `smith/lanes/soup.js` (7 lines)
**Purpose:** Soup lane shim — delegates to `lanes/soup/index.js:compileSoup`.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `compileSoupLane` | — | 7 | meta | low | lanes/dispatcher.js |

---

### `smith/lanes/soup/index.js` (204 lines)
**Purpose:** Soup lane orchestrator — detects HTML soup source, runs soup tokenize→parse→codegen pipeline.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `compileSoup` | 4 | 204 | meta | high | lanes/soup.js |

---

### `smith/lanes/soup/detect.js` (11 lines)
**Purpose:** Soup detection heuristic — `isSoupLaneSource()` checks for raw HTML tags vs TSX.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `isSoupSource` | 4 | 7 | meta | low | `isSoupLaneSource` |
| `isSoupLaneSource` | 8 | 11 | meta | low | lanes/dispatcher.js, lanes/soup/index.js |

---

### `smith/lanes/soup/parse.js` (138 lines)
**Purpose:** Soup tokenizer + tree builder — `soupTokenize`, `soupBuildTree` convert HTML string to node tree.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `soupBlock` | 5 | 18 | meta | low | `soupTokenize` |
| `_soupFindMatchingClose` | 19 | 38 | meta | low | `soupBuildTree` |
| `soupTokenize` | 39 | 75 | meta | high | lanes/soup/index.js |
| `soupBalanced` | 76 | 89 | meta | low | `soupParseTag` |
| `soupParseTag` | 90 | 119 | meta | high | `soupTokenize` |
| `soupBuildTree` | 120 | 138 | meta | high | lanes/soup/index.js |

---

### `smith/lanes/soup/codegen.js` (533 lines)
**Purpose:** Soup → Zig codegen — `soupToZig` walks node tree, emits Zig node declarations.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `soupToZig` | 10 | 317 | zig | high | lanes/soup/index.js |
| `soupWireDynTextsInArray` | 318 | 337 | zig | low | `soupToZig` |
| `soupFindTopLevelAnd` | 338 | 352 | meta | low | `soupExprToZig` |
| `soupFindTopLevelChar` | 353 | 367 | meta | low | `soupExprToZig` |
| `soupPushJsDynText` | 368 | 388 | qjs | low | `soupExprToZig` |
| `soupExprToZig` | 389 | 533 | zig | high | `soupToZig` |

---

### `smith/lanes/soup/components.js` (158 lines)
**Purpose:** Soup component handling — resolves component references in soup parse tree.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `soupExpandComponents` | 5 | 77 | meta | low | soup pipeline |
| `_soupSubstituteProps` | 78 | 93 | meta | low | `soupExpandComponents` |
| `_soupExtractComponentReturns` | 94 | 158 | meta | low | `soupExpandComponents` |

---

### `smith/lanes/soup/handlers.js` (35 lines)
**Purpose:** Soup handler extraction — `soupExtractInlineHandlers` pulls press/event handlers from soup nodes.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `soupExtractInlineHandlers` | — | 35 | meta | high | soup/codegen.js |

---

### `smith/lanes/soup/maps.js` (123 lines)
**Purpose:** Soup map handling — detects and processes `.map()` calls in soup source.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `soupHandleMap` | 3 | 123 | zig | low | soup/codegen.js |

---

### `smith/lanes/soup/state.js` (102 lines)
**Purpose:** Soup state collection — extracts `useState` calls from soup source.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `soupParseState` | 5 | 57 | meta | low | lanes/soup/index.js |
| `_soupParseObjectFields` | 58 | 73 | meta | low | `soupParseState` |
| `soupCollectHandlers` | 74 | 87 | meta | low | lanes/soup/index.js |
| `soupExtractReturn` | 88 | 102 | meta | low | lanes/soup/index.js |

---

### `smith/lanes/soup/style.js` (134 lines)
**Purpose:** Soup style handling — converts inline style objects in soup to Zig style fields.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `soupHexRgb` | 3 | 9 | zig | low | `soupParseStyle` |
| `soupStyleColorToRgb` | 10 | 24 | zig | low | `soupParseStyle` |
| `soupParseTextStyle` | 25 | 46 | zig | low | soup/codegen.js |
| `soupParseStyle` | 47 | 134 | zig | low | soup/codegen.js |

---

## 4. COLLECT — `smith/collect/`

### `smith/collect/pipeline.js` (26 lines)
**Purpose:** Collect orchestrator — `collectCompilerInputs` calls all collect/* passes in order.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `collectCompilerInputs` | 3 | 16 | meta | high | lanes/app.js, lanes/chad.js, lanes/shared.js finishParsedLane |
| `collectVariantNames` | 17 | 26 | meta | low | `collectCompilerInputs` |

---

### `smith/collect/state.js` (455 lines)
**Purpose:** State collection — walks source for `useState`/`useRef`/const arrays, populates `ctx.slots`, `ctx.oas`, `ctx.constArrays`.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `collectState` | 3 | 81 | meta | high | collect/pipeline.js |
| `registerOpaqueStateMarker` | 82 | 91 | meta | low | `collectState` |
| `collectOpaqueState` | 92 | 109 | meta | low | `collectState` |
| `collectObjectState` | 110 | 153 | meta | high | `collectState` |
| `collectObjectArrayState` | 154 | 266 | meta | high | `collectState` |
| `collectNestedObjectFields` | 267 | 305 | meta | high | `collectObjectState`, `collectObjectArrayState` |
| `collectNestedArrayField` | 306 | 350 | meta | low | `collectNestedObjectFields` |
| `collectConstArrays` | 351 | 395 | meta | high | `collectState` |
| `collectConstArrayItems` | 396 | 423 | meta | low | `collectConstArrays` |
| `parseConstArrayFieldValue` | 424 | 455 | meta | low | `collectConstArrayItems` |

---

### `smith/collect/components.js` (127 lines)
**Purpose:** Component collection — scans source for component function declarations, registers them in `ctx.components`.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `collectComponents` | 3 | 124 | meta | high | collect/pipeline.js |
| `findComponent` | 125 | 127 | meta | high | parse/element/tags.js, parse/element/component_* |

---

### `smith/collect/classifiers.js` (198 lines)
**Purpose:** Classifier collection — parses `.cls.tsz` imports, builds classifier defs in `ctx.classifiers`; resolves theme tokens.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `collectClassifiers` | 5 | 38 | meta | high | collect/pipeline.js |
| `parseChadClassifiers` | 39 | 142 | meta | high | `collectClassifiers` |
| `resolveThemeToken` | 143 | 151 | meta | high | parse/element/*, attrs.js |
| `clsStyleFields` | 152 | 178 | meta | high | parse/element/postprocess.js |
| `clsNodeFields` | 179 | 188 | meta | high | parse/element/postprocess.js |
| `mergeFields` | 189 | 198 | meta | low | `clsStyleFields`, `clsNodeFields` |

---

### `smith/collect/render_locals.js` (334 lines)
**Purpose:** Render-local collection — scans component body for `const x = ...` declarations before the JSX return; evaluates or defers them.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `skipRenderLocalDestructure` | 3 | 20 | meta | low | `collectRenderLocals` |
| `appendRenderLocalToken` | 21 | 74 | meta | low | `collectRenderLocals` |
| `readRawJsExpression` | 75 | 92 | meta | low | `readRenderLocalValue` |
| `readRenderLocalValue` | 93 | 116 | meta | low | `collectRenderLocals` |
| `shouldEvalRenderLocal` | 117 | 138 | meta | low | `collectRenderLocals` |
| `normalizeRenderLocalJs` | 139 | 151 | meta | low | `collectRenderLocals` |
| `expandRenderLocalRawExpr` | 152 | 176 | meta | low | `collectRenderLocals` |
| `collectRenderLocals` | 177 | 334 | meta | high | collect/pipeline.js |

---

### `smith/collect/script.js` (189 lines)
**Purpose:** Script block collection — extracts `<script>` (QJS) and `<lscript>` (Lua) blocks, collects FFI declarations.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `collectScript` | 3 | 41 | meta | high | collect/pipeline.js |
| `collectLScript` | 42 | 74 | lua | high | collect/pipeline.js |
| `scanLScriptFunctionNames` | 75 | 89 | lua | low | `collectLScript` |
| `scanScriptFunctionNames` | 90 | 97 | meta | low | `collectScript` |
| `isScriptFunc` | 98 | 106 | meta | high | attrs.js, parse/handlers/press.js, emit/entrypoints.js |
| `_tsToCType` | 107 | 115 | meta | low | `collectFfiDecls` |
| `collectFfiDecls` | 116 | 189 | meta | low | `collectScript` |

---

## 5. PREFLIGHT — `smith/preflight/`

### `smith/preflight/route_scan.js` (333 lines)
**Purpose:** Source scanner — `routeScan` walks source text for dyn-texts, handlers, effects, maps, conditionals, variants; builds scan state used by both preflight rules and the route plan.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `routeScan` | 16 | 125 | meta | high | preflight/context.js |
| `scanForDynTexts` | 126 | 136 | meta | low | `routeScan` |
| `scanForHandlers` | 137 | 144 | meta | low | `routeScan` |
| `scanForEffects` | 145 | 150 | meta | low | `routeScan` |
| `scanForVariants` | 151 | 158 | meta | low | `routeScan` |
| `scanForMaps` | 159 | 216 | meta | high | `routeScan` |
| `scanForLuaMaps` | 217 | 224 | meta | low | `routeScan` |
| `scanForConditionals` | 225 | 234 | meta | low | `routeScan` |
| `scanExpressionResolution` | 235 | 279 | meta | high | `routeScan` |
| `scanMapBody` | 280 | 318 | meta | low | `scanForMaps` |
| `scanForZigUnsafeStrings` | 319 | 333 | meta | low | `routeScan` |

---

### `smith/preflight/context.js` (74 lines)
**Purpose:** Preflight context builder — `derivePreflightIntents` + `buildPreflightScanState` populate `ctx` with scan results before parse begins.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `derivePreflightIntents` | 3 | 18 | meta | high | lanes/shared.js finishParsedLane |
| `detectPreflightLane` | 19 | 31 | meta | high | `derivePreflightIntents` |
| `classifyMapBackends` | 32 | 39 | meta | high | `derivePreflightIntents` |
| `buildPreflightScanState` | 40 | 74 | meta | high | lanes/shared.js finishParsedLane |

---

### `smith/preflight/pattern_atoms.js` (92 lines)
**Purpose:** Atom prediction — `predictAtomSet` maps preflight feature flags to expected emit atom IDs; drives routing_check.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `predictAtomSet` | 80 | 92 | meta | high | preflight/routing_check.js |

---

### `smith/preflight/routing_check.js` (118 lines)
**Purpose:** Routing integrity check — post-emit, compares predicted atom set against actually-emitted atoms; flags mismatches.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `routingCheck` | 14 | 118 | meta | high | lanes/shared.js finishParsedLane |

---

### `smith/preflight/rules/classifiers.js` (68 lines)
**Purpose:** Classifier validation rules — tag leaks, JS syntax leaks, unresolved classifiers, dropped expressions.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `checkTagLeakTextNodes` | 3 | 16 | meta | low | validate.js |
| `checkJSSyntaxLeaks` | 17 | 31 | meta | low | validate.js |
| `checkUnresolvedClassifierComponents` | 32 | 41 | meta | low | validate.js |
| `checkDroppedExpressions` | 42 | 59 | meta | low | validate.js |
| `warnOnUnknownSubsystemTags` | 60 | 68 | meta | low | validate.js |

---

### `smith/preflight/rules/dyn.js` (85 lines)
**Purpose:** Dynamic text + OA field validation rules — color placeholders, field references, unresolved dyn-texts, item reference leaks.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `checkColorPlaceholders` | 3 | 25 | meta | low | validate.js |
| `checkObjectArrayFieldReferences` | 26 | 50 | meta | low | validate.js |
| `checkUnresolvedDynTexts` | 51 | 61 | meta | low | validate.js |
| `checkItemReferenceLeaks` | 62 | 85 | meta | low | validate.js |

---

### `smith/preflight/rules/handlers.js` (98 lines)
**Purpose:** Handler validation rules — empty handlers, dispatch mismatches, duplicate names, script call correctness, Lua syntax leaks, unused map Lua pointers.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `checkEmptyHandlers` | 3 | 13 | meta | low | validate.js |
| `checkMapHandlerDispatch` | 14 | 26 | meta | low | validate.js |
| `checkDuplicateHandlerNames` | 27 | 35 | meta | low | validate.js |
| `checkScriptHandlerCalls` | 36 | 55 | meta | low | validate.js |
| `checkLuaSyntaxLeaks` | 56 | 68 | meta | low | validate.js |
| `checkHandlerReferences` | 69 | 83 | meta | low | validate.js |
| `warnOnUnusedMapLuaPtrs` | 84 | 98 | meta | low | validate.js |

---

### `smith/preflight/rules/js_logic.js` (28 lines)
**Purpose:** JS logic block validation — ignored module blocks, undefined JS calls, duplicate JS vars.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `checkIgnoredModuleBlocks` | 3 | 8 | meta | low | validate.js |
| `checkUndefinedJSCalls` | 9 | 20 | meta | low | validate.js |
| `checkDuplicateJSVars` | 21 | 28 | meta | low | validate.js |

---

### `smith/preflight/rules/maps.js` (17 lines)
**Purpose:** Map validation — object array type mismatches.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `checkMapObjectArrays` | 3 | 17 | meta | low | validate.js |

---

### `smith/preflight/rules/state.js` (37 lines)
**Purpose:** State validation — warns on state slots that are collected but never read in parse.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `warnOnUnreadStateSlots` | 3 | 37 | meta | low | validate.js |

---

### `smith/preflight/rules/unimplemented.js` (33 lines)
**Purpose:** Unimplemented JSX block detection — flags syntax that the compiler doesn't yet handle.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `checkUnimplementedJSXBlocks` | 6 | 33 | meta | low | validate.js |

---

## 6. PARSE — top level

### `smith/parse.js` (113 lines)
**Purpose:** JSX parse entry — `parseJSXElement` is the main recursive descent entry for parsing a single JSX node; `parseChildren` parses child node list.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `parseJSXElement` | 3 | 96 | meta | high | index.js, lanes/app.js, parse/children/elements.js, parse/children/brace.js, attrs.js, parse/map/* (13 files) |
| `parseChildren` | 97 | 113 | meta | high | parseJSXElement, parse/element/*, parse/children/* (5 files) |

---

### `smith/parse/build_node.js` (912 lines)
**Purpose:** Node constructor — `buildNode` takes parsed tag, style fields, children, handler ref, and node fields and assembles the final `ctx.nodes[]` entry. The largest parse-layer file. Every parsed JSX element funnels through here.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `_resolveOaItemMarkers` | 5 | 14 | meta | low | `buildNode` |
| `_cloneInlineGlyphData` | 15 | 27 | meta | low | `buildNode` |
| `buildNode` | 28 | 912 | zig | high | parse/element/flow.js, emit_atoms/maps_lua/lua_map_style.js, debug.js |

---

### `smith/parse_map.js` (5 lines)
**Purpose:** Map parse shim — re-exports `tryParseMap` from parse/children/brace_maps.js.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `tryParseMap` | 3 | 5 | meta | low | shim only |

---

### `smith/attrs.js` (1607 lines)
**Purpose:** Attribute parsing — `parseStyleBlock` parses style objects, `parseHandler` parses event handlers, `parseValueExpr` parses JSX prop expressions, `luaParseHandler` for the Lua path.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `parseColor` | 25 | 49 | meta | high | parse/element/attrs_text_color.js, attrs_basic.js, attrs_canvas.js |
| `parseStyleValue` | 50 | 187 | meta | high | `parseStyleBlock` |
| `parseTernaryBranch` | 188 | 235 | meta | high | `parseStyleValue`, `parseValueExpr` |
| `parseStyleBlock` | 236 | 426 | meta | high | parse/element/attrs_basic.js, attrs_canvas.js |
| `_normalizeStyleExprJs` | 427 | 440 | meta | low | style expr parser |
| `_styleExprQuote` | 441 | 448 | meta | low | style expr parser |
| `_readStyleAttrExpressionRaw` | 449 | 470 | meta | low | `parseStyleExpressionAttr` |
| `_tokenizeStyleExpr` | 471 | 559 | meta | high | style expr parser |
| `_makeStyleTokenStream` | 560 | 566 | meta | low | style expr parser |
| `_stylePeek` | 567 | 570 | meta | low | style expr parser |
| `_styleMatch` | 571 | 578 | meta | low | style expr parser |
| `_styleConsume` | 579 | 583 | meta | low | style expr parser |
| `_styleLooksZigString` | 584 | 591 | meta | low | style expr parser |
| `_styleLooksZigExpr` | 592 | 603 | meta | low | style expr parser |
| `_styleResolvedLiteral` | 604 | 607 | meta | low | style expr parser |
| `_styleResolvedExpr` | 608 | 611 | meta | low | style expr parser |
| `_coerceResolvedStyleValue` | 612 | 628 | meta | low | style expr parser |
| `_resolveStyleIdentifierValue` | 629 | 668 | meta | high | style expr parser |
| `_styleSpecToExpr` | 669 | 679 | meta | low | style expr parser |
| `_styleSpecBoolExpr` | 680 | 685 | meta | low | style expr parser |
| `_styleParsePrimary` | 686 | 701 | meta | high | style expr Pratt parser core |
| `_styleParseUnary` | 702 | 709 | meta | low | style expr Pratt parser |
| `_styleParseComparison` | 710 | 730 | meta | high | style expr Pratt parser |
| `_styleParseAnd` | 731 | 740 | meta | low | style expr Pratt parser |
| `_styleParseOr` | 741 | 750 | meta | low | style expr Pratt parser |
| `_styleParseObjectValue` | 751 | 760 | meta | low | style expr parser |
| `_styleParseObject` | 761 | 782 | meta | low | style expr parser |
| `_styleParseIife` | 783 | 837 | meta | high | style expr parser |
| `_styleParseBase` | 838 | 854 | meta | high | style expr Pratt parser entry |
| `_styleParseExpr` | 855 | 873 | meta | high | style expr parser entry |
| `_resolveStyleObjectReference` | 874 | 897 | meta | high | style expr parser |
| `_parseStyleExprFromRaw` | 898 | 908 | meta | high | `parseStyleExpressionAttr` |
| `parseStyleExpressionAttr` | 909 | 921 | meta | high | attrs_dispatch.js |
| `_styleExprCollectKeys` | 922 | 933 | meta | low | `parseStyleExpressionAttr` |
| `_styleExprResolveField` | 934 | 949 | meta | low | `parseStyleExpressionAttr` |
| `_pendingStyleFieldMeta` | 950 | 958 | meta | low | pending style system |
| `_pendingStyleFieldEntryIndex` | 959 | 969 | meta | low | pending style system |
| `_pendingStyleFieldExpr` | 970 | 975 | meta | low | pending style system |
| `_pendingStyleSetField` | 976 | 982 | meta | low | pending style system |
| `_pendingStylePlaceholder` | 983 | 989 | meta | low | pending style system |
| `_pendingStyleLiteralExpr` | 990 | 1010 | meta | low | pending style system |
| `_pendingStyleExprValue` | 1011 | 1024 | meta | low | pending style system |
| `_pendingStyleSpecExpr` | 1025 | 1037 | meta | low | pending style system |
| `_pendingStyleSpecIsBase` | 1038 | 1043 | meta | low | pending style system |
| `applyPendingStyleExprs` | 1044 | 1084 | meta | high | parseJSXElement |
| `_condPropValue` | 1085 | 1094 | meta | high | parse/brace/conditional.js, parse/children/brace.js |
| `slotSet` | 1095 | 1104 | meta | high | parse/handlers/press.js, emit/handlers.js |
| `parseHandler` | 1105 | 1249 | meta | high | parse/element/attrs_handlers.js |
| `luaParseValueExpr` | 1250 | 1347 | lua | high | parse/element/attrs_*, parse/children/brace.js |
| `luaParseHandler` | 1348 | 1528 | lua | high | parse/element/attrs_handlers.js |
| `parseValueExpr` | 1529 | 1607 | meta | high | parse/element/attrs_*, parse/children/brace.js |

---

## 7. PARSE — `smith/parse/`

### `smith/parse/brace/conditional.js` (641 lines)
**Purpose:** Conditional brace parsing — `tryParseConditional` handles `{condition && <X>}`, `{cond ? <A> : <B>}` in JSX children; dispatches to Zig or Lua conditional paths.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `_luaQuoteCondString` | 3 | 10 | lua | low | internal |
| `_looksDynamicJsExpr` | 11 | 18 | meta | low | `tryParseConditional` |
| `_splitTopLevelJsTernary` | 19 | 110 | meta | high | `tryParseConditional` |
| `_normalizeLuaRuntimeExpr` | 111 | 131 | lua | low | `_buildLuaCondFromTokens` |
| `_looksBooleanLikeRuntimeExpr` | 132 | 136 | meta | low | `_buildLuaCondFromTokens` |
| `_peekNumericComparison` | 137 | 147 | meta | low | `_buildLuaCondFromTokens` |
| `_luaBoolNumericComparison` | 148 | 157 | lua | low | `_buildLuaCondFromTokens` |
| `_isStaticStringPropValue` | 158 | 172 | meta | low | internal |
| `_isStringLikePropExpr` | 173 | 181 | meta | low | internal |
| `_condComparatorContext` | 34 | 43 | meta | low | `_buildLuaCondFromTokens` |
| `_luaCondPropExpr` | 44 | 61 | lua | low | `_buildLuaCondFromTokens` |
| `_luaCondPropLengthExpr` | 62 | 69 | lua | low | `_buildLuaCondFromTokens` |
| `_buildLuaCondFromTokens` | 70 | 212 | lua | high | `tryParseConditional` |
| `tryParseConditional` | 213 | 641 | meta | high | parse/children/brace.js |

---

### `smith/parse/brace/ternary.js` (539 lines)
**Purpose:** Ternary brace parsing — handles `{a ? b : c}` children with Zig or Lua output.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `_resolveOaBracketIdx` | 4 | 28 | meta | low | internal |
| `_resolveStringComparison` | 29 | 73 | meta | low | `tryParseTernaryJSX` |
| `_parseTernaryCondParts` | 74 | 270 | meta | high | `tryParseTernaryJSX`, `tryParseTernaryText` |
| `_parseTernaryBranchNode` | 271 | 310 | meta | high | `tryParseTernaryJSX` |
| `tryParseTernaryJSX` | 311 | 424 | meta | high | parse/children/brace.js |
| `_escapeTernaryTextLiteral` | 425 | 432 | meta | low | `tryParseTernaryText` |
| `_normalizeLuaTernaryCond` | 433 | 441 | lua | low | `tryParseTernaryText` |
| `_resolveTernaryTextMarkers` | 442 | 450 | meta | low | `_parseNestedTernaryTextExpr` |
| `_parseNestedTernaryTextExpr` | 451 | 499 | meta | high | `tryParseTernaryText` |
| `_nestedTernaryTextToZig` | 500 | 508 | zig | high | `tryParseTernaryText` |
| `_nestedTernaryTextToLua` | 509 | 517 | lua | high | `tryParseTernaryText` |
| `tryParseTernaryText` | 518 | 539 | meta | high | parse/children/brace.js |

---

### `smith/parse/children/brace.js` (838 lines)
**Purpose:** Brace child dispatcher — `tryParseBraceChild` is the main `{...}` child handler; routes to maps, conditionals, ternaries, render-locals, computed expressions.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `tryParseBraceChild` | 5 | 838 | meta | high | parseChildren (parse.js), parse/element/* |

---

### `smith/parse/children/brace_maps.js` (514 lines)
**Purpose:** Map brace parsing — `_tryParseIdentifierMapExpression` handles `{items.map(...)}` children; drives map header + body parse.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `_tryParseComputedChainMap` | 1 | 152 | meta | high | tryParseBraceChild |
| `_identifierStartsMapCall` | 153 | 185 | meta | low | `_tryParseIdentifierMapExpression` |
| `_identifierMapHasBlockBody` | 186 | 234 | meta | low | `_tryParseIdentifierMapExpression` |
| `_peekMapBodyHasDynamicContent` | 235 | 281 | meta | low | `_tryParseIdentifierMapExpression` |
| `_tryParseIdentifierMapExpression` | 282 | 514 | meta | high | tryParseBraceChild |

---

### `smith/parse/children/brace_computed.js` (184 lines)
**Purpose:** Computed brace child — handles `{expr}` expressions that resolve to display values; `_syntheticFieldType` classifies field access types.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `_syntheticFieldType` | 1 | 8 | meta | high | brace.js, brace_maps.js, emit_ops/* |
| `_sanitizeComputedGetter` | 9 | 14 | meta | low | `_ensureSyntheticComputedOa` |
| `_findAliasPropertyPaths` | 15 | 28 | meta | low | `_buildDestructuredComputedPlan` |
| `_aliasUsedBare` | 29 | 39 | meta | low | `_buildDestructuredComputedPlan` |
| `_buildDestructuredComputedPlan` | 40 | 92 | meta | high | tryParseBraceChild |
| `_ensureSyntheticComputedOa` | 93 | 184 | meta | high | tryParseBraceChild |

---

### `smith/parse/children/brace_render_local.js` (52 lines)
**Purpose:** Render-local brace handling — resolves `{localVar}` references collected in render_locals phase.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `_tryParseStoredRenderLocal` | 1 | 52 | meta | low | tryParseBraceChild |

---

### `smith/parse/children/brace_util.js` (67 lines)
**Purpose:** Brace parsing utilities — peek/skip helpers shared across brace sub-parsers.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `_joinTokenText` | 1 | 6 | meta | low | brace.js, brace_maps.js |
| `_expandRenderLocalJs` | 7 | 23 | meta | low | brace.js, brace_computed.js |
| `_expandRenderLocalJsFully` | 24 | 33 | meta | low | brace.js |
| `_makeEvalTruthyExpr` | 34 | 37 | meta | low | brace.js |
| `_normalizeJoinedJsExpr` | 38 | 50 | meta | low | brace.js, brace_computed.js |
| `_findLastTopLevelAmpAmp` | 51 | 67 | meta | low | brace.js |

---

### `smith/parse/children/conditional_blocks.js` (394 lines)
**Purpose:** Chad `<if>/<else>/<during>` block parsing — handles chad-tier conditional syntax in children.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `_resolveComputedFieldAccess` | 21 | 44 | meta | low | `parseBlockCondition` |
| `parseBlockCondition` | 45 | 253 | meta | high | `parseIfBlock`, `parseDuringBlock` |
| `wrapConditionalChildren` | 254 | 294 | meta | high | `parseIfBlock`, `parseElseBlock`, `parseDuringBlock` |
| `parseIfBlock` | 295 | 322 | meta | high | parseChildren (parse.js), lanes/chad.js |
| `parseElseBlock` | 323 | 372 | meta | high | parseChildren (parse.js), lanes/chad.js |
| `parseDuringBlock` | 373 | 394 | meta | high | parseChildren (parse.js), lanes/chad.js |

---

### `smith/parse/children/elements.js` (63 lines)
**Purpose:** Child element entry — routes JSX children to `parseJSXElement` or text or brace handlers.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `tryParseElementChild` | 3 | 63 | meta | high | parseChildren |

---

### `smith/parse/children/inline_glyph.js` (61 lines)
**Purpose:** Inline `<Glyph>` parsing — handles `<Glyph d="..." />` inside `<Text>` children.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `readInlineGlyphAttrValue` | 3 | 23 | zig | low | `parseInlineGlyph` |
| `parseInlineGlyph` | 24 | 61 | zig | low | parseChildren |

---

### `smith/parse/children/text.js` (114 lines)
**Purpose:** Text child parsing — handles raw text content and template literals in JSX children.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `_fuzzyGlyphMatch` | 4 | 14 | meta | low | `_resolveGlyphShortcodes` |
| `_editDistance` | 15 | 31 | meta | low | `_fuzzyGlyphMatch` |
| `_resolveGlyphShortcodes` | 32 | 84 | meta | low | `tryParseTextChild` |
| `tryParseTextChild` | 85 | 114 | meta | high | parseChildren |

---

### `smith/parse/element/attrs_basic.js` (158 lines)
**Purpose:** Basic attribute parsing — `width`, `height`, `padding`, `margin`, `borderRadius`, `opacity`, flex props.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `tryParseBasicElementAttr` | 3 | 119 | zig | high | parse/element/attrs_dispatch.js |
| `parseFontSizeAttr` | 120 | 158 | zig | low | `tryParseBasicElementAttr` |

---

### `smith/parse/element/attrs_canvas.js` (307 lines)
**Purpose:** Canvas attribute parsing — `<Canvas>` and `<Graph>` node attributes (stroke, fill, path data, etc.).

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `tryParseCanvasAttr` | 3 | 168 | zig | low | parse/element/attrs_dispatch.js |
| `parseCanvasPathDataAttr` | 169 | 214 | zig | low | `tryParseCanvasAttr` |
| `parseCanvasColorAttr` | 215 | 236 | zig | low | `tryParseCanvasAttr` |
| `parseCanvasNodeAxisAttr` | 237 | 281 | zig | low | `tryParseCanvasAttr` |
| `parseLegacyCanvasNodeAxisAttr` | 282 | 307 | zig | low | `tryParseCanvasAttr` |

---

### `smith/parse/element/attrs_dispatch.js` (80 lines)
**Purpose:** Attribute dispatcher — routes attr key to the correct attr parser module.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `parseElementAttr` | 3 | 80 | meta | high | parseJSXElement |

---

### `smith/parse/element/attrs_handlers.js` (121 lines)
**Purpose:** Handler attribute parsing — `onPress`, `onChange`, `onScroll` etc.; calls `parseHandler` or `luaParseHandler`.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `tryParseElementHandlerAttr` | 3 | 20 | meta | high | parse/element/attrs_dispatch.js |
| `parseElementPressAttr` | 21 | 44 | meta | high | `tryParseElementHandlerAttr` |
| `parseElementRenderAttr` | 45 | 84 | meta | low | `tryParseElementHandlerAttr` |
| `parseTextInputHandlerAttr` | 85 | 121 | meta | low | `tryParseElementHandlerAttr` |

---

### `smith/parse/element/attrs_spatial.js` (144 lines)
**Purpose:** Spatial attribute parsing — `x`, `y`, `z`, `rotation`, `scale` for 3D/canvas nodes.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `tryParseSpatialAttr` | 3 | 144 | zig | low | parse/element/attrs_dispatch.js |

---

### `smith/parse/element/attrs_text_color.js` (161 lines)
**Purpose:** Text + color attribute parsing — `color`, `fontSize`, `fontWeight`, `textAlign`, `lineHeight`.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `tryParseTextColorAttr` | 3 | 161 | zig | high | parse/element/attrs_dispatch.js |

---

### `smith/parse/element/component_brace_values.js` (314 lines)
**Purpose:** Component prop brace values — parses `{expr}` prop values passed to components; resolves state/OA accesses.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `resolveComponentRenderLocalValue` | 3 | 13 | meta | low | `parseComponentBraceValue` |
| `tryParseComponentBraceProp` | 14 | 30 | meta | high | parse/element/component_props.js |
| `tryResolveMappedComponentProp` | 31 | 91 | meta | high | `tryParseComponentBraceProp` |
| `parseComponentBraceValue` | 92 | 245 | meta | high | `tryParseComponentBraceProp` |
| `resolveComponentTemplateLiteralValue` | 246 | 272 | meta | low | `parseComponentBraceValue` |
| `resolveComponentIdentifierValue` | 273 | 297 | meta | low | `parseComponentBraceValue` |
| `normalizeComponentTernaryValue` | 298 | 314 | meta | low | `parseComponentBraceValue` |

---

### `smith/parse/element/component_handlers.js` (53 lines)
**Purpose:** Component handler props — parses `onPress={fn}` and similar passed to component instances.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `tryParseComponentHandlerProp` | 3 | 31 | meta | low | parse/element/component_props.js |
| `isPressLikeComponentAttr` | 32 | 36 | meta | low | `tryParseComponentHandlerProp` |
| `startsArrowHandler` | 37 | 53 | meta | low | `tryParseComponentHandlerProp` |

---

### `smith/parse/element/component_inline.js` (301 lines)
**Purpose:** Inline component expansion — expands component calls inline when the component body is available.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `parseComponentCallChildren` | 3 | 18 | meta | low | `inlineComponentCall` |
| `inlineComponentCall` | 19 | 301 | meta | high | parseJSXElement |

---

### `smith/parse/element/component_props.js` (28 lines)
**Purpose:** Component props collection — accumulates prop key/value pairs for a component instance.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `collectComponentPropValues` | 3 | 28 | meta | low | parse/element/component_inline.js |

---

### `smith/parse/element/component_spread.js` (27 lines)
**Purpose:** Spread props — handles `{...props}` spread in component instances.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `tryParseComponentPropSpread` | 3 | 27 | meta | low | parse/element/component_props.js |

---

### `smith/parse/element/defaults.js` (84 lines)
**Purpose:** Element defaults — applies default style/layout values for known tags (Box, Text, ScrollView, etc.).

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `initElementParseState` | 3 | 84 | zig | high | parseJSXElement, parse/element/postprocess.js |

---

### `smith/parse/element/flow.js` (70 lines)
**Purpose:** Element flow control — handles early-return patterns, null guards, conditional rendering at element level.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `tryParseFragmentElement` | 3 | 15 | meta | low | parseJSXElement |
| `skipScriptElement` | 16 | 29 | meta | low | parseJSXElement |
| `skipLScriptElement` | 30 | 43 | meta | low | parseJSXElement |
| `finishParsedElement` | 44 | 70 | meta | high | parseJSXElement |

---

### `smith/parse/element/postprocess.js` (94 lines)
**Purpose:** Post-parse element processing — applies classifiers, merges inherited styles, finalizes node fields.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `finalizeElementAttrState` | 3 | 10 | meta | high | parseJSXElement |
| `applyCanvasDerivedFields` | 11 | 20 | meta | low | `finalizeElementAttrState` |
| `applyClassifierDefaults` | 21 | 27 | meta | high | `finalizeElementAttrState` |
| `bindVariantState` | 28 | 78 | meta | high | `finalizeElementAttrState` |
| `ensureAscriptAutoHandler` | 79 | 94 | meta | low | `finalizeElementAttrState` |

---

### `smith/parse/element/tags.js` (58 lines)
**Purpose:** Tag resolution — maps JSX tag name to node type (`Box`, `Text`, etc.); handles unknown tag fallback.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `normalizeRawTag` | 3 | 58 | meta | high | parseJSXElement |

---

### `smith/parse/element/value_readers.js` (98 lines)
**Purpose:** Prop value readers — low-level token reads for string literals, number literals, boolean shorthands.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `parseSignedNumberToken` | 3 | 15 | meta | low | attrs_basic.js, attrs_canvas.js |
| `parseVectorValueToken` | 16 | 41 | meta | low | value_readers internal |
| `parseBracketVectorValues` | 42 | 52 | meta | low | attrs_spatial.js |
| `parseBracedVectorValues` | 53 | 68 | meta | low | attrs_spatial.js |
| `parseNumericAttrValue` | 69 | 87 | meta | high | attrs_basic.js, attrs_text_color.js |
| `pushAxisFields` | 88 | 93 | meta | low | attrs_spatial.js |
| `pushUniformAxisFields` | 94 | 98 | meta | low | attrs_spatial.js |

---

### `smith/parse/handlers/press.js` (173 lines)
**Purpose:** Press handler parsing — specialized parser for `onPress` handler bodies; handles Lua and QJS paths.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `collectHandlerZigProps` | 3 | 15 | meta | low | `pushInlinePressHandler` |
| `pushBarePressHandler` | 16 | 30 | meta | high | attrs_handlers.js, parse/brace/conditional.js |
| `pushNamedPressHandler` | 31 | 47 | meta | high | attrs_handlers.js |
| `pushInlinePressHandler` | 48 | 127 | meta | high | attrs_handlers.js |
| `tryConsumeForwardedPressHandler` | 128 | 151 | meta | low | `pushInlinePressHandler` |
| `bindPressHandlerExpression` | 152 | 173 | meta | high | `pushInlinePressHandler` |

---

### `smith/parse/map/context.js` (46 lines)
**Purpose:** Map parse context — `enterMapContext`/`exitMapContext` manage per-map cursor state during map body parse.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `enterMapContext` | 3 | 27 | meta | high | parse/map/header.js, parse/children/brace_maps.js |
| `exitMapContext` | 28 | 34 | meta | high | parse/map/header.js, parse/children/brace_maps.js |
| `consumeMapClose` | 35 | 41 | meta | low | parse/children/brace_maps.js |
| `finalizeMapNode` | 42 | 46 | meta | high | parse/children/brace_maps.js |

---

### `smith/parse/map/header.js` (226 lines)
**Purpose:** Map header parsing — `tryParseMapHeader` reads `.map((item, idx) =>` signature, extracts param names, handles null guards.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `readMapParamList` | 3 | 31 | meta | high | `tryParseMapHeader`, `tryParseMapHeaderFromMethod` |
| `_invertMapNullGuard` | 32 | 47 | meta | low | `_consumeMapNullGuard` |
| `_consumeMapNullGuard` | 48 | 96 | meta | high | `tryParseMapHeader` |
| `tryParseMapHeader` | 97 | 184 | meta | high | parse/children/brace_maps.js |
| `tryParseMapHeaderFromMethod` | 185 | 226 | meta | high | parse/children/brace_maps.js |

---

### `smith/parse/map/for_loop.js` (147 lines)
**Purpose:** For-loop map — handles chad `<For>` syntax and `for...of` loop patterns as map equivalents.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `parseForEachName` | 3 | 39 | meta | low | `parseForLoop` |
| `resolveForLoopOa` | 40 | 67 | meta | high | `parseForLoop` |
| `attachForTemplateChildren` | 68 | 103 | meta | low | `parseForLoop` |
| `parseForTemplateNode` | 104 | 111 | meta | high | `parseForLoop` |
| `consumeForClose` | 112 | 119 | meta | low | `parseForLoop` |
| `parseForLoop` | 120 | 147 | meta | high | parse/children/conditional_blocks.js, lanes/chad.js |

---

### `smith/parse/map/infer_oa.js` (183 lines)
**Purpose:** OA type inference — infers object-array field types from map body usage when not explicitly declared.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `inferOaFromSource` | 4 | 183 | meta | high | parse/children/brace_maps.js |

---

### `smith/parse/map/info.js` (24 lines)
**Purpose:** Map info accessors — small getters for current map metadata (index, type, etc.).

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `createMapInfo` | 3 | 24 | meta | low | parse/map/* |

---

### `smith/parse/map/nested.js` (29 lines)
**Purpose:** Nested map detection — identifies `.map()` calls nested inside another map body.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `tryParseNestedMap` | 4 | 29 | meta | low | parse/children/brace_maps.js |

---

### `smith/parse/map/plain.js` (73 lines)
**Purpose:** Plain map body parse — walks a simple `item => <Node />` map body, no destructuring.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `_attachMapRenderLocalAliases` | 3 | 18 | meta | low | `tryParsePlainMap` |
| `tryParsePlainMap` | 19 | 46 | meta | high | parse/children/brace_maps.js |
| `tryParsePlainMapFromMethod` | 47 | 73 | meta | high | parse/children/brace_maps.js |

---

### `smith/parse/template_literal.js` (313 lines)
**Purpose:** Template literal parsing — handles `` `string ${expr}` `` in JSX attribute values and children; resolves to Zig format strings.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `parseTemplateLiteral` | 4 | 35 | zig | high | attrs.js, parse/children/text.js, parseValueExpr |
| `_resolveTemplateExpr` | 36 | 130 | meta | high | `parseTemplateLiteral` |
| `_resolveSimpleIdent` | 131 | 183 | meta | high | `_resolveTemplateExpr` |
| `_resolveMapItemField` | 184 | 213 | meta | high | `_resolveTemplateExpr` |
| `_resolveTernaryExpr` | 214 | 221 | meta | low | `_resolveTemplateExpr` |
| `_parseTernaryExpr` | 222 | 274 | meta | high | `_resolveTernaryExpr` |
| `_resolveMapContextExpr` | 275 | 313 | meta | high | `_resolveTemplateExpr` |

---

### `smith/parse/utils.js` (58 lines)
**Purpose:** Parse utilities — `skipBraces`, `skipParens`, `peekIdent`, `peekToken` shared across all parse modules.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `resolveTag` | 3 | 6 | meta | low | parseJSXElement |
| `readTagToken` | 7 | 16 | meta | low | parseJSXElement |
| `readQualifiedClosingTag` | 17 | 36 | meta | low | parseJSXElement |
| `lastTokenOffset` | 37 | 40 | meta | low | parse/* broadly |
| `skipBraces` | 41 | 51 | meta | high | parse/*, attrs.js, collect/* (6+ files) |
| `offsetToLine` | 52 | 58 | meta | low | error reporting |

---

## 8. RESOLVE — `smith/resolve/`

### `smith/resolve/comparison.js` (67 lines)
**Purpose:** Comparison resolution — `resolveComparison` converts word comparisons (`exact`, `above`, `below`) to Zig/Lua condition expressions.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `resolveComparison` | 12 | 62 | meta | high | parse/brace/conditional.js, parse/children/brace.js, attrs.js |
| `normalizeOp` | 63 | 67 | meta | low | `resolveComparison` |

---

### `smith/resolve/eval_builder.js` (89 lines)
**Purpose:** Eval expression builder — `buildEval`, `isEval`, `extractInner` construct `__eval` call wrappers for QJS runtime evaluation.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `allocBuf` | 11 | 19 | meta | low | `buildEval`, `buildBoolEval` |
| `buildEval` | 20 | 27 | qjs | high | parse/*, emit/logic_blocks.js |
| `buildBoolEval` | 28 | 35 | qjs | high | parse/brace/conditional.js |
| `buildComparisonEval` | 36 | 43 | qjs | high | resolve/comparison.js |
| `buildFieldEval` | 44 | 54 | qjs | high | resolve/field_access.js |
| `extractInner` | 55 | 78 | meta | high | emit/logic_blocks.js, emit_ops/* |
| `extractRuntimeJsExpr` | 79 | 91 | meta | low | emit/logic_blocks.js |
| `buildVarEval` | 92 | 98 | qjs | low | parse/children/brace.js |
| `isEval` | 99 | 89 | meta | high | emit/*, emit_ops/* |

---

### `smith/resolve/field_access.js` (131 lines)
**Purpose:** Field access resolution — resolves dot-notation field access on OA items, state objects, props.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `resolveField` | 11 | 128 | meta | high | parse/children/brace.js, parse/children/brace_computed.js |
| `resolveLength` | 129 | 131 | meta | low | `resolveField` |

---

### `smith/resolve/identity.js` (139 lines)
**Purpose:** Identity resolution — `resolveIdentity` maps a bare identifier to its source (slot, OA field, prop, render-local, const).

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `resolveIdentity` | — | 139 | meta | high | parse/children/brace.js, parse/brace/conditional.js, attrs.js |

---

### `smith/resolve/ternary.js` (53 lines)
**Purpose:** Ternary resolution — resolves ternary branches to Zig or Lua conditional expressions.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `zigTernary` | 10 | 46 | zig | high | parse/brace/ternary.js, parse/brace/conditional.js |
| `stripQuotes` | 47 | 53 | meta | low | `zigTernary` |

---

### `smith/resolve/truthiness.js` (55 lines)
**Purpose:** Truthiness resolution — `zigBool` converts JS truthiness expressions to Zig boolean conditions.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `zigBool` | — | 55 | zig | high | parse/brace/conditional.js, parse/children/brace.js, resolve/comparison.js |

---

## 9. EMIT — `smith/emit.js` + `smith/emit/`

### `smith/emit.js` (95 lines)
**Purpose:** Emit orchestrator — `emitOutput` is the single emit entry point; routes to Lua-tree path or Zig path, calls all emit/* sub-passes in order.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `emitOutput` | 1 | 95 | meta | high | lanes/shared.js finishParsedLane (8 files) |

---

### `smith/emit/preamble.js` (49 lines)
**Purpose:** Zig file preamble — imports, module header, compile-time constants.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `emitPreamble` | 3 | 49 | zig | high | emitOutput |

---

### `smith/emit/state_manifest.js` (24 lines)
**Purpose:** State manifest + init — emits `state_count`, state slot declarations, `initState`.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `emitStateManifest` | 3 | 13 | zig | high | emitOutput |
| `emitInitState` | 14 | 24 | zig | high | emitOutput |

---

### `smith/emit/node_tree.js` (14 lines)
**Purpose:** Node tree emission — calls `emitNodeTree` to walk the parsed node tree and emit Zig node declarations.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `emitNodeTree` | 3 | 14 | zig | high | emitOutput |

---

### `smith/emit/object_arrays.js` (36 lines)
**Purpose:** Object array infrastructure — emits OA bridge declarations (QJS↔Zig unpack stubs).

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `emitObjectArrayInfrastructure` | 4 | 36 | qjs | high | emitOutput |

---

### `smith/emit/handlers.js` (10 lines)
**Purpose:** Non-map handler emission — emits `onPress` handler function bodies for non-map nodes.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `emitNonMapHandlers` | 3 | 10 | zig | high | emitOutput |

---

### `smith/emit/effects.js` (29 lines)
**Purpose:** Effect renderer emission — emits CPU effect render functions (pixel buffer drawers).

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `emitEffectRenders` | 3 | 29 | zig | low | emitOutput |

---

### `smith/emit/logic_blocks.js` (128 lines)
**Purpose:** Logic block emission — emits `JS_LOGIC` and `LUA_LOGIC` sections for QJS/Lua runtime logic.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `emitLogicBlocks` | 4 | 128 | qjs | high | emitOutput (4 files) |

---

### `smith/emit/map_pools.js` (37 lines)
**Purpose:** Map pool declarations + rebuilds — emits Zig pool arrays and rebuild functions for all maps.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `emitMapPoolDeclarations` | 5 | 23 | zig | high | emitOutput |
| `emitMapPoolRebuilds` | 24 | 28 | zig | high | emitOutput |
| `appendOrphanedMapArrays` | 29 | 37 | zig | low | emitOutput |

---

### `smith/emit/entrypoints.js` (109 lines)
**Purpose:** Runtime entrypoints — emits `app_get_init`, `app_get_tick`, `app_get_root`, exports.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `emitRuntimeEntrypoints` | 3 | 109 | zig | high | emitOutput |

---

### `smith/emit/runtime_updates.js` (102 lines)
**Purpose:** Runtime update section — emits the dirty-check tick, state setters, conditional display toggles.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `emitRuntimeSupportSections` | 4 | 102 | zig | high | emitOutput |

---

### `smith/emit/dyn_text.js` (22 lines)
**Purpose:** Dynamic text buffer emission — emits Zig buf arrays for dynamic text nodes.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `emitDynamicTextBuffers` | 3 | 22 | zig | high | emitOutput |

---

### `smith/emit/split.js` (306 lines)
**Purpose:** Split output — `splitOutput` divides monolithic Zig output into per-section files for the split build path.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `splitOutput` | 1 | 306 | meta | high | emitOutput (split mode) |

---

### `smith/emit/finalize.js` (23 lines)
**Purpose:** Emit finalization — `finalizeEmitOutput` appends debug sections, writes output to Forge globals.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `appendEmitDebugSections` | 3 | 15 | meta | low | `finalizeEmitOutput` |
| `appendSourcePaletteComment` | 16 | 31 | meta | low | `finalizeEmitOutput` |
| `finalizeEmitOutput` | 32 | 23 | meta | high | emitOutput, emit/lua_tree_emit.js |

---

### `smith/emit/transforms.js` (163 lines)
**Purpose:** Code transforms — `luaTransform` post-processes generated Lua (escaping, fixups), `jsTransform` post-processes JS logic blocks.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `luaTransform` | 8 | 146 | lua | high | emit/lua_tree_emit.js, emit_ops/emit_lua_element.js, emit_ops/* (8 files) |
| `jsTransform` | 147 | 163 | qjs | high | emit/logic_blocks.js, emit/entrypoints.js |

---

### `smith/emit/lua_tree_emit.js` (412 lines)
**Purpose:** Lua-tree full emission — `emitLuaTreeApp` generates the complete Lua app from the lua-first parse path (used when `ctx._luaRootNode` is set).

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `emitLuaTreeApp` | 9 | 405 | lua | high | emitOutput (lua-tree branch) |
| `_luaLiteral` | 406 | 412 | lua | low | `emitLuaTreeApp` |

---

### `smith/emit/effect_transpile.js` (172 lines)
**Purpose:** CPU effect transpiler — `transpileEffectBody` converts JS effect function bodies to Zig pixel-shader code.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `transpileEffectBody` | 7 | 102 | zig | high | emit/effects.js, emit_ops/effect_transpile.js |
| `transpileExpr` | 103 | 161 | zig | high | `transpileEffectBody` |
| `splitArgs` | 162 | 172 | meta | high | `transpileExpr` |

---

### `smith/emit/effect_wgsl.js` (361 lines)
**Purpose:** WGSL effect transpiler — `transpileEffectToWGSL` converts JS effect functions to WGSL GPU shader code.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `_effectMathWGSL` | 7 | 83 | zig | low | `transpileEffectToWGSL` |
| `transpileEffectToWGSL` | 84 | 308 | zig | high | emit/effects.js, emit_atoms/handlers_effects/a011_wgsl_effect_shaders.js |
| `transpileExprWGSL` | 309 | 361 | zig | high | `transpileEffectToWGSL` |

---

## 10. EMIT OPS — `smith/emit_ops/`

*Emit ops are fine-grained code generation helpers called from `emit/` modules and `emit_atoms/`. Each is a pure function: takes ctx + meta, returns a Zig or Lua code string.*

### `smith/emit_ops/rebuild_map.js` (827 lines)
**Purpose:** Map rebuild codegen — `rebuildMap` generates the Zig rebuild function body for a given map; the largest single emit-op.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `rebuildMap` | 20 | 827 | zig | high | emit/map_pools.js, emit_atoms/maps_zig/* |

---

### `smith/emit_ops/emit_lua_element.js` (569 lines)
**Purpose:** Lua element codegen — `emitLuaElement` generates Lua table constructor for a node and its children.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `emitLuaElement` | 11 | 375 | lua | high | emit/lua_tree_emit.js, emit_atoms/maps_lua/* |
| `emitLuaChildren` | 376 | 569 | lua | high | `emitLuaElement` |

---

### `smith/emit_ops/js_expr_to_lua.js` (64 lines)
**Purpose:** JS expression → Lua transpiler — `_jsExprToLua` converts JS expressions used in map bodies to Lua equivalents.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `_bitwiseToLua` | 7 | 24 | lua | low | `_jsExprToLua` |
| `_jsExprToLua` | 25 | 64 | lua | high | emit_ops/emit_lua_element.js, emit_ops/emit_lua_style.js, emit_ops/emit_lua_text.js, emit_atoms/maps_lua/* |

---

### `smith/emit_ops/transforms.js` (159 lines)
**Purpose:** Duplicate of emit/transforms.js — `luaTransform` and `jsTransform` shared between emit and emit_ops paths.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `luaTransform` | 8 | 146 | lua | high | emit_ops/emit_lua_element.js, emit_ops/emit_lua_style.js |
| `jsTransform` | 147 | 159 | qjs | high | emit_ops/* |

*Note: Duplication with `emit/transforms.js` — candidate for consolidation.*

---

### `smith/emit_ops/compute_map_meta.js` (117 lines)
**Purpose:** Map metadata computation — `buildMapEmitOrder`, `computePromotedMapArrays` pre-compute per-map metadata used across all map emit passes.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `buildMapEmitOrder` | 1 | 14 | meta | high | emitOutput, emit_atoms/index.js |
| `ensureMapHandlerFieldRefs` | 15 | 40 | meta | high | `buildMapEmitOrder` |
| `computePromotedMapArrays` | 41 | 105 | meta | high | `buildMapEmitOrder` |
| `countTopLevelNodeDeclEntries` | 106 | 117 | meta | low | `computePromotedMapArrays` |

---

### `smith/emit_ops/emit_display_toggle.js` (51 lines)
**Purpose:** Display toggle codegen — emits Zig conditional display show/hide logic for nodes.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `wrapMapCondition` | 12 | 38 | zig | low | `emitDisplayToggle` |
| `emitDisplayToggle` | 39 | 51 | zig | high | emit/runtime_updates.js, emit_atoms/logic_runtime/* |

---

### `smith/emit_ops/emit_variant_patch.js` (141 lines)
**Purpose:** Variant patch codegen — emits Zig code to swap node fields when state variants change.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `emitVariantPatch` | 8 | 141 | zig | high | emit/runtime_updates.js, emit_atoms/logic_runtime/a037_variant_updates.js |

---

### `smith/emit_ops/emit_state_setters.js` (48 lines)
**Purpose:** State setter codegen — emits `set_<slot>` Zig functions for each state slot.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `emitStateSetters` | 12 | 48 | zig | high | emit/runtime_updates.js |

---

### `smith/emit_ops/emit_oa_bridge.js` (28 lines)
**Purpose:** OA bridge codegen — emits the QJS↔Zig object-array unpack trampoline.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `emitOABridge` | 16 | 28 | qjs | high | emit/object_arrays.js |

---

### `smith/emit_ops/emit_map_decl.js` (21 lines)
**Purpose:** Map declaration — emits Zig pool array declaration for one map.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `emitMapDecl` | 1 | 21 | zig | high | emit_atoms/maps_zig/a020_flat_map_pool_decls.js, a021, a022 |

---

### `smith/emit_ops/emit_map_press.js` (117 lines)
**Purpose:** Map press handler codegen — emits Lua/Zig press handler bodies for map items.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `emitMapPressFlatLua` | 22 | 54 | lua | low | `emitMapPressBody` |
| `emitMapPressNestedLua` | 55 | 105 | lua | low | `emitMapPressBody` |
| `emitMapPressBody` | 106 | 117 | meta | high | emit_atoms/maps_zig/a026_flat_map_rebuild.js |

---

### `smith/emit_ops/emit_pool_node.js` (44 lines)
**Purpose:** Pool node codegen — emits Zig node assignment into pool array slot.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `emitPoolNodeAssign` | 23 | 44 | zig | high | emit_ops/rebuild_map.js |

---

### `smith/emit_ops/emit_dyn_text.js` (50 lines)
**Purpose:** Map dynamic text codegen — emits Zig buf format call for dynamic text inside map items.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `emitMapDynText` | 21 | 50 | zig | high | emit_ops/rebuild_map.js |

---

### `smith/emit_ops/emit_inner_array.js` (100 lines)
**Purpose:** Inner array codegen — emits Zig inner array declarations for nested map structures.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `emitInnerArray` | 29 | 100 | zig | high | emit_ops/rebuild_map.js |

---

### `smith/emit_ops/emit_lua_rebuild.js` (46 lines)
**Purpose:** Lua rebuild list codegen — emits Lua table rebuild iteration for map items.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `emitLuaRebuildList` | 5 | 46 | lua | high | emit_atoms/maps_lua/a030_lua_map_rebuilder_functions.js |

---

### `smith/emit_ops/emit_lua_style.js` (99 lines)
**Purpose:** Lua style codegen — emits Lua style table fields for a node.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `emitLuaStyle` | 5 | 99 | lua | high | emit_ops/emit_lua_element.js |

---

### `smith/emit_ops/emit_lua_text.js` (69 lines)
**Purpose:** Lua text content codegen — emits Lua text value expression for Text nodes.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `_emitLuaQuoted` | 4 | 7 | lua | low | `emitLuaTextContent` |
| `_readLuaGlyphAttrValue` | 8 | 41 | lua | low | `_emitLuaInlineGlyph` |
| `_emitLuaInlineGlyph` | 42 | 98 | lua | low | `emitLuaTextContent` |
| `emitLuaTextContent` | 99 | 69 | lua | high | emit_ops/emit_lua_element.js |

---

### `smith/emit_ops/zig_node_to_lua.js` (54 lines)
**Purpose:** Zig node expression → Lua accessor — converts Zig node expression to its Lua rebuild equivalent.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `_zigNodeExprToLua` | 4 | 32 | lua | low | `_nodeResultToLuaRebuilder` |
| `_nodeResultToLuaRebuilder` | 33 | 54 | lua | high | emit_atoms/maps_lua/* |

---

### `smith/emit_ops/hex_to_color.js` (15 lines)
**Purpose:** Color conversion — hex string to Lua RGBA float tuple.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `hexToLuaColor` | 4 | 9 | lua | low | emit_ops/emit_lua_style.js, emit_ops/emit_lua_element.js |
| `_luaColorOrPassthrough` | 10 | 15 | lua | low | `hexToLuaColor` |

---

### `smith/emit_ops/emit_orphan_arrays.js` (74 lines)
**Purpose:** Orphan array codegen — emits Zig arrays for OA items that don't map to a pool node.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `emitOrphanArrays` | 12 | 74 | zig | low | emit/map_pools.js |

---

### `smith/emit_ops/emit_handler_fmt.js` (57 lines)
**Purpose:** Handler format string codegen — emits Zig `std.fmt.bufPrint` calls for handlers with format arguments.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `emitHandlerFmt` | 23 | 42 | zig | low | emit_ops/rebuild_map.js |
| `buildFieldRefFmtArgs` | 43 | 57 | zig | low | `emitHandlerFmt` |

---

### `smith/emit_ops/emit_handler_storage.js` (24 lines)
**Purpose:** Handler storage codegen — emits Zig buf declaration for handler string storage.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `emitHandlerStorage` | 1 | 24 | zig | low | emit_ops/rebuild_map.js |

---

### `smith/emit_ops/emit_text_storage.js` (10 lines)
**Purpose:** Text storage codegen — emits Zig buf declaration for dynamic text storage.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `emitTextStorage` | 1 | 10 | zig | low | emit_ops/rebuild_map.js |

---

### `smith/emit_ops/emit_per_item_arr.js` (9 lines)
**Purpose:** Per-item array codegen — emits Zig per-item array declaration.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `emitPerItemArrDecl` | 1 | 9 | zig | low | emit_atoms/maps_zig/a023_map_per_item_arrays.js |

---

### `smith/emit_ops/emit_arena.js` (3 lines)
**Purpose:** Arena declaration — emits Zig arena allocator declaration stub.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `emitArenaDecl` | 1 | 3 | zig | low | emit/* |

---

### `smith/emit_ops/replace_field_refs.js` (27 lines)
**Purpose:** Field reference substitution — replaces `{field}` placeholders in handler template strings.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `replaceFieldRefs` | 9 | 27 | zig | low | emit_ops/rebuild_map.js |

---

### `smith/emit_ops/style_assignments.js` (16 lines)
**Purpose:** Style assignment codegen — emits Zig field assignments from a style string.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `styleAssignments` | 5 | 16 | zig | low | emit_ops/rebuild_map.js |

---

### `smith/emit_ops/wire_handler_ptrs.js` (37 lines)
**Purpose:** Handler pointer wiring — emits Zig handler function pointer assignments in pool node slots.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `wireHandlerPtrs` | 19 | 37 | zig | high | emit_ops/rebuild_map.js |

---

### `smith/emit_ops/wrap_condition.js` (15 lines)
**Purpose:** Condition wrapper — wraps a condition expression in a Zig boolean coerce.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `wrapCondition` | 1 | 15 | zig | low | emit_ops/emit_display_toggle.js |

---

### `smith/emit_ops/constants.js` (31 lines)
**Purpose:** Shared emit constants — tag name lists, node type maps, style property sets.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| *(constants only — no functions)* | — | 31 | meta | high | emit_ops/* broadly |

---

## 11. EMIT ATOMS — `smith/emit_atoms/`

*Emit atoms are numbered sections (`a001`–`a046`) that correspond 1:1 to sections of the generated Zig output. Each atom has exactly two functions: `_aXXX_applies(ctx, meta)` (returns bool) and `_aXXX_emit(ctx, meta)` (returns string). They are dispatched by `emit_atoms/index.js`.*

### `smith/emit_atoms/index.js` (23 lines)
**Purpose:** Atom dispatch table — registers all atoms in order, runs `applies`/`emit` pairs, assembles output.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `runEmitAtoms` | 14 | 23 | meta | high | emitOutput (after atom activation) |

---

### Preamble atoms (`a001`–`a003`)
| file | atom | lines | purpose | ownership | fragility |
|---|---|---|---|---|---|
| `preamble/a001_compile_banner.js` | a001 | 30 | compile banner comment | meta | low |
| `preamble/a002_core_imports.js` | a002 | 43 | `@import` framework modules | zig | high |
| `preamble/a003_runtime_imports.js` | a003 | 57 | runtime-specific imports | zig | high |

---

### State tree atoms (`a004`–`a008`)
| file | atom | lines | purpose | ownership | fragility |
|---|---|---|---|---|---|
| `state_tree/a004_state_manifest.js` | a004 | 36 | state count + slot decls | zig | high |
| `state_tree/a005_init_state_slots.js` | a005 | 40 | `initState` function body | zig | high |
| `state_tree/a006_static_node_arrays.js` | a006 | 37 | static node array declarations | zig | high |
| `state_tree/a007_root_node_init.js` | a007 | 32 | root node init | zig | high |
| `state_tree/a008_dynamic_text_buffers.js` | a008 | 51 | dyn-text buf declarations | zig | high |

---

### Handlers + effects atoms (`a009`–`a011`)
| file | atom | lines | purpose | ownership | fragility |
|---|---|---|---|---|---|
| `handlers_effects/a009_non_map_handlers.js` | a009 | 42 | non-map handler functions | zig | high |
| `handlers_effects/a010_cpu_effect_renderers.js` | a010 | 44 | CPU effect pixel functions | zig | low |
| `handlers_effects/a011_wgsl_effect_shaders.js` | a011 | 50 | WGSL shader strings | zig | low |

---

### Object array atoms (`a012`–`a018`)
| file | atom | lines | purpose | ownership | fragility |
|---|---|---|---|---|---|
| `object_arrays/a012_qjs_bridge.js` | a012 | 49 | QJS bridge trampoline | qjs | high |
| `object_arrays/a013_oa_string_helpers.js` | a013 | 42 | OA string helper fns | qjs | low |
| `object_arrays/a014_oa_const_storage.js` | a014 | 79 | const OA storage decls | zig | high |
| `object_arrays/a015_oa_dynamic_storage.js` | a015 | 220 | dynamic OA storage decls | zig | high |
| `object_arrays/a016_oa_flat_unpack.js` | a016 | 225 | flat OA unpack fn | zig | high |
| `object_arrays/a017_oa_nested_unpack.js` | a017 | 70 | nested OA unpack fn | zig | high |
| `object_arrays/a018_variant_host_setter.js` | a018 | 43 | variant host setter | zig | low |

---

### Maps Zig atoms (`a019`–`a028`)
| file | atom | lines | purpose | ownership | fragility |
|---|---|---|---|---|---|
| `maps_zig/a019_map_metadata.js` | a019 | 51 | map metadata constants | zig | high |
| `maps_zig/a020_flat_map_pool_decls.js` | a020 | 58 | flat map pool array decls | zig | high |
| `maps_zig/a021_nested_map_pool_decls.js` | a021 | 61 | nested map pool array decls | zig | high |
| `maps_zig/a022_inline_map_pool_decls.js` | a022 | 57 | inline map pool array decls | zig | high |
| `maps_zig/a023_map_per_item_arrays.js` | a023 | 161 | per-item array decls | zig | high |
| `maps_zig/a024_map_dynamic_text_storage.js` | a024 | 62 | map dyn-text buf decls | zig | high |
| `maps_zig/a025_map_handler_ptrs.js` | a025 | 67 | map handler fn ptr decls | zig | high |
| `maps_zig/a026_flat_map_rebuild.js` | a026 | 908 | flat map rebuild fn bodies | zig | high |
| `maps_zig/a027_nested_map_rebuild.js` | a027 | 187 | nested map rebuild fn bodies | zig | high |
| `maps_zig/a028_inline_map_rebuild.js` | a028 | 382 | inline map rebuild fn bodies | zig | high |

---

### Maps Lua atoms (`a029`–`a032`) + helpers
| file | atom | lines | purpose | ownership | fragility |
|---|---|---|---|---|---|
| `maps_lua/a029_lua_map_wrapper_registration.js` | a029 | 52 | Lua map wrapper fn registration | lua | high |
| `maps_lua/a030_lua_map_rebuilder_functions.js` | a030 | 83 | Lua map rebuilder fn bodies | lua | high |
| `maps_lua/a031_lua_nested_helpers.js` | a031 | 48 | Lua nested map helper fns | lua | low |
| `maps_lua/a032_lua_map_master_dispatch.js` | a032 | 41 | Lua map master dispatch fn | lua | high |
| `maps_lua/lua_expr.js` | helper | 171 | Lua expression builder — `_exprTokensToLua`, `_singleTokenToLua`, `_templateToLua`, `readBraceExprAsLua` | lua | high |
| `maps_lua/lua_map_handler.js` | helper | 74 | Lua map handler codegen — `_handlerToLua`, `_spliceDynamicHandler` | lua | high |
| `maps_lua/lua_map_node.js` | helper | 311 | Lua map node builder — `_cleanCondForEval`, `_wrapCondEval`, `_inlineGlyphColorToLua`, `_inlineGlyphToLua`, `_inlineGlyphSentinelText`, `_nodeToLua` | lua | high |
| `maps_lua/lua_map_style.js` | helper | 229 | Lua map style field builder — `_zigColorToLuaHex`, `_zigOaToLuaItem`, `_styleToLua` | lua | high |
| `maps_lua/lua_map_subs.js` | helper | 143 | Lua map substitution helpers — `_hexToLua`, `_camelToSnake`, `_unwrapQuotedDynamicExpr`, `_convertSimpleJsTernary`, `_collapseRedundantParens`, `_simplifyBoolNumericComparison`, `_jsExprToLua` | lua | low |
| `maps_lua/lua_map_text.js` | helper | 254 | Lua map text content builder — `_escapeLuaTextEval`, `_needsLuaTextEval`, `_luaTextValueExpr`, `_wrapLuaTextTostringCalls`, `_textToLua` | lua | high |

---

### Logic runtime atoms (`a033`–`a038`)
| file | atom | lines | purpose | ownership | fragility |
|---|---|---|---|---|---|
| `logic_runtime/a033_js_logic_block.js` | a033 | 57 | JS_LOGIC block string | qjs | high |
| `logic_runtime/a034_lua_logic_block.js` | a034 | 53 | LUA_LOGIC block string | lua | high |
| `logic_runtime/a035_dynamic_text_updates.js` | a035 | 110 | dyn-text update callbacks | zig | high |
| `logic_runtime/a036_conditional_updates.js` | a036 | 83 | conditional visibility updates | zig | high |
| `logic_runtime/a037_variant_updates.js` | a037 | 176 | variant state patch callbacks | zig | high |
| `logic_runtime/a038_runtime_dirty_tick.js` | a038 | 86 | dirty-flag tick fn | zig | high |

---

### Entry atoms (`a039`–`a042`)
| file | atom | lines | purpose | ownership | fragility |
|---|---|---|---|---|---|
| `entry/a039_app_init.js` | a039 | 99 | `app_get_init` fn | zig | high |
| `entry/a040_app_tick.js` | a040 | 58 | `app_get_tick` fn | zig | high |
| `entry/a041_app_exports.js` | a041 | 59 | C ABI exports | zig | high |
| `entry/a042_app_main.js` | a042 | 40 | `main` fn (standalone builds) | zig | low |

---

### Split + finalize atoms (`a043`–`a046`)
| file | atom | lines | purpose | ownership | fragility |
|---|---|---|---|---|---|
| `split_finalize/a043_split_section_extraction.js` | a043 | 91 | section boundary extraction | meta | high |
| `split_finalize/a044_split_namespace_prefixing.js` | a044 | 124 | namespace prefix injection | meta | high |
| `split_finalize/a045_split_module_headers.js` | a045 | 197 | per-module header generation | meta | high |
| `split_finalize/a046_finalize_postpass.js` | a046 | 63 | final output cleanup pass | meta | high |

---

## 12. MOD — `smith/mod/`

*The `mod/` subsystem handles `.mod.tsz` → Zig source compilation (module lane). Separate from the app/chad lane pipeline.*

### `smith/mod/index.js` (72 lines)
**Purpose:** Module compile entry — orchestrates all mod/* passes, returns generated Zig module source.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `compileModBlock` | 3 | 67 | zig | high | index.js compileMod |
| `extractModBlock` | 68 | 72 | meta | low | `compileModBlock` |

---

### `smith/mod/types.js` (153 lines)
**Purpose:** Type transpilation — converts TSZ type annotations to Zig types.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `emitTypesBlock` | 3 | 77 | zig | high | mod/index.js |
| `emitTypeAliasDecl` | 78 | 81 | zig | low | `emitTypesBlock` |
| `emitEnumDecl` | 82 | 92 | zig | low | `emitTypesBlock` |
| `emitStructDecl` | 93 | 118 | zig | high | `emitTypesBlock` |
| `inferDefault` | 119 | 142 | zig | low | mod/functions.js, `emitStructDecl` |
| `emitUnionDecl` | 143 | 153 | zig | low | `emitTypesBlock` |

---

### `smith/mod/expr.js` (240 lines)
**Purpose:** Expression transpilation — `modTranspileExpr` converts TSZ expressions to Zig; `modTranspileType` for types in expr context.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `modTranspileType` | 3 | 35 | zig | high | mod/functions.js, mod/types.js |
| `modTranspileFnType` | 36 | 41 | zig | low | `modTranspileType` |
| `modTranspileDefault` | 42 | 59 | zig | low | mod/functions.js |
| `modTranspileForExpr` | 60 | 67 | zig | high | mod/statements.js |
| `modTranspileExpr` | 68 | 148 | zig | high | mod/functions.js, mod/statements.js |
| `transpileStringConcat` | 149 | 190 | zig | low | `modTranspileExpr` |
| `isComparison` | 191 | 194 | meta | low | `modTranspileExpr` |
| `inferTypeFromValue` | 195 | 203 | meta | low | `modTranspileExpr` |
| `transpileStructLiteral` | 204 | 227 | zig | low | `modTranspileExpr` |
| `modTranspileValue` | 228 | 234 | zig | low | `modTranspileExpr` |
| `modTranspileForExprV2` | 235 | 240 | zig | low | mod/statements.js |

---

### `smith/mod/functions.js` (429 lines)
**Purpose:** Function transpilation — converts TSZ function declarations to Zig fn declarations; handles params, return type, body.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `emitFunctionsBlock` | 3 | 24 | zig | high | mod/index.js |
| `emitOneFunction` | 25 | 53 | zig | high | `emitFunctionsBlock` |
| `prescanModFunctionSigs` | 54 | 70 | meta | low | mod/index.js |
| `emitFunctionBody` | 71 | 182 | zig | high | `emitOneFunction` |
| `emitArmBody` | 183 | 219 | zig | high | `emitFunctionBody` |
| `emitForBody` | 220 | 259 | zig | high | `emitFunctionBody` |
| `emitModBody` | 260 | 362 | zig | high | `emitFunctionBody` |
| `emitArmBodyV2` | 363 | 384 | zig | high | `emitModBody` |
| `emitForLoopV2` | 385 | 414 | zig | high | `emitModBody` |
| `emitMapFunction` | 415 | 429 | zig | low | `emitModBody` |

---

### `smith/mod/statements.js` (78 lines)
**Purpose:** Statement transpilation — converts TSZ statements (if, for, return, const, etc.) to Zig.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `emitStatementList` | 4 | 25 | zig | low | mod/functions.js |
| `emitInlineStatements` | 26 | 34 | zig | high | mod/functions.js |
| `emitSingleStatement` | 35 | 78 | zig | high | mod/functions.js |

---

### `smith/mod/state.js` (54 lines)
**Purpose:** Module state — handles `<state>` blocks in `.mod.tsz` files.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `emitStateBlock` | 3 | 42 | zig | low | mod/index.js |
| `emitConstBlock` | 43 | 54 | zig | low | mod/index.js |

---

### `smith/mod/ffi.js` (37 lines)
**Purpose:** Module FFI — handles `<ffi>` blocks; emits Zig extern declarations.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `emitFfiBlock` | 3 | 37 | zig | low | mod/index.js |

---

### `smith/mod/imports.js` (18 lines)
**Purpose:** Module imports — emits `@import` lines from `<types>` block declarations.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `emitImportsBlock` | 3 | 18 | zig | low | mod/index.js |

---

### `smith/mod/params.js` (39 lines)
**Purpose:** Parameter transpilation — handles function parameter lists including destructuring and defaults.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `modTranspileParams` | 3 | 6 | zig | low | mod/functions.js |
| `parseModParams` | 7 | 20 | zig | low | `emitOneFunction` |
| `emitModParams` | 21 | 31 | zig | low | `emitOneFunction` |
| `isModPointerParamType` | 32 | 35 | meta | low | `parseModParams` |
| `registerModPtrParam` | 36 | 39 | meta | low | `parseModParams` |

---

### `smith/mod/helpers.js` (322 lines)
**Purpose:** Mod compile helpers — expression utilities, for-loop spec parsing, null guard extraction, scope helpers.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `localIsReassigned` | 3 | 20 | meta | low | mod/functions.js |
| `parseForExprSpec` | 21 | 44 | meta | low | mod/statements.js |
| `buildReverseIndexExpr` | 45 | 49 | meta | low | mod/statements.js |
| `substituteForLoopVars` | 50 | 59 | meta | low | mod/statements.js |
| `extendModCtx` | 60 | 76 | meta | high | mod/functions.js, mod/statements.js |
| `extractNullGuardedVars` | 77 | 80 | meta | low | mod/statements.js |
| `extractNonNullVars` | 81 | 85 | meta | low | mod/statements.js |
| `extractNullComparedVars` | 86 | 95 | meta | low | mod/statements.js |
| `addUniqueVars` | 96 | 103 | meta | low | `extractNullGuardedVars` |
| `isEarlyExitBranch` | 104 | 112 | meta | low | mod/functions.js |
| `applyOptionalUnwraps` | 113 | 124 | meta | high | mod/functions.js, mod/statements.js |
| `replaceVarDotAccessWithUnwrap` | 125 | 149 | meta | low | `applyOptionalUnwraps` |
| `replaceExactVarWithUnwrap` | 150 | 153 | meta | low | `applyOptionalUnwraps` |
| `replaceNeedleWithBoundary` | 154 | 173 | meta | low | `replaceVarDotAccessWithUnwrap` |
| `isModIdentChar` | 174 | 177 | meta | low | `replaceNeedleWithBoundary` |
| `rewriteKnownFunctionCalls` | 178 | 205 | meta | high | `modTranspileExpr` |
| `findMatchingParen` | 206 | 227 | meta | low | `rewriteKnownFunctionCalls` |
| `splitCallArgs` | 228 | 263 | meta | low | `rewriteKnownFunctionCalls` |
| `argIsPointerLike` | 264 | 271 | meta | low | `rewriteKnownFunctionCalls` |
| `escapeRegExp` | 272 | 275 | meta | low | `replaceNeedleWithBoundary` |
| `rewriteExpressionTernary` | 276 | 281 | meta | low | `modTranspileExpr` |
| `splitTopLevelTernary` | 282 | 322 | meta | low | `rewriteExpressionTernary` |

---

## 13. PAGE — `smith/page.js` (723 lines)

**Purpose:** Page lane — compiles `.page.tsz` files (multi-section page apps); has its own collect + parse + emit sub-pipeline distinct from app lane.

| function | start | end | ownership | fragility | called-by |
|---|---|---|---|---|---|
| `extractPageBlock` | 20 | 30 | meta | low | `compilePage` |
| `extractPageBlocks` | 31 | 57 | meta | low | `compilePage` |
| `parsePageVarBlock` | 58 | 185 | meta | high | `compilePage` |
| `parsePageStateBlock` | 186 | 208 | meta | high | `compilePage` |
| `parsePageFunctionsBlock` | 209 | 242 | meta | low | `compilePage` |
| `transpilePageExpr` | 243 | 258 | meta | high | `transpilePageLine`, `transpilePageBody` |
| `_quoteTypeVariant` | 259 | 268 | meta | low | `transpilePageExpr` |
| `transpilePageLine` | 269 | 319 | meta | high | `transpilePageBody` |
| `transpilePageBody` | 320 | 424 | meta | high | `compilePage` |
| `buildPageJSLogic` | 425 | 583 | qjs | high | `compilePage` |
| `compilePage` | 584 | 723 | meta | high | lanes/page.js |

---

## 14. PATTERNS — `smith/patterns/` (~140 files, ~7000 lines total)

**Purpose:** Pattern library — each file (`p001_*.js` through `p140_*.js` + `c001_*.js` through `c030_*.js`) defines a single pattern stub that maps a recognized source pattern to a structured representation. Consumed by `smithCheck()` for source analysis and by the chad/mixed tier parsers.

**All pattern files follow the same structure:**
```js
// pXXX_name.js
// pattern: <description>
// ownership: meta
// fragility: low
// called-by: smith/index.js smithCheck(), patterns/index.js
```

**Subdirectories:**
| group | files | lines | topic |
|---|---|---|---|
| `primitives/` | p001–p010 | ~300 | literals, JSX, fragments |
| `ternary/` | p011–p015 | ~150 | ternary patterns |
| `logical/` | p016–p018 | ~90 | &&, \|\|, ?? |
| `map/` | p019–p029 | ~330 | .map() variants |
| `filter_sort/` | p030–p038 | ~270 | filter/sort/slice/flatMap |
| `array_construction/` | p039–p046 | ~240 | Array.fill, Object.keys, etc. |
| `props/` | p047–p065 | ~570 | prop passing patterns |
| `children/` | p066–p072 | ~210 | children patterns |
| `component_ref/` | p073–p080 | ~240 | component reference patterns |
| `conditional_rendering/` | p081–p085 | ~150 | conditional render patterns |
| `composition/` | p086–p093 | ~240 | HOC, portals, context |
| `hooks/` | p094–p100 | ~210 | useState, useReducer, etc. |
| `keys/` | p101–p104 | ~120 | key prop patterns |
| `style/` | p105–p114 | ~300 | style patterns |
| `events/` | p115–p120 | ~180 | event handler patterns |
| `strings/` | p121–p124 | ~120 | string/template patterns |
| `type_narrowing/` | p125–p131 | ~210 | typeof, Array.isArray, etc. |
| `misc_jsx/` | p132–p140 | ~270 | dangerouslySetHTML, SVG, etc. |
| `c001–c030` (chad) | 30 files | ~900 | chad-tier syntax patterns |

*All `_applies` / pattern match functions in this directory: fragility=low, ownership=meta, called-by=smithCheck / patterns/index.js*

---

## Summary Table

| subsystem | files | functions | primary output | fragility hotspots |
|---|---|---|---|---|
| Zig host | 6 | ~25 | — | smith_bridge.zig |
| Smith entry | 6 | 26 | meta | index.js compile, core.js mkCursor/resetCtx/slotGet |
| Lanes | 14 | ~35 | meta/zig/lua | dispatcher, shared.js, app.js, chad.js |
| Collect | 6 | 37 | meta | state.js, render_locals.js, classifiers.js |
| Preflight | 11 | 32 | meta | route_scan.js, context.js, routing_check.js |
| Parse (top) | 4 | 14 | meta | parseJSXElement, attrs.js parseStyleBlock/parseValueExpr, build_node.js buildNode |
| Parse (brace) | 2 | ~20 | meta | conditional.js tryParseConditional, brace.js tryParseBraceChild |
| Parse (children) | 7 | ~25 | meta | brace.js, brace_maps.js |
| Parse (element) | 12 | ~60 | zig/meta | attrs_dispatch.js, component_inline.js, postprocess.js |
| Parse (map) | 6 | ~20 | meta | header.js tryParseMapHeader, context.js |
| Parse (handlers/tmpl/utils) | 3 | ~15 | meta | press.js, template_literal.js, utils.js skipBraces |
| Resolve | 6 | ~20 | meta/zig | comparison.js, eval_builder.js, identity.js |
| Emit (top + emit/) | 17 | ~40 | zig/lua/qjs | emitOutput, transforms.js, lua_tree_emit.js, effect_transpile.js |
| Emit ops | 28 | ~75 | zig/lua | rebuild_map.js, emit_lua_element.js, js_expr_to_lua.js |
| Emit atoms | 46+ | ~110 | zig/lua/qjs | a026_flat_map_rebuild.js, a016_oa_flat_unpack.js, a039_app_init.js |
| Mod | 10 | ~30 | zig | functions.js, expr.js, helpers.js |
| Page | 1 | ~10 | meta | compilePageLane |
| Patterns | ~140 | ~280 | meta | index.js (dispatcher) |
| **TOTAL** | **~200** | **652** | | |

---

## Known Duplication (cleanup candidates)

| issue | location | notes |
|---|---|---|
| `luaTransform`/`jsTransform` duplicated | `emit/transforms.js` AND `emit_ops/transforms.js` | Same functions in two files |
| `transpileEffectBody`/`transpileExpr`/`splitArgs` duplicated | `emit/effect_transpile.js` AND `emit_ops/effect_transpile.js` | Exact duplicates |
| `transpileEffectToWGSL`/`_effectMathWGSL`/`transpileExprWGSL` duplicated | `emit/effect_wgsl.js` AND `emit_ops/effect_wgsl.js` | Exact duplicates |
| `v4_reference/` | `tsz/compiler/v4_reference/` | Full copy of previous version — reference only, never imported |
| `dead/` | `tsz/compiler/dead/` | Archived code — not imported anywhere |
