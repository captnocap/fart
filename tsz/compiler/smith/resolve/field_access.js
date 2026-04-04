// ── Resolve: Field Access ────────────────────────────────────────
// Handle x.field on any resolved expression. This is the ONE place
// that routes .field, .length, and nested dot access.
//
// Every consumer that handles OA field lookup, .length → _len,
// or qjs eval .field should call this instead.

// Resolve field access on an already-resolved identity.
// Input: resolved (from resolveIdentity), field name, ctx
// Returns: { zigExpr, type }
function resolveField(resolved, field, ctx) {
  // .length on an OA → _oaN_len
  if (resolved.kind === 'oa' && field === 'length') {
    return {
      zigExpr: '_oa' + resolved.oa.oaIdx + '_len',
      type: 'int'
    };
  }

  // .field on an OA (outside map context — const OA bracket access)
  if (resolved.kind === 'oa' && resolved.oa) {
    var fi = resolved.oa.fields.find(function(f) { return f.name === field; });
    if (fi) {
      // Inside a map that iterates this OA
      if (ctx.currentMap && ctx.currentMap.oa === resolved.oa) {
        var iv = ctx.currentMap.iterVar || '_i';
        if (fi.type === 'string') {
          return {
            zigExpr: '_oa' + resolved.oa.oaIdx + '_' + field + '[' + iv + '][0.._oa' + resolved.oa.oaIdx + '_' + field + '_lens[' + iv + ']]',
            type: 'string'
          };
        }
        return {
          zigExpr: '_oa' + resolved.oa.oaIdx + '_' + field + '[' + iv + ']',
          type: fi.type || 'int'
        };
      }
    }
  }

  // .field on a map item → OA field reference
  if (resolved.kind === 'map_item' && resolved.oa) {
    var mfi = resolved.oa.fields.find(function(f) { return f.name === field; });
    var miv = ctx.currentMap ? (ctx.currentMap.iterVar || '_i') : '_i';
    if (mfi) {
      if (mfi.type === 'string') {
        return {
          zigExpr: '_oa' + resolved.oa.oaIdx + '_' + field + '[' + miv + '][0.._oa' + resolved.oa.oaIdx + '_' + field + '_lens[' + miv + ']]',
          type: 'string'
        };
      }
      return {
        zigExpr: '_oa' + resolved.oa.oaIdx + '_' + field + '[' + miv + ']',
        type: mfi.type || 'int'
      };
    }
    // Unknown field — emit anyway, Zig will catch it
    return {
      zigExpr: '_oa' + resolved.oa.oaIdx + '_' + field + '[' + miv + ']',
      type: 'int'
    };
  }

  // .length on a render-local that's a Zig slice
  if (resolved.kind === 'render_local' && field === 'length') {
    if (resolved.type === 'qjs_eval') {
      var inner = extractInner(resolved.zigExpr);
      if (inner) {
        return {
          zigExpr: buildEval(inner + '.length', ctx),
          type: 'qjs_eval'
        };
      }
    }
    return {
      zigExpr: resolved.zigExpr + '.len',
      type: 'int'
    };
  }

  // .field on a qjs eval render-local or prop → new eval with field access
  if (resolved.type === 'qjs_eval') {
    var rawExpr = resolved.rawJs;
    if (rawExpr) {
      return {
        zigExpr: buildFieldEval(rawExpr, field, ctx),
        type: 'qjs_eval'
      };
    }
    // Try to extract inner from existing eval
    var innerExpr = extractInner(resolved.zigExpr);
    if (innerExpr) {
      return {
        zigExpr: buildFieldEval(innerExpr, field, ctx),
        type: 'qjs_eval'
      };
    }
    // Last resort — append .field (will likely fail in Zig)
    return {
      zigExpr: resolved.zigExpr + '.' + field,
      type: null
    };
  }

  // .field on a slot that returns an object (rare)
  if (resolved.kind === 'slot') {
    return {
      zigExpr: resolved.zigExpr + '.' + field,
      type: null
    };
  }

  // .field on a prop (non-eval)
  if (resolved.kind === 'prop') {
    return {
      zigExpr: resolved.zigExpr + '.' + field,
      type: null
    };
  }

  // Default
  return {
    zigExpr: (resolved.zigExpr || resolved.rawJs || '0') + '.' + field,
    type: null
  };
}

// Resolve .length specifically — common enough to warrant a shortcut
function resolveLength(resolved, ctx) {
  return resolveField(resolved, 'length', ctx);
}
