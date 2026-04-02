// ── Chad lane compiler ──────────────────────────────────────────────
// Handles <name widget|page|app|component> block syntax.
//
// This is the chad on-ramp to the highway. Strict dictionary syntax:
// if it doesn't match exact form, it should have fallen through to
// mixed or soup in the dispatcher. Hard stop — no fuzzy matching.
//
// Chad blocks:
//   <counter widget>    → widget (standalone UI)
//   <home page>         → page (routable view)
//   <myapp app>         → app (entry point)
//   <button component>  → component (reusable, takes props)
//   <utils lib>         → lib (no UI, composes modules) [future]
//
// Block syntax inside:
//   <var>       → state slots + ambient reads
//   <state>     → setter name declarations
//   <functions> → JS_LOGIC script block
//   <timer>     → setInterval
//   return(...) → JSX tree (classifier components, dictionary props)
//
// Merges onto the highway at finishParsedLane().

// ── Chad block detection ──

function detectChadBlock(source) {
  // Find the LAST matching block — forge prepends imports, main source is last.
  // We want the main entry block (app/page/widget/component), not an imported lib.
  var re = /<(\w+)\s+(widget|page|app|component|lib)\s*>/g;
  var match;
  var last = null;
  while ((match = re.exec(source)) !== null) {
    last = match;
  }
  if (!last) return null;
  return {
    name: last[1],
    type: last[2],
    tag: last[0],
    closeTag: '</' + last[1] + '>',
  };
}

// ── Chad source preflight ──
// Validates the source is actually chad BEFORE we try to compile it.
// Hard stop: if this fails, the source is not chad. Period.

function chadSourcePreflight(source, block) {
  if (!block) return { ok: false, reason: 'no chad block detected' };

  if (source.indexOf(block.closeTag) < 0) {
    return { ok: false, reason: 'missing closing tag ' + block.closeTag };
  }

  // Lib blocks have no return() — they compose modules
  if (block.type !== 'lib') {
    if (source.indexOf('return(') < 0 && source.indexOf('return (') < 0) {
      return { ok: false, reason: 'no return() found in ' + block.type + ' block' };
    }
  }

  // Mixed-lane patterns are a hard stop — you're in the wrong lane
  if (/\bfunction\s+App\s*\(/.test(source)) {
    return { ok: false, reason: 'function App() is mixed lane — not chad' };
  }
  if (/\buseState\s*\(/.test(source)) {
    return { ok: false, reason: 'useState() is mixed lane — not chad' };
  }
  if (/\buseEffect\s*\(/.test(source)) {
    return { ok: false, reason: 'useEffect() is mixed lane — not chad' };
  }

  return { ok: true };
}

// ── Extract inner content from chad block ──

function extractChadInner(source, block) {
  var openRe = new RegExp('<' + block.name + '\\s+' + block.type + '\\s*>');
  var openMatch = source.match(openRe);
  if (!openMatch) return source;
  var startIdx = openMatch.index + openMatch[0].length;
  var endIdx = source.indexOf(block.closeTag, startIdx);
  if (endIdx < 0) return source;
  return source.slice(startIdx, endIdx);
}

// ── Chad lane entry point ──

function compileChadLane(source, tokens, file) {
  var c = mkCursor(tokens, source);
  resetCtx();
  assignSurfaceTier(source, file);

  // ── Detect chad block ──
  var block = detectChadBlock(source);

  // ── Source preflight — hard stop ──
  var spf = chadSourcePreflight(source, block);
  if (!spf.ok) {
    return '// Smith error: chad source preflight failed — ' + spf.reason + '\n' +
           'comptime { @compileError("Chad source preflight: ' + spf.reason + '"); }\n';
  }

  // ── Extract inner content ──
  var inner = extractChadInner(source, block);

  // ── Extract declarative blocks from inner source ──
  var varBlock = extractPageBlock(inner, 'var');
  var stateBlock = extractPageBlock(inner, 'state');
  var functionsBlock = extractPageBlock(inner, 'functions');
  var timerBlocks = extractPageBlocks(inner, 'timer');

  // ── Parse <types> block → type variant values ──
  // These are string enums: <types><mode>time\ndate\nsystem</mode></types>
  // The transpiler needs to quote bare words that match type variants.
  var typesBlock = extractPageBlock(inner, 'types');
  ctx._typeVariants = {};
  if (typesBlock) {
    var typeBlockRe = /<(\w+)>([\s\S]*?)<\/\1>/g;
    var tbMatch;
    while ((tbMatch = typeBlockRe.exec(typesBlock)) !== null) {
      var typeName = tbMatch[1];
      var typeBody = tbMatch[2];
      var variants = typeBody.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l && !l.startsWith('//'); });
      for (var tvi = 0; tvi < variants.length; tvi++) {
        ctx._typeVariants[variants[tvi]] = typeName;
      }
    }
  }

  // Track <module> blocks as ignored (not yet compiled)
  var moduleMatches = inner.match(/<module\s+(\w+)\s*>/g);
  if (moduleMatches) {
    for (var mi = 0; mi < moduleMatches.length; mi++) {
      var modName = moduleMatches[mi].match(/<module\s+(\w+)/);
      if (modName) ctx._ignoredModuleBlocks.push({ name: modName[1] });
    }
  }

  // ── Parse <var> block → state vars + ambient reads ──
  var allVars = parsePageVarBlock(varBlock);
  var ambients = [];
  var stateVars = [];
  for (var vi = 0; vi < allVars.length; vi++) {
    if (allVars[vi].ambient) {
      ambients.push(allVars[vi]);
    } else {
      stateVars.push(allVars[vi]);
    }
  }

  // ── Parse <state> block → setter names ──
  var declaredSetters = parsePageStateBlock(stateBlock);

  // ── Populate ctx.stateSlots from primitive state vars ──
  for (var si = 0; si < stateVars.length; si++) {
    var sv = stateVars[si];
    if (sv.type === 'int' || sv.type === 'float' || sv.type === 'boolean' || sv.type === 'string') {
      ctx.stateSlots.push({
        getter: sv.name,
        setter: 'set_' + sv.name,
        initial: sv.initial,
        type: sv.type,
      });
    }
  }

  // ── Build JS_LOGIC from <functions>, <timer>, state declarations ──
  var jsLogic = buildPageJSLogic(stateVars, ambients, functionsBlock, timerBlocks);
  ctx.scriptBlock = jsLogic.scriptBlock;
  ctx.scriptFuncs = jsLogic.funcNames;

  // Register declared setters as script funcs (handler resolution)
  for (var di = 0; di < declaredSetters.length; di++) {
    if (ctx.scriptFuncs.indexOf(declaredSetters[di]) < 0) {
      ctx.scriptFuncs.push(declaredSetters[di]);
    }
  }

  // ── Register OAs for object_array state vars ──
  for (var oai = 0; oai < stateVars.length; oai++) {
    var oav = stateVars[oai];
    if (oav.type !== 'object_array' || !oav.initial) continue;
    var oaFieldMatch = oav.initial.match(/\[\s*\{([^}]+)\}/);
    if (!oaFieldMatch) continue;
    var oaFieldPairs = oaFieldMatch[1].split(',');
    var oaFields = [];
    for (var ofi = 0; ofi < oaFieldPairs.length; ofi++) {
      var pair = oaFieldPairs[ofi].trim();
      var colonIdx = pair.indexOf(':');
      if (colonIdx < 0) continue;
      var fname = pair.slice(0, colonIdx).trim();
      var fval = pair.slice(colonIdx + 1).trim();
      var ftype = 'int';
      if (fval[0] === "'" || fval[0] === '"') ftype = 'string';
      else if (fval === 'true' || fval === 'false') ftype = 'boolean';
      else if (fval.indexOf('.') >= 0) ftype = 'float';
      oaFields.push({ name: fname, type: ftype });
    }
    if (oaFields.length > 0) {
      var oaIdx = ctx.objectArrays.length;
      ctx.objectArrays.push({
        fields: oaFields,
        getter: oav.name,
        setter: 'set_' + oav.name,
        oaIdx: oaIdx,
      });
    }
  }

  // ── Collection passes ──
  collectComponents(c);
  collectConstArrays(c);
  collectClassifiers();

  // ── Chad always dispatches handlers through JS ──
  ctx.handlerDispatch = 'js';

  // ── Find return() in tokens → parse JSX ──
  c.pos = 0;
  var foundReturn = false;
  while (c.pos < c.count) {
    if (c.isIdent('return') && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.lparen) {
      c.advance(); // skip 'return'
      c.advance(); // skip '('
      foundReturn = true;
      break;
    }
    c.advance();
  }

  if (!foundReturn) {
    return '// Smith error: no return() found in chad block <' + block.name + ' ' + block.type + '>\n' +
           'comptime { @compileError("No return() in <' + block.name + ' ' + block.type + '>"); }\n';
  }

  // ── Parse JSX tree ──
  var root = parseJSXElement(c);

  // NOTE: __evalDynTexts is generated by emit_split.js from ctx._jsDynTexts.
  // Do NOT append it here — the emit layer handles it on the highway.

  // ── Merge onto the highway ──
  return finishParsedLane(root.nodeExpr, file);
}
