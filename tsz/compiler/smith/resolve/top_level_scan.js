// resolve/top_level_scan.js — Top-level token finders (skip nested parens/braces/strings)
// Extracted as-is from soup.js:923, soup.js:938

function soupFindTopLevelAnd(expr) {
  var depth = 0, i = 0, last = -1;
  while (i < expr.length - 1) {
    var ch = expr.charAt(i);
    if (ch === "'" || ch === '"' || ch === '`') {
      var q = ch; i++;
      while (i < expr.length && expr.charAt(i) !== q) { if (expr.charAt(i) === '\\') i++; i++; }
    } else if (ch === '(' || ch === '{' || ch === '[') { depth++; }
    else if (ch === ')' || ch === '}' || ch === ']') { depth--; }
    else if (depth === 0 && ch === '&' && expr.charAt(i + 1) === '&') { last = i; }
    i++;
  }
  return last;
}

function soupFindTopLevelChar(expr, target) {
  var depth = 0, i = 0;
  while (i < expr.length) {
    var ch = expr.charAt(i);
    if (ch === "'" || ch === '"' || ch === '`') {
      var q = ch; i++;
      while (i < expr.length && expr.charAt(i) !== q) { if (expr.charAt(i) === '\\') i++; i++; }
    } else if (ch === '(' || ch === '{' || ch === '[') { depth++; }
    else if (ch === ')' || ch === '}' || ch === ']') { depth--; }
    else if (depth === 0 && ch === target) { return i; }
    i++;
  }
  return -1;
}
