// Mod imports block — extracted from mod.js

function emitImportsBlock(content) {
  let out = '';
  _modImportedNames = [];
  const seenModules = {};
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('//')) continue;
    const m = line.match(/^(\w+)\s+from\s+"([^"]+)"$/);
    if (!m) continue;
    const name = m[1];
    let path = m[2];
    if (path.startsWith('./')) path = path.slice(2);
    const modulePath = path;
    const moduleBase = modulePath.replace(/\.zig$/, '').split('/').pop();
    _modImportedNames.push(name);
    if (_modReservedNames.indexOf(name) === -1) _modReservedNames.push(name);
    if (/^[A-Z]/.test(name)) {
      if (!seenModules[moduleBase]) {
        out += 'const ' + moduleBase + ' = @import("' + modulePath + '");\n';
        seenModules[moduleBase] = true;
        if (_modReservedNames.indexOf(moduleBase) === -1) _modReservedNames.push(moduleBase);
      }
      out += 'const ' + name + ' = ' + moduleBase + '.' + name + ';\n';
    } else {
      out += 'const ' + name + ' = @import("' + modulePath + '");\n';
    }
  }
  return out;
}
