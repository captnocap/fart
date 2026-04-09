# Fragile Function Decomposition Map

Generated: 2026-04-08

Scope:
- This is a first-pass decomposition map for the large high-fragility hotspot functions.
- Helper names are intentionally local to each function. Duplicate helper shapes are left unresolved on purpose for the next pass.
- The goal here is not dedupe. The goal is to expose where each large function wants named boundaries.

Selection rule:
- Started from `COMPILER_MANIFEST.md` high-fragility rows.
- Focused this pass on the large hotspot files and their main high-fragility bodies.

## `smith/index.js`

### `smithCheck`
- `readCheckGlobals()`
- `buildAtomNameLookup()`
- `detectCheckLane(source, file)`
- `handleModuleLaneCheck(source, file, path, lines, stem)`
- `prepareCheckCursor(tokens, source)`
- `collectLaneSpecificCheckInputs(lane, c, path)`
- `buildPredictedRoutePlan(source, path)`
- `buildPredictedExecutionPath(lane, stopReason, path)`
- `groupPredictedAtomsByPhase(plan, atomNames)`
- `renderCheckStateSummary(lines, ctx, plan, stem)`
- `renderCheckMapSummary(lines, plan)`
- `renderCheckVerdict(lines, blocking)`

### `compileMod`
- `shouldUseModuleBlockCompiler(source)`
- `initModZigOutput(file)`
- `compileModImportLine(trimmed, outState)`
- `compileModExternFunctionLine(trimmed)`
- `compileModExportFunctionLine(trimmed)`
- `compileModFunctionLine(trimmed)`
- `compileModVariableLine(trimmed, line)`
- `compileModControlFlowLine(trimmed, line)`
- `compileModFallbackLine(line)`

### `compileModLua`
- `initModLuaOutput(file)`
- `compileLuaImportLine(trimmed, indent)`
- `compileLuaFunctionHeader(trimmed, indent)`
- `compileLuaVariableLine(trimmed, indent)`
- `compileLuaControlLine(trimmed, indent)`
- `compileLuaStatementLine(trimmed, indent)`

### `compileModJS`
- `initModJSOutput(file)`
- `compileJSImportLine(line)`
- `stripJSFunctionTypeAnnotations(trimmed, indent)`
- `stripJSVariableTypeAnnotation(trimmed, indent)`
- `compileJSPassthroughLine(line)`

## `smith/core.js`

### `mkCursor`
- `parseRawTokenRows(raw)`
- `detectAsciiSource(source)`
- `buildByteToCharIndex(source)`
- `sliceSourceByByteRange(source, lookup, start, end)`
- `normalizeTokenString(kind, raw)`
- `createCursorApi(parsed, source, lookup)`

### `resetCtx`
- `makeCollectionState()`
- `makeRuntimeState()`
- `makeDiagnosticState()`
- `makeRoutePlanState()`
- `makeLuaTreeState()`
- `mergeInitialCompilerState()`

### `peekPropsAccess`
- `matchPropsObjectAccess(c)`
- `lookupPropFieldValue(field)`
- `resolveOaItemPropFieldValue(propMarker, subField)`
- `resolveOaItemPropIdentity(propMarker)`
- `buildResolvedPropAccess(field, value, skip)`

### `resolveConstOaAccess`
- `findConstOaByGetter(name)`
- `matchConstOaBracketAccess(c)`
- `readConstOaRowIndex(c)`
- `resolveConstOaFieldValue(oa, rowIdx, field)`
- `buildConstOaRowRef(oa, rowIdx)`

### `resolveConstOaFieldFromRef`
- `parseConstOaRef(refValue)`
- `lookupConstOaRow(oaIdx, rowIdx)`
- `lookupConstOaFieldInfo(oa, field)`
- `formatConstOaFieldValue(data, fieldInfo)`

## `smith/collect/state.js`

### `collectState`
- `scanStateTupleDeclaration(c)`
- `readStateTupleNames(c)`
- `detectUseStateInvocation(c)`
- `parseStateInitializer(c, getter, setter)`
- `registerCollectedState(getter, setter, parsedInit)`
- `restoreStateCollectorCursor(saved)`

### `collectObjectState`
- `collectObjectStateFields(c)`
- `parseObjectStateFieldValue(c)`
- `emitFlattenedObjectStateSlots(getter, setter, fields)`
- `registerObjectStateShape(getter, setter, fields)`

### `collectObjectArrayState`
- `registerEmptyObjectArray(getter, setter, arrayStartPos)`
- `registerPrimitiveObjectArray(c, getter, setter, arrayStartPos)`
- `collectSeedObjectArrayFields(c)`
- `parseObjectArrayFieldValue(c, fieldName)`
- `registerParentObjectArray(fields, getter, setter, initDataStartPos)`
- `registerNestedArrayObjectArrays(fields, parentOaIdx)`
- `skipRemainingArrayLiteral(c)`
- `recordObjectArrayInitEnd(oa, c)`

### `collectConstArrays`
- `findConstArrayDeclaration(c)`
- `skipStateBackedArray(name)`
- `collectConstArrayItems(c)`
- `registerConstObjectArray(name, constArrayInfo)`

## `smith/collect/render_locals.js`

### `collectRenderLocals`
- `enterRenderBody(c, appStart)`
- `collectTopLevelUseEffectBodies(c)`
- `collectRenderLocalDeclaration(c)`
- `storeRenderLocalRawSpan(varName, rhsStart, rhsEnd, rawExpr)`
- `resolveRenderLocalStorage(varName, rawExpr, c)`
- `collectConditionalRenderLocalReassignments(c)`
- `captureRenderBodyRaw(c, renderBodyStart, renderBodyEnd)`
- `restoreRenderLocalCursor(saved)`

### `expandRenderLocalRawExpr`
- `listExpandableRenderLocalNames()`
- `expandOneRenderLocalName(out, name, raw, skipName)`
- `runRenderLocalExpansionPasses(out, maxPasses)`

## `smith/preflight/route_scan.js`

### `routeScan`
- `initRoutePlan(ctx)`
- `deriveFeatureFlagsFromCtx(ctx, plan)`
- `deriveFeatureFlagsFromSource(source, ctx, plan)`
- `scanMapRoutes(source, ctx)`
- `predictRouteAtoms(plan.features)`
- `scanExpressionResolutionStats(source, ctx)`
- `buildRouteSummary(plan, mapScan, exprStats)`

### `scanForMaps`
- `scanDotMapCallbacks(source)`
- `classifyMapRoute(match, source)`
- `scanForLoopBlocks(source)`
- `scanForInlineMapContexts(source, result)`
- `attachMapBodyContent(route, source, callbackStart)`

### `scanExpressionResolution`
- `iterateBraceExpressions(source)`
- `classifySimpleExpression(expr, ctx)`
- `classifyLiteralExpression(expr)`
- `classifyComplexExpression(expr)`

## `smith/attrs.js`

### `parseStyleValue`
- `parseStyleLiteral(c)`
- `parseOaBracketFieldStyleValue(c, name)`
- `parseStateStyleValue(c, name)`
- `parseCurrentMapItemStyleValue(c, name)`
- `parseCurrentMapIndexStyleValue(c, name)`
- `parseRenderLocalStyleValue(c, name)`
- `parsePropStyleValue(c, name)`
- `fallbackUnknownStyleValue(c)`

### `parseStyleBlock`
- `enterStyleObject(c)`
- `readStyleKey(c)`
- `readInitialStyleValue(c, key)`
- `foldStylePostfixArithmetic(c, val)`
- `parseStyleTernary(c, key, lhs)`
- `emitColorStyleField(fields, key, val)`
- `emitNumericStyleField(fields, key, val)`
- `emitEnumStyleField(fields, key, val)`
- `emitNodeLevelStyleField(fields, key, val)`
- `exitStyleObject(c)`

### `parseHandler`
- `skipHandlerArrowPrefix(c)`
- `parseBlockHandlerBody(c)`
- `parseSingleExpressionHandler(c)`
- `readHandlerCallArgs(c)`
- `emitSetterHandlerDispatch(setter, args)`
- `emitScriptHandlerDispatch(fname, args)`
- `emitSetVariantDispatch(val)`
- `formatHandlerEvalCall(fname, args)`

### `luaParseValueExpr`
- `parseLuaValueIdentifier(c)`
- `parseLuaValueLiteral(c)`
- `parseLuaValueOperator(c, parts)`
- `parseLuaValueTernary(c, parts)`
- `resolveLuaMapValue(name)`
- `resolveLuaPropValue(name)`
- `resolveLuaRemappedIdentifier(name)`

### `luaParseHandler`
- `captureHandlerClosureParams(c)`
- `parseLuaHandlerBlock(c)`
- `resolveLuaHandlerIdentifier(c, name)`
- `resolveLuaHandlerPropValue(name)`
- `rewriteLuaHandlerOperator(kind)`
- `parseSingleExpressionLuaHandler(c)`
- `finalizeLuaHandlerBody(joined)`

### `parseValueExpr`
- `parseValueIdentifier(c)`
- `resolveConstOaValueExpr(c, name)`
- `resolveObjectStateValueExpr(c)`
- `resolvePropValueExpr(c, name)`
- `resolveUnknownValueExpr(name)`
- `parseValueBinaryOperator(c)`
- `parseValueTernary(c, parts)`
- `parseValueLiteral(c)`

## `smith/parse/build_node.js`

### `buildNode`
- `applyContainerAutoOverflow(tag, styleFields, children)`
- `buildTextNodeFastPath(tag, styleFields, children, nodeFields)`
- `buildTextGlyphSplitNode(parts, children, nodeFields, styleFields)`
- `buildTextDynamicChildNode(parts, dynChild, nodeFields, styleFields)`
- `hoistSingleStaticTextChild(tag, parts, children)`
- `buildInlineGlyphTextNode(parts, children)`
- `appendExplicitNodeFields(parts, nodeFields)`
- `appendHandlerFields(parts, handlerRef)`
- `attachChildrenArray(parts, children, styleFields)`
- `bindRuntimeMetadata(nodeResult, nodeFields, styleFields)`
- `buildLuaNodeMirror(tag, styleFields, nodeFields, children, handlerRef, nodeResult)`
- `resolveLuaHandlerBinding(handlerRef)`
- `attachLuaChildNodes(luaNode, children)`

Notes:
- `buildNode` already contains hidden helper boundaries as inline closures and long local blocks.
- This file wants top-level named helpers more than another round of in-function comments.

## `smith/parse/brace/conditional.js`

### `_buildLuaCondFromTokens`
- `readLuaConditionToken(c, parts)`
- `resolveLuaPropsAccess(c, parts)`
- `resolveLuaPropAliasValue(c, parts)`
- `resolveLuaRenderLocalValue(c, parts)`
- `resolveLuaMapItemValue(c, parts)`
- `resolveLuaMapIndexValue(c, parts)`
- `resolveLuaLiteralValue(c, parts)`
- `normalizeLuaConditionResult(parts, currentPos)`

### `tryParseConditional`
- `readZigConditionalExpression(c, condParts)`
- `consumeConditionalAndToken(c)`
- `handleConditionalChildrenForward(c, children, condExpr, luaCondExpr)`
- `handleConditionalJsxBranch(c, children, condExpr, luaCondExpr)`
- `handleConditionalMapBranch(c, children, condExpr)`
- `resolveConditionalPropsAccess(c, condParts)`
- `resolveConditionalIdentifier(c, condParts)`
- `resolveConditionalGetterAccess(c, condParts)`
- `resolveConditionalMapAccess(c, condParts)`
- `finalizeConditionalFailure(c, saved)`

## `smith/parse/children/brace.js`

### `tryParseBraceChild`
- `consumeBraceComment(c)`
- `consumeBraceStaticString(c, children)`
- `tryParseBraceControlFlow(c, children)`
- `tryParseBraceMapExpression(c, children)`
- `tryParseBraceTemplateLiteral(c, children)`
- `tryParseBraceCurrentMapValue(c, children)`
- `trySpliceBraceChildrenProp(c, children)`
- `tryResolveBraceRenderLocal(c, children)`
- `tryResolveBracePropValue(c, children)`
- `tryResolveBraceGetterValue(c, children)`
- `tryParseBraceStringConcat(c, children)`
- `fallbackBraceExpressionToScriptEval(c, children)`

## `smith/parse/element/component_inline.js`

### `inlineComponentCall`
- `guardRecursiveInline(rawTag)`
- `saveInlineContext(c, ctx)`
- `installInlinePropContext(comp, rawTag, propValues, compChildren)`
- `installInlineStateRemap(comp)`
- `collectInlineRenderLocals(c, comp)`
- `enterInlineComponentBody(c, comp)`
- `parseInlineMappedBodyIfPresent(c, comp, maybeArr)`
- `parseInlineRootElement(c)`
- `restoreInlineContext(savedState)`

## `smith/page.js`

### `parsePageVarBlock`
- `readNextPageVarLine(lines, i)`
- `parseExactVarDeclaration(line)`
- `parseIsVarDeclaration(line, lines, i)`
- `readMultilinePageValue(lines, i, value)`
- `classifyPageVarValue(name, value)`
- `parseAmbientPageValue(name, value)`

### `transpilePageBody`
- `emitIfBlockLine(line, jsLines, indent)`
- `emitElseBlockLine(line, jsLines, indent)`
- `emitDuringBlockLine(line, jsLines, indent)`
- `emitSwitchBlockLine(line, jsLines, indent)`
- `emitCaseBlockLine(line, jsLines, indent)`
- `emitRegularPageStatement(line, setterNames, jsLines, indent, isComputed)`

### `buildPageJSLogic`
- `emitPageStateBindings(stateVars, jsLines, funcNames)`
- `emitAmbientBindings(ambients, jsLines)`
- `parsePageFunctions(functionsBlock)`
- `emitComposedPageFunction(func, jsLines, funcNames)`
- `emitComputedPageFunction(func, jsLines, funcNames)`
- `emitRegularPageFunction(func, setterNames, jsLines, funcNames)`
- `emitTimerRegistrations(funcs, timerBlocks, jsLines)`
- `validateDuplicateJSVars(jsLines)`
- `validateUndefinedJSCalls(jsLines, funcNames, functionsBlock)`

### `compilePage`
- `extractPageRouteName(source)`
- `trackIgnoredPageModules(source)`
- `extractPageBlocksFromSource(source)`
- `classifyPageVars(allVars)`
- `registerPagePrimitiveState(stateVars)`
- `buildPageLogicBlocks(stateVars, ambients, functionsBlock, timerBlocks)`
- `registerPageObjectArrays(stateVars)`
- `runPageCollectPasses(c)`
- `findPageReturnJsx(c)`
- `appendPageDynTextBridge(ctx)`

## `smith/emit/split.js`

### `splitOutput`
- `initSplitContext(file)`
- `findSplitSectionBoundaries(monolith)`
- `sliceSplitSections(boundaries, monolith)`
- `groupSectionsIntoFiles(sec)`
- `publishSharedDeclarations(files)`
- `prefixCrossModuleReferences(files)`
- `buildSplitHeader(fname, files, fastBuild, fwPrefix, basename, appName)`
- `tagSplitOrigins(files, appName)`
- `assembleSplitFiles(files)`
- `encodeSplitOutput(result, childrenManifest)`

## `smith/emit/lua_tree_emit.js`

### `emitLuaTreeApp`
- `initLuaTreeEmitContext(file)`
- `emitLuaStatePool(lua, ctx)`
- `emitLuaMapLoopHelpers(lua)`
- `emitLuaStateSlotBindings(lua, ctx)`
- `emitLuaFfiBindings(lua, ctx)`
- `emitLuaScriptBlock(lua, ctx)`
- `emitLuaObjectArrayBindings(lua, ctx)`
- `emitLuaAppFunction(lua, ctx)`
- `emitLuaRenderFunction(lua, ctx)`
- `buildLuaTreeZigPreamble(appName, prefix, fastBuild)`
- `buildLuaTreeZigLogicBlocks(zig, luaStr, ctx)`
- `buildLuaTreeZigRuntimeHooks(zig, ctx, prefix)`
- `buildLuaTreeZigExports(zig, appName, ctx)`
- `buildLuaTreeZigMain(zig, appName, ctx, fastBuild)`

## `smith/emit_ops/rebuild_map.js`

### `rebuildMap`
- `iterateTopLevelZigMaps(ctx, mapOrder)`
- `emitMapRebuildHeader(mi, m, meta)`
- `emitMapDynamicTextFormatting(mi, mapDynTexts)`
- `emitEarlyHandlerPointerSetup(mi, m, mapHandlers)`
- `emitPerItemArrayCopies(mi, m, meta)`
- `emitPerItemConditionals(mi, m, meta)`
- `emitNestedMapRebuilds(mi, m, meta)`
- `emitInlineMapRebuilds(mi, m, meta)`
- `emitFlatMapInnerArray(mi, m, meta)`
- `emitFlatMapPoolNode(mi, m, meta)`
- `emitDeferredCanvasAttrs(mi, m)`
- `emitMapVariantPatches(mi, m, meta)`
- `emitParentArrayBinding(m)`

Notes:
- This function has several second-level decompositions hiding inside it.
- The nested-map path and the inline-map path each want their own builder object or helper module, even before cross-function dedupe.

## `smith/emit_ops/emit_lua_element.js`

### `emitLuaElement`
- `guardLuaEmitDepth(c)`
- `ensureCursorAtOpeningTag(c)`
- `readLuaTagName(c)`
- `inlineComponentIfNeeded(c, tagName, itemParam, indent)`
- `initLuaNodeRecord(tagName)`
- `parseLuaElementAttributes(c, node, itemParam)`
- `consumeLuaTagClose(c)`
- `parseLuaElementContent(c, node, tagName, itemParam, indent)`
- `buildLuaElementFields(node, indent, ctx, tagName, itemParam)`
- `attachLuaScrollPersistence(fields, tagName, itemParam, ctx)`

### `emitLuaChildren`
- `stopAtClosingTag(c)`
- `emitNestedChildElement(c, children, itemParam, indent)`
- `emitChildrenPropSplice(c, children, itemParam, indent)`
- `emitConditionalBraceChild(c, children, itemParam, indent)`
- `emitNestedMapBraceChild(c, children, itemParam, indent)`
- `skipUnknownBraceChild(c)`

## `smith/collect/components.js`

### `collectComponents`
- `scanNextFunctionDeclaration(c)`
- `isCollectibleComponent(name)`
- `parseComponentParamShape(c)`
- `collectComponentStateSlots(c)`
- `findComponentReturnBody(c)`
- `registerCollectedComponent(name, propNames, isBareParams, funcBodyPos, bodyPos, compStateSlots)`

## `smith/collect/classifiers.js`

### `parseChadClassifiers`
- `parseMainThemeBlock(text)`
- `parseThemeAssignmentLine(line)`
- `parseClassifierBlocks(text)`
- `parseClassifierBody(type, body)`
- `assignClassifierProp(def, prop, val)`
- `parseGlyphBlocks(text)`
- `parseGlyphBody(gName, gBody)`

## `smith/lanes/shared.js`

### `routingCheck`
- `readRoutePlan(ctx)`
- `verifyPlannedMaps(plan, zigOutput, mismatches)`
- `verifyPlannedState(plan, zigOutput, mismatches)`
- `verifyPlannedHandlers(plan, zigOutput, mismatches)`
- `verifyPlannedObjectArrays(plan, zigOutput, mismatches)`
- `verifyCompileBanner(zigOutput, mismatches)`
- `verifyUnknownPatternLeaks(zigOutput, mismatches)`
- `verifyAtomCountDrift(plan, ctx, mismatches)`

## `smith/lanes/soup/codegen.js`

### `soupExprToZig`
- `resolveSoupStateGetter(expr, inPressable)`
- `resolveSoupObjectFieldSlot(expr, inPressable)`
- `handleSoupTemplateLiteral(expr, warns)`
- `handleSoupConditionalJsx(expr, warns, inPressable)`
- `handleSoupTernaryJsx(expr, warns, inPressable)`
- `handleSoupMapExpr(expr, warns, inPressable)`
- `handleSoupDynamicBooleanExpr(expr, inPressable)`
- `warnAndDropSoupExpr(expr, warns)`

## `smith/attrs.js`

### `_tokenizeStyleExpr`
- `skipStyleExprWhitespace(src, i)`
- `readStyleExprString(src, i)`
- `readStyleExprTripleOperator(src, i)`
- `readStyleExprDoubleOperator(src, i)`
- `readStyleExprNumber(src, i)`
- `readStyleExprIdentifier(src, i)`
- `readStyleExprPunctuation(src, i)`

## `smith/parse.js`

### `parseJSXElement`
- `guardJsxOpen(c)`
- `parseJsxSpecialElement(c, rawTag)`
- `normalizeJsxOpenTag(c, rawTag, originalRawTag)`
- `traceInlineJsxOpen(ctx, displayTag, c, jsxStartPos)`
- `tryInlineJsxComponentCall(c, rawTag, displayTag)`
- `initParsedElementState(rawTag, tag)`
- `parseJsxAttributeList(c, rawTag, attrState, displayTag)`
- `applyLiteralTextMode(attrState)`
- `finishParsedJsxElement(c, rawTag, effectiveTag, attrState, clsDef, tagSrcOffset)`
- `restoreJsxDebugState(prevLiteral, prevDebugParentTag)`

Notes:
- This file is already split across helper modules, but the entry function still owns too many state transitions at once.

## `smith/parse/element/attrs_basic.js`

### `tryParseBasicElementAttr`
- `parseAscriptRunAttr(c)`
- `parseAscriptOnResultAttr(c)`
- `parseBasicFontSizeAttr(c, nodeFields)`
- `parseTextEffectAttr(c, nodeFields)`
- `parseEffectNameAttr(c, rawTag, nodeFields)`
- `parseEffectBackgroundAttr(c, rawTag, nodeFields)`
- `parseTextInputValueAttr(c, rawTag, nodeFields)`
- `parseTextInputFlagAttr(c, attr, rawTag, nodeFields)`
- `parsePlaceholderAttr(c, rawTag, nodeFields)`

## `smith/parse/element/attrs_text_color.js`

### `tryParseTextColorAttr`
- `guardTextColorAttr(attr)`
- `parseStaticTextColorLiteral(c, nodeFields)`
- `enterTextColorBraceValue(c)`
- `resolveTextColorLhs(c, propName)`
- `parseTextColorComparisonOp(c, colorLhs)`
- `parseTextColorRhsValue(c, opState)`
- `buildTextColorConditionalExpr(colorLhs, opState, truthyValue, falsyValue)`
- `emitConditionalTextColor(nodeFields, colorExpr, colorLhs)`
- `emitTruthinessTextColor(nodeFields, colorLhs, truthyValue, falsyValue)`
- `emitFallbackTextColor(nodeFields, propName)`

## `smith/parse/element/component_brace_values.js`

### `parseComponentBraceValue`
- `detectScriptBraceCall(c)`
- `captureRawScriptBraceExpr(c)`
- `appendResolvedPropsAccess(c, valParts)`
- `appendResolvedConstOaAccess(c, valParts)`
- `appendResolvedObjectStateAccess(c, valParts)`
- `appendResolvedTemplateLiteralValue(c, valParts)`
- `appendResolvedRenderLocalValue(c, valParts)`
- `appendResolvedMapContextValue(c, valParts)`
- `appendResolvedIdentifierValue(c, valParts)`
- `finalizeComponentBraceValue(c, val)`

## `smith/parse/element/defaults.js`

### `initElementParseState`
- `initGraphDefaults(rawTag, nodeFields)`
- `initScrollDefaults(rawTag, tag, styleFields)`
- `initCanvasDefaults(rawTag, nodeFields, styleFields)`
- `initTerminalDefaults(rawTag, nodeFields)`
- `initTextInputDefaults(rawTag, nodeFields)`
- `initScene3dDefaults(rawTag, nodeFields)`
- `initPhysicsDefaults(rawTag, nodeFields)`
- `finalizeElementDefaults(rawTag, tag, styleFields, nodeFields)`

## `smith/parse/handlers/press.js`

### `pushInlinePressHandler`
- `saveHandlerCursor(c)`
- `parseInlineLuaHandler(saved)`
- `captureInlineJsHandlerBody(c)`
- `parseInlineZigHandlerBody(c)`
- `detectHandlerJsDelegation(body)`
- `collectInlineHandlerClosureParams(ctx)`
- `buildInlineHandlerRecord(handlerName, finalBody, luaBody, jsBody, delegateToJs, closureParams)`

## `smith/parse/map/header.js`

### `tryParseMapHeader`
- `consumeMapInputReceiver(c, saved)`
- `consumePreMapChainMethods(c, filterConditions)`
- `consumeFilterChain(c, filterConditions)`
- `consumeMapKeywordAndLParen(c, saved)`
- `consumeMapCallbackPreamble(c, saved)`
- `parseMapHeaderParams(c, defaultItemParam, defaultIndexParam)`
- `scanMapCallbackBody(c, filterConditions, itemParam, indexParam)`
- `finalizeMapHeader(params, filterConditions)`

## `smith/parse/template_literal.js`

### `_resolveTemplateExpr`
- `resolveTemplateSimpleIdentifier(expr)`
- `resolveTemplateLengthExpr(expr)`
- `resolveTemplateArithmeticExpr(expr)`
- `resolveTemplateCurrentMapField(expr)`
- `resolveTemplateParentMapField(expr)`
- `resolveTemplateTernaryExpr(expr)`
- `resolveTemplateMapContextExpr(expr)`
- `resolveTemplateRuntimeEval(expr)`
- `fallbackTemplateLiteralExpr(expr)`

## `smith/parse/brace/ternary.js`

### `tryParseTernaryJSX`
- `parseInitialTernaryCondition(c, saved)`
- `parseInitialTernaryBranch(c, saved)`
- `normalizeLuaTernaryCondition(condParts)`
- `collectChainedTernaryBranches(c, allBranches, saved)`
- `detectDefaultTernaryBranch(allBranches)`
- `registerShowHideTernary(children, branch, inMap)`
- `registerTrueFalseTernary(children, allBranches, inMap)`
- `registerMultiBranchTernary(children, allBranches, inMap)`

Notes:
- This file already has first-level helpers, but `tryParseTernaryJSX` still mixes chain parsing, Lua normalization, and conditional registration in one pass.

## `smith/parse/children/brace_maps.js`

### `_tryParseComputedChainMap`
- `scanToComputedMapCall(c, saved)`
- `captureComputedSuffixText(c, suffixStart, dotPos)`
- `parseComputedChainHeader(c, mapPos, saved)`
- `captureComputedMapSnippet(c, mapPos, closePos)`
- `buildComputedMapPlan(baseName, baseExpr, suffixText, mapSnippet, header)`
- `routeRenderLocalComputedMap(c, children, oa, header, mapPos, saved)`
- `routeGenericComputedMap(c, children, oa, header, mapPos, saved)`
- `registerLuaComputedMapWrapper(children, oa, header, mapResult, mapIdx, rawSource, baseName)`

## `smith/parse/children/brace_computed.js`

### `_ensureSyntheticComputedOa`
- `lookupCachedComputedOa(getterName)`
- `deriveComputedDestructuringPlan(header, mapExpr, snippet)`
- `scanComputedFieldPaths(itemParam, snippet, seen, fields, nestedHints)`
- `appendNestedComputedHints(nestedHints, fields)`
- `collectComputedLiteralColors(snippet)`
- `buildSimpleComputedOa(getterName, mapExpr, uniqueColors)`
- `buildStructuredComputedOa(getterName, fields, computedExpr, uniqueColors, destructuredPlan, header)`
- `registerNestedComputedChildOas(oa, getterName, fields)`
- `cacheSyntheticComputedOa(getterName, oa)`

## `smith/resolve/field_access.js`

### `resolveField`
- `resolveOaLengthField(resolved, field)`
- `resolveOaFieldAccess(resolved, field, ctx)`
- `resolveCurrentMapItemField(resolved, field, ctx)`
- `resolveRenderLocalLengthField(resolved, field, ctx)`
- `resolveQjsEvalFieldAccess(resolved, field, ctx)`
- `resolveSlotFieldAccess(resolved, field)`
- `resolvePropFieldAccess(resolved, field)`
- `fallbackResolvedFieldAccess(resolved, field)`

## `smith/emit.js`

### `emitOutput`
- `emitLuaTreeFastPath(ctx, rootExpr, file)`
- `dumpPatternTraceIfNeeded(ctx)`
- `buildEmitConfig(ctx, file)`
- `emitStaticScaffolding(ctx, rootExpr, config)`
- `emitObjectArrayAndMapSections(ctx, config)`
- `emitLogicAndInitSections(ctx, config)`
- `emitRuntimeSupportBundle(ctx, rootExpr, config)`
- `emitEntrypointBundle(ctx, config, runtimeSections)`
- `finalizeEmitResult(out, file)`

## `smith/emit/runtime_updates.js`

### `emitRuntimeSupportSections`
- `computeRuntimeSupportFlags(ctx)`
- `emitDynamicTextUpdateFn(ctx)`
- `emitConditionalUpdateFn(ctx)`
- `emitDynamicStyleUpdateFn(ctx)`
- `emitDynamicColorUpdateFn(ctx)`
- `emitVariantUpdateFn(ctx, promotedToPerItem)`
- `emitDirtyTickPrelude(ctx, flags)`
- `emitDirtyTickMapRefresh(ctx, flags)`
- `finalizeRuntimeSupportSections(out, flags)`

## `smith/emit/logic_blocks.js`

### `emitLogicBlocks`
- `emitLuaStateSetterLines(ctx, luaLines)`
- `emitLuaObjectArrayLines(ctx, luaLines)`
- `emitLuaMapHandlerLines(ctx, luaLines)`
- `emitLuaMapRebuilderLines(ctx, luaLines)`
- `emitJsLogicLines(ctx, jsLines)`
- `emitSerializedLogicConst(name, lines)`

## `smith/emit/entrypoints.js`

### `emitRuntimeEntrypoints`
- `computeEntrypointFlags(ctx, opts)`
- `emitAppInitRegistrationPrelude(ctx, out)`
- `emitObjectArrayHostRegistrations(ctx, out)`
- `emitLuaMapWrapperRegistrations(ctx, out)`
- `emitInitialRuntimeRefreshes(out, flags)`
- `emitAppTickBody(out, flags)`
- `emitAppExportSurface(out, appName, ctx)`

## `smith/emit_ops/transforms.js`

### `luaTransform`
- `rewriteLuaOperators(s)`
- `rewriteLuaBitwiseOps(s)`
- `rewriteLuaTernary(s)`
- `rewriteLuaControlFlow(s)`
- `rewriteLuaDeclarationsAndNulls(s)`
- `rewriteLuaStdlibCalls(s)`
- `rewriteLuaTemplateLiterals(s)`

## `smith/emit_ops/emit_variant_patch.js`

### `emitVariantPatch`
- `computeVariantRuntimeImports(ctx, meta)`
- `shouldSkipVariantBinding(vb, promotedToPerItem)`
- `buildVariantTargetExpr(vb)`
- `emitBreakpointVariantStyles(vb, target, ctx)`
- `emitSimpleVariantStyles(vb, target)`
- `emitBreakpointFlexOverrides(vb, target, ctx)`
- `emitVariantNodeFieldPatches(vb, target)`
- `emitMapVariantPatchPlaceholder(vb)`

## `smith/emit_ops/emit_lua_style.js`

### `emitLuaStyle`
- `consumeLuaStyleOpen(c)`
- `readLuaStyleKey(c)`
- `parseLuaStyleNumberValue(c, parts, zigKey)`
- `parseLuaStyleStringValue(c, parts, zigKey)`
- `parseLuaStyleBraceExpr(c, parts, zigKey, itemParam)`
- `parseLuaStyleBareExpr(c, parts, zigKey, itemParam)`
- `rewriteLuaStyleTernary(expr)`
- `finalizeLuaStyleTable(parts)`

## `smith/emit_ops/effect_transpile.js`

### `transpileEffectBody`
- `splitEffectBodyLines(jsBody)`
- `handleEffectBraceOnlyLine(line, depth)`
- `emitEffectElseIf(line, depth, p, arrayVars)`
- `emitEffectElse(line, depth)`
- `emitEffectForLoop(line, depth, p, arrayVars)`
- `emitEffectDeclaration(line, depth, p, arrayVars)`
- `emitEffectIf(line, depth, p, arrayVars)`
- `emitEffectMethodCall(line, depth, p, arrayVars)`
- `emitEffectFallback(line, depth)`

## `smith/mod/functions.js`

### `emitFunctionBody`
- `emitFunctionGuard(line, indent)`
- `emitFunctionReturn(line, indent)`
- `emitLegacySwitchBlock(lines, i, depth, typeNames)`
- `emitLegacyForLoop(lines, i, depth, typeNames)`
- `emitFunctionStructAssign(line, indent)`
- `emitFunctionAssignment(line, indent)`
- `emitFunctionFallbackStatement(line, indent)`

### `emitModBody`
- `deriveModGuardReturnValue(retType)`
- `emitModGuard(text, depth, activeCtx, guardRetVal)`
- `emitModReturn(text, depth, activeCtx)`
- `emitModStructAssign(text, depth)`
- `emitModAssignment(text, depth, activeCtx)`
- `emitModSingleLineTernary(text, depth, ctx, narrowedVars, guardRetVal)`
- `emitModMultilineTernary(lines, i, depth, ctx, narrowedVars, guardRetVal)`
- `emitModSwitch(lines, i, depth, typeNames, ctx, narrowedVars)`
- `emitModForLoop(lines, i, depth, typeNames, ctx, narrowedVars)`
- `emitModFallbackStatement(text, depth, activeCtx, guardRetVal)`

## `smith/mod/expr.js`

### `modTranspileExpr`
- `normalizeModOperators(expr)`
- `prefixEnumVariants(expr, ctx)`
- `rewriteModTernary(expr, ctx)`
- `rewriteModStdlibMethods(expr)`
- `rewriteModFfiCalls(expr)`
- `rewriteModPosixConstants(expr)`
- `rewriteModStringConcat(expr)`
- `rewriteKnownModCalls(expr, ctx)`

## Next Pass Inputs

When this map is used for the dedupe pass, look for repeated helper shapes across files:
- prop access resolution
- map item field resolution
- dyn text registration
- handler call formatting
- script-eval fallback
- conditional branch assembly
- cross-module reference prefixing

Those overlaps are intentionally not normalized here.
