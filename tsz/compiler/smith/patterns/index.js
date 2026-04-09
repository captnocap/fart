// ── Smith Pattern Registry ───────────────────────────────────────
//
// Global registry for all patterns. Each pattern file wraps itself
// in an IIFE and registers into _patterns[N] when loaded.
// This file declares the registry and must be loaded FIRST.
// Registry ids are intentionally sparse; retired c001-c030 contract
// patterns were removed from the bundle and do not register here.
//
// Pattern dispatch: consumers call tryPatternMatch(c, ctx) to check
// if any registered pattern matches the current cursor position.

var _patterns = {};

function _patternCompileMode(p) {
  if (p._compileMode) return p._compileMode;
  var src = String(p.compile || '');
  var m = src.match(/^[^(]*\(\s*([^,\s)]+)\s*(?:,\s*([^,\s)]+))?\s*(?:,\s*([^,\s)]+))?/);
  var second = m && m[2] ? m[2] : '';
  var third = m && m[3] ? m[3] : '';
  if (third) {
    p._compileMode = 'c_children_ctx';
  } else if (second === 'children') {
    p._compileMode = 'c_children';
  } else {
    p._compileMode = 'c_ctx';
  }
  return p._compileMode;
}

function _callPatternCompile(p, c, children, ctx) {
  var mode = _patternCompileMode(p);
  if (mode === 'c_children_ctx') return p.compile(c, children, ctx);
  if (mode === 'c_children') return p.compile(c, children);
  return p.compile(c, ctx);
}

function _patternValueFmt(value) {
  if (typeof value !== 'string') return '{s}';
  if (
    value.indexOf('qjs_runtime.evalToString') >= 0 ||
    value.indexOf('getSlotString') >= 0 ||
    value.indexOf('[0..') >= 0 ||
    value.indexOf('_lens[') >= 0 ||
    value.indexOf('.len') >= 0 ||
    value.indexOf('"') >= 0 ||
    value.indexOf("'") >= 0
  ) return '{s}';
  return '{d}';
}

function _pushPatternDynText(result, children, ctx) {
  var isMap = !!ctx.currentMap;
  var bufId;
  if (isMap) {
    bufId = ctx.mapDynCount || 0;
    ctx.mapDynCount = bufId + 1;
  } else {
    bufId = ctx.dynCount;
    ctx.dynCount++;
  }
  ctx.dynTexts.push({
    bufId: bufId,
    fmtString: result.fmtString,
    fmtArgs: result.fmtArgs,
    arrName: '',
    arrIndex: 0,
    bufSize: result.bufSize || Math.max(64, String(result.fmtString || '').length + 20 * String(result.fmtArgs || '').split(',').length + 64),
    inMap: isMap,
    mapIdx: isMap ? ctx.maps.indexOf(ctx.currentMap) : -1,
  });
  var child = { nodeExpr: isMap ? '.{ .text = "__mt' + bufId + '__" }' : '.{ .text = "" }', dynBufId: bufId };
  if (isMap) child.inMap = true;
  children.push(child);
}

function _pushPatternValue(result, children, ctx) {
  if (result.value === null || result.value === undefined) return false;
  if (typeof result.value === 'string' && /^"(?:[^"\\]|\\.)*"$/.test(result.value)) {
    children.push({ nodeExpr: '.{ .text = ' + result.value + ' }' });
    return true;
  }
  _pushPatternDynText({ fmtString: _patternValueFmt(result.value), fmtArgs: result.value, bufSize: 256 }, children, ctx);
  return true;
}

function _applyPatternResult(result, children, ctx) {
  if (result === null || result === undefined) return false;
  if (result.children && result.children.length) {
    for (var i = 0; i < result.children.length; i++) children.push(result.children[i]);
    return true;
  }
  if (result.arrayChildren && result.arrayChildren.length) {
    for (var j = 0; j < result.arrayChildren.length; j++) children.push(result.arrayChildren[j]);
    return true;
  }
  if (result.nodeExpr) {
    children.push(result);
    return true;
  }
  if (result.fmtString !== undefined && result.fmtArgs !== undefined) {
    _pushPatternDynText(result, children, ctx);
    return true;
  }
  if (result.value !== undefined) return _pushPatternValue(result, children, ctx);
  return false;
}

// Try all registered patterns against the current cursor.
// Returns true if a pattern matched and handled the brace child, false otherwise.
// Patterns either push to children directly (ternary/conditional) or return
// a { nodeExpr } result which we push here.
function tryPatternMatch(c, children) {
  var before = children.length;
  for (var key in _patterns) {
    var p = _patterns[key];
    if (p && typeof p.match === 'function') {
      var saved = c.save();
      if (p.match(c, ctx)) {
        c.restore(saved);
        var posBefore = c.pos;
        var result = _callPatternCompile(p, c, children, ctx);
        // Pattern pushed to children itself (ternary/conditional delegates)
        if (children.length > before) {
          if (c.kind() === TK.rbrace) c.advance();
          return true;
        }
        // Pattern returned a result — normalize it to the brace-child contract
        if (_applyPatternResult(result, children, ctx)) {
          if (c.kind() === TK.rbrace) c.advance();
          return true;
        }
        // Pattern consumed tokens but returned null (swallow: bool/null/undefined)
        if (c.pos > posBefore) {
          return true;
        }
      }
      c.restore(saved);
    }
  }
  return false;
}
