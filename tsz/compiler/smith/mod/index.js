// Compatibility block-module orchestrator.
//
// This path owns the non-dictionary `<module name> ... </module>` surface used
// by legacy/layout-style module codegen. The active dictionary module contract
// is `<name module> ... </name>` and will route through a dedicated intent
// module path instead of this compatibility block surface.

var _modStateVars = [];
var _modImportedNames = [];
var _modFnPtrParams = {};
var _modEnumVariants = [];
var _modFfiSymbols = null;
var _modLoopSerial = 0;
var _modReservedNames = [];
var _modStateVarTypes = {};
var _modConstVarTypes = {};
var _modTypeFieldMap = {};

function compileModBlock(source, file) {
  const contract = typeof buildModuleSourceContract === 'function'
    ? buildModuleSourceContract(source, file)
    : null;
  if (contract && contract.syntax === 'compat-block') {
    return compileCompatModuleContract(contract, file);
  }
  return compileCompatModuleContract({
    moduleName: 'unknown',
    blocks: {
      imports: extractModBlock(source, 'imports'),
      ffi: extractModBlock(source, 'ffi'),
      types: extractModBlock(source, 'types'),
      consts: extractModBlock(source, 'const'),
      state: extractModBlock(source, 'state'),
      functions: extractModBlock(source, 'functions'),
    },
  }, file);
}

function compileCompatModuleContract(contract, file) {
  const basename = file.split('/').pop();
  _modStateVars = [];
  _modImportedNames = [];
  _modFnPtrParams = {};
  _modEnumVariants = [];
  _modFfiSymbols = null;
  _modLoopSerial = 0;
  _modReservedNames = ['std', 'ptr', 'bits', 'max', 'min', 'is_infinite', 'reverse'];
  _modStateVarTypes = {};
  _modConstVarTypes = {};
  _modTypeFieldMap = {};

  // Compatibility block sections. These are not the active dictionary module
  // blocks, which use `<uses>`, per-lib `<ffi>`, and `<var>` with `set_`.
  const moduleName = contract && contract.moduleName ? contract.moduleName : 'unknown';
  const ctx = {
    source: contract && contract.source ? contract.source : null,
    file: file,
    moduleName: moduleName,
    blocks: {
      imports: contract && contract.blocks ? contract.blocks.imports : null,
      ffi: contract && contract.blocks ? contract.blocks.ffi : null,
      types: contract && contract.blocks ? contract.blocks.types : null,
      consts: contract && contract.blocks ? contract.blocks.consts : null,
      state: contract && contract.blocks ? contract.blocks.state : null,
      functions: contract && contract.blocks ? contract.blocks.functions : null,
    },
    typeNames: [],
    enumVariants: {},
    allVariants: [],
  };
  const meta = {
    basename: basename,
    moduleName: moduleName,
    target: globalThis.__modTarget || 'zig',
  };
  const out = runModuleEmitAtoms(ctx, meta);
  return out.replace(/\n+$/, '\n');
}

function extractModBlock(source, tag) {
  const re = new RegExp('^\\s*<' + tag + '>\\s*\\n([\\s\\S]*?)^\\s*<\\/' + tag + '>\\s*$', 'm');
  const m = source.match(re);
  return m ? m[1] : null;
}
