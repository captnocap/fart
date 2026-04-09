// ── Const OA resolution helpers ──────────────────────────────────
// Moved from core.js per migration step 559-561.

// Detect identifier[number] or identifier[number].field where identifier is a const OA.
// Returns { value, skip } if found, null otherwise.
function resolveConstOaAccess(c) {
  if (c.kind() !== TK.identifier) return null;
  var name = c.text();
  var oa = null;
  for (var _oi = 0; _oi < ctx.objectArrays.length; _oi++) {
    if (ctx.objectArrays[_oi].getter === name && ctx.objectArrays[_oi].isConst && ctx.objectArrays[_oi].constData) {
      oa = ctx.objectArrays[_oi];
      break;
    }
  }
  if (!oa) return null;

  // Check for [index] pattern: identifier [ number ]
  if (c.pos + 3 >= c.count) return null;
  if (c.kindAt(c.pos + 1) !== TK.lbracket) return null;
  if (c.kindAt(c.pos + 2) !== TK.number) return null;
  if (c.kindAt(c.pos + 3) !== TK.rbracket) return null;

  var rowIdx = parseInt(c.textAt(c.pos + 2));
  if (rowIdx >= oa.constData.length) return null;

  // Check for .field after [index]: identifier [ number ] . field
  if (c.pos + 5 < c.count && c.kindAt(c.pos + 4) === TK.dot && c.kindAt(c.pos + 5) === TK.identifier) {
    var field = c.textAt(c.pos + 5);
    var data = oa.constData[rowIdx][field];
    if (data === undefined) return null;
    var fieldInfo = null;
    for (var _fi = 0; _fi < oa.fields.length; _fi++) {
      if (oa.fields[_fi].name === field) { fieldInfo = oa.fields[_fi]; break; }
    }
    var val = (fieldInfo && fieldInfo.type === 'string') ? '"' + data + '"' : String(data);
    return { value: val, skip: 6 };
  }

  // Just [index] — return a const OA row reference marker
  return { value: '\x01CONST_OA:' + oa.oaIdx + ':' + rowIdx, skip: 4, isRowRef: true };
}

// Resolve .field access on a const OA row reference marker string.
// Returns resolved value string or null.
function resolveConstOaFieldFromRef(refValue, field) {
  if (typeof refValue !== 'string' || refValue.charCodeAt(0) !== 1) return null;
  var parts = refValue.substring(1).split(':');
  if (parts[0] !== 'CONST_OA') return null;
  var oaIdx = parseInt(parts[1]);
  var rowIdx = parseInt(parts[2]);
  var oa = ctx.objectArrays[oaIdx];
  if (!oa || !oa.constData || !oa.constData[rowIdx]) return null;
  var data = oa.constData[rowIdx][field];
  if (data === undefined) return null;
  var fieldInfo = null;
  for (var _fi = 0; _fi < oa.fields.length; _fi++) {
    if (oa.fields[_fi].name === field) { fieldInfo = oa.fields[_fi]; break; }
  }
  return (fieldInfo && fieldInfo.type === 'string') ? '"' + data + '"' : String(data);
}
