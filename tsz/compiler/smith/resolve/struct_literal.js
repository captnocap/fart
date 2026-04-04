// resolve/struct_literal.js — {k: v} → .{.k = v} transpilation
// Extracted as-is from mod.js:940

// Split struct literal fields respecting brace nesting, then transpile each
function transpileStructLiteral(inner) {
  // Split by commas that aren't inside nested { }
  const fields = [];
  let depth = 0; let cur = '';
  for (let c = 0; c < inner.length; c++) {
    if (inner[c] === '{') depth++;
    if (inner[c] === '}') depth--;
    if (inner[c] === ',' && depth === 0) { fields.push(cur.trim()); cur = ''; continue; }
    cur += inner[c];
  }
  if (cur.trim()) fields.push(cur.trim());
  // Transpile each field: key: value → .key = value
  const zigFields = fields.map(function(f) {
    const kv = f.match(/^(\w+):\s*(.+)$/);
    if (!kv) return f;
    const val = kv[2].trim();
    // Check if value is a nested struct literal { ... }
    const nestedMatch = val.match(/^\{(.+)\}$/);
    if (nestedMatch) return '.' + kv[1] + ' = ' + transpileStructLiteral(nestedMatch[1]);
    return '.' + kv[1] + ' = ' + modTranspileExpr(val);
  });
  return '.{ ' + zigFields.join(', ') + ' }';
}
