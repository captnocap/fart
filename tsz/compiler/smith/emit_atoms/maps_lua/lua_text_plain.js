// ── Lua text emit: Plain strings ─────────────────────────────────
// Simple literal strings with no dynamic content.
// No semantic reparsing — direct Lua string emission.

function _luaTextPlain(text) {
  return '"' + String(text).replace(/"/g, '\\"') + '"';
}

function _luaTextFieldRef(fieldName) {
  return 'tostring(_item.' + fieldName + ')';
}
