function isModuleLaneBuild() {
  return globalThis.__modBuild === 1;
}

function compileModuleLane(source, file) {
  var inputPatterns = typeof scanIntentInputPatterns === 'function' ? scanIntentInputPatterns(source) : null;
  var moduleContract = typeof buildModuleSourceContract === 'function'
    ? buildModuleSourceContract(source, file)
    : null;
  if (globalThis.__SOURCE_CONTRACT_MODE === 1) {
    return JSON.stringify({
      version: 'source-contract-v1',
      file: file,
      lane: 'module',
      target: globalThis.__modTarget || 'zig',
      sourceTier: 'module',
      inputPatterns: inputPatterns,
      moduleContract: moduleContract,
      sourceBytes: source ? source.length : 0,
    }, null, 2);
  }
  var target = globalThis.__modTarget || 'zig';
  if (target === 'lua') return compileModLua(source, file);
  if (target === 'js') return compileModJS(source, file);
  return stampIntegrity(compileMod(source, file));
}
