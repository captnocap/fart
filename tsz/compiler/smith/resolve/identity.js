// ── Resolve: Identity ────────────────────────────────────────────
// Given an identifier name, determine what it is and return its
// Zig expression. This is the ONE place that resolves names.
//
// Every consumer that currently does isGetter/slotGet/renderLocals/
// propStack/objectArrays.find chains should call this instead.
//
// Returns: { kind, zigExpr, rawJs, type, oa, slot }
//   kind: 'slot' | 'render_local' | 'prop' | 'oa' | 'map_item' |
//         'map_index' | 'parent_map_index' | 'script_fn' | 'unknown'
//   zigExpr: the Zig expression to use
//   rawJs: the raw JS expression (for qjs eval rebuild), null if N/A
//   type: 'int' | 'string' | 'bool' | 'float' | 'qjs_eval' | null
//   oa: the OA object if kind === 'oa', null otherwise
//   slot: the slot object if kind === 'slot', null otherwise

function resolveIdentity(name, ctx) {
  // 1. State slot getter
  var slotIdx = findSlot(name);
  if (slotIdx >= 0) {
    var slot = ctx.stateSlots[slotIdx];
    return {
      kind: 'slot',
      zigExpr: slotGet(name),
      rawJs: null,
      type: slot.type || 'int',
      oa: null,
      slot: slot
    };
  }

  // 2. Object array (check BEFORE render-locals — OA names may shadow)
  var oa = ctx.objectArrays ? ctx.objectArrays.find(function(o) { return o.getter === name; }) : null;
  if (oa) {
    return {
      kind: 'oa',
      zigExpr: null, // OA needs field access to be useful
      rawJs: null,
      type: null,
      oa: oa,
      slot: null
    };
  }

  // 3. Render-local
  if (ctx.renderLocals && ctx.renderLocals[name] !== undefined) {
    var rlVal = ctx.renderLocals[name];
    var rawJs = ctx._renderLocalRaw ? ctx._renderLocalRaw[name] : null;
    var isQjsEval = typeof rlVal === 'string' && rlVal.includes('qjs_runtime.evalToString');
    return {
      kind: 'render_local',
      zigExpr: rlVal,
      rawJs: rawJs,
      type: isQjsEval ? 'qjs_eval' : /^-?\d+(\.\d+)?$/.test(rlVal) ? 'int' : null,
      oa: null,
      slot: null
    };
  }

  // 4. Prop
  if (ctx.propStack && ctx.propStack[name] !== undefined) {
    var pv = ctx.propStack[name];
    var isQjs = typeof pv === 'string' && pv.includes('qjs_runtime.evalToString');
    return {
      kind: 'prop',
      zigExpr: pv,
      rawJs: null,
      type: isQjs ? 'qjs_eval' : /^-?\d+(\.\d+)?$/.test(pv) ? 'int' : null,
      oa: null,
      slot: null
    };
  }

  // 5. Map item param
  if (ctx.currentMap && name === ctx.currentMap.itemParam) {
    return {
      kind: 'map_item',
      zigExpr: null, // needs .field to be useful
      rawJs: null,
      type: null,
      oa: ctx.currentMap.oa,
      slot: null
    };
  }

  // 6. Map index param
  if (ctx.currentMap && name === ctx.currentMap.indexParam) {
    var iv = ctx.currentMap.iterVar || '_i';
    return {
      kind: 'map_index',
      zigExpr: '@as(i64, @intCast(' + iv + '))',
      rawJs: null,
      type: 'int',
      oa: null,
      slot: null
    };
  }

  // 7. Parent map index param
  if (ctx.currentMap && ctx.currentMap.parentMap) {
    var pMap = ctx.currentMap.parentMap;
    while (pMap) {
      if (name === pMap.indexParam) {
        var piv = pMap.iterVar || '_i';
        return {
          kind: 'parent_map_index',
          zigExpr: '@as(i64, @intCast(' + piv + '))',
          rawJs: null,
          type: 'int',
          oa: null,
          slot: null
        };
      }
      pMap = pMap.parentMap;
    }
  }

  // 8. Script function (identifier followed by paren, with script block)
  if (ctx.scriptBlock || globalThis.__scriptContent) {
    return {
      kind: 'script_fn',
      zigExpr: null, // must go through qjs eval
      rawJs: name,
      type: 'qjs_eval',
      oa: null,
      slot: null
    };
  }

  // 9. Unknown
  return {
    kind: 'unknown',
    zigExpr: null,
    rawJs: name,
    type: null,
    oa: null,
    slot: null
  };
}
