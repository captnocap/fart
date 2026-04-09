// _joinTokenText — moved to parse/cursor.js

function _expandRenderLocalJs(expr) {
  let out = expr;
  if (!ctx._renderLocalRaw) return out;
  const names = Object.keys(ctx._renderLocalRaw).sort((a, b) => b.length - a.length);
  for (const name of names) {
    const raw = ctx._renderLocalRaw[name];
    if (!raw || raw === expr) continue;
    out = out.replace(new RegExp(`\\b${name}\\b`, 'g'), function(match, offset, full) {
      let prev = offset - 1;
      while (prev >= 0 && /\s/.test(full[prev])) prev--;
      if (prev >= 0 && full[prev] === '.') return match;
      return `(${_normalizeJoinedJsExpr(raw)})`;
    });
  }
  return out;
}

function _expandRenderLocalJsFully(expr) {
  let out = expr;
  for (let i = 0; i < 6; i++) {
    const next = _expandRenderLocalJs(out);
    if (next === out) break;
    out = next;
  }
  return out;
}

function _makeEvalTruthyExpr(jsExpr) {
  return zigBool(buildEval(_expandRenderLocalJs(jsExpr), ctx), ctx);
}

// _normalizeJoinedJsExpr, _findLastTopLevelAmpAmp — moved to parse/cursor.js
