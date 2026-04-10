// ── Intent Input Pattern Catalog ───────────────────────────────
//
// Dictionary-first catalog of chad-tier authoring constructs.
//
// Source of truth:
//   1. tsz/docs/INTENT_DICTIONARY.md
//   2. tsz/carts/conformance/chad/widgets/*
//   3. tsz/carts/conformance/chad/libs/*
//
// Explicitly excluded as authority for syntax shape:
//   - tsz/carts/conformance/chad/apps/*
//
// This scanner is metadata-only. It does not participate in parse/emit
// dispatch. Its job is to expose a stable, scoped input-pattern view that
// can be attached to the source contract and consumed by tooling.

var INTENT_INPUT_PATTERN_SCOPES = [
  { id: 'file', label: 'File Envelope' },
  { id: 'declaration', label: 'Declarations' },
  { id: 'logic', label: 'Logic Surface' },
  { id: 'control', label: 'Control Flow' },
  { id: 'visual', label: 'Visual Surface' },
  { id: 'backend', label: 'Backend Surface' },
  { id: 'collection', label: 'Collection Ops' },
];

function _intentLineNumber(source, index) {
  var line = 1;
  for (var i = 0; i < index; i++) {
    if (source.charCodeAt(i) === 10) line++;
  }
  return line;
}

function _intentLineText(source, index) {
  var start = source.lastIndexOf('\n', index);
  var end = source.indexOf('\n', index);
  if (start < 0) start = 0;
  else start += 1;
  if (end < 0) end = source.length;
  return source.slice(start, end);
}

function _intentScan(source, re, mapFn, limit) {
  var out = { count: 0, samples: [] };
  var maxSamples = limit || 3;
  re.lastIndex = 0;
  var match;
  while ((match = re.exec(source)) !== null) {
    var lineText = _intentLineText(source, match.index);
    if (lineText.trim().indexOf('//') === 0) {
      if (match[0] === '') re.lastIndex++;
      continue;
    }
    var sample = mapFn ? mapFn(match, source) : { text: match[0] };
    if (sample !== null && sample !== undefined) {
      out.count++;
      if (out.samples.length < maxSamples) {
        if (sample.line === undefined) sample.line = _intentLineNumber(source, match.index);
        if (sample.text === undefined) sample.text = match[0];
        out.samples.push(sample);
      }
    }
    if (match[0] === '') re.lastIndex++;
  }
  return out;
}

function _intentRegexCount(source, re) {
  return _intentScan(source, re).count;
}

var INTENT_INPUT_PATTERNS = [
  {
    id: 'c001',
    scope: 'file',
    name: 'named_block_header',
    description: 'Named entry or artifact block header.',
    examples: ['<weather widget>', '<layout lib>', '<query module>'],
    scan: function(source) {
      return _intentScan(source, /<([A-Za-z_][\w.]*)\s+(widget|page|app|component|lib|module|effect|glyph|animation)\s*>/g, function(match) {
        return {
          text: match[0],
          name: match[1],
          kind: match[2],
        };
      });
    },
  },
  {
    id: 'c002',
    scope: 'declaration',
    name: 'var_block',
    description: 'Top-level <var> declaration block.',
    examples: ['<var>'],
    scan: function(source) {
      return _intentScan(source, /<var>/g);
    },
  },
  {
    id: 'c003',
    scope: 'declaration',
    name: 'is_binding',
    description: '`is` binding in declarations, functions, classifiers, or themes.',
    examples: ['set_count is 0', 'fontSize is theme-fontLg'],
    scan: function(source) {
      return _intentScan(source, /^\s*(?:[A-Za-z_][\w.]*|\.[\w.]+)\s+is\s+.+$/gm);
    },
  },
  {
    id: 'c004',
    scope: 'declaration',
    name: 'exact_binding',
    description: '`exact` binding in declarations, control flow, or classifier structure.',
    examples: ['MAX exact 100', 'flexDirection exact row'],
    scan: function(source) {
      return _intentScan(source, /^\s*(?:[A-Za-z_][\w.]*|\.[\w.]+)\s+exact\s+.+$/gm);
    },
  },
  {
    id: 'c005',
    scope: 'declaration',
    name: 'shape_has_block',
    description: 'Shape declaration block using `has`.',
    examples: ['<record has>'],
    scan: function(source) {
      return _intentScan(source, /<([A-Za-z_][\w.]*)\s+has\s*>/g, function(match) {
        return {
          text: match[0],
          name: match[1],
        };
      });
    },
  },
  {
    id: 'c006',
    scope: 'declaration',
    name: 'types_block',
    description: '<types> block and nested type declarations.',
    examples: ['<types>', '<Channel>'],
    scan: function(source) {
      return _intentScan(source, /<types>/g);
    },
  },
  {
    id: 'c007',
    scope: 'declaration',
    name: 'props_block',
    description: '<props> block for component contracts.',
    examples: ['<props>'],
    scan: function(source) {
      return _intentScan(source, /<props>/g);
    },
  },
  {
    id: 'c008',
    scope: 'declaration',
    name: 'structured_data_declaration',
    description: 'Structured data declaration that implies a named data block.',
    examples: ['cards is objects', 'pages is page array', 'config is object'],
    scan: function(source) {
      return _intentScan(source, /^\s*[A-Za-z_][\w.]*\s+is\s+(?:objects|object|array|[A-Za-z_][\w.]*\s+array)\s*$/gm);
    },
  },
  {
    id: 'c009',
    scope: 'logic',
    name: 'functions_block',
    description: 'Top-level <functions> block.',
    examples: ['<functions>'],
    scan: function(source) {
      return _intentScan(source, /<functions>/g);
    },
  },
  {
    id: 'c010',
    scope: 'logic',
    name: 'function_header',
    description: 'Named function header, including args, requires, every, and cleanup forms.',
    examples: ['increment:', 'mixDown every 5:', 'toggleItem requires item:'],
    scan: function(source) {
      return _intentScan(source, /^\s*[A-Za-z_]\w*(?:\([^)]*\))?(?:\s+(?:requires\s+[^:]+|every\s+\d+|cleanup))*\s*:\s*$/gm);
    },
  },
  {
    id: 'c011',
    scope: 'logic',
    name: 'reserved_hook_header',
    description: 'Reserved lifecycle hook names.',
    examples: ['boot:', 'shutdown:'],
    scan: function(source) {
      return _intentScan(source, /^\s*(boot|shutdown)\s*:\s*$/gm, function(match) {
        return { text: match[0], hook: match[1] };
      });
    },
  },
  {
    id: 'c012',
    scope: 'logic',
    name: 'setter_mutation',
    description: 'Reactive state mutation via set_ prefix.',
    examples: ['set_count is count + 1'],
    scan: function(source) {
      return _intentScan(source, /^\s*set_[A-Za-z_]\w*\s+is\s+.+$/gm);
    },
  },
  {
    id: 'c013',
    scope: 'control',
    name: 'if_else_blocks',
    description: '<if>, <else if>, and <else> blocks.',
    examples: ['<if count above 0>', '<else if count exact 0>', '<else>'],
    scan: function(source) {
      return _intentScan(source, /<(?:if\b[^>]*|else(?:\s+if\b[^>]*)?)>/g);
    },
  },
  {
    id: 'c014',
    scope: 'control',
    name: 'if_as_binding',
    description: '<if ... as name> conditional binding.',
    examples: ["<if net.get(url) as response>"],
    scan: function(source) {
      return _intentScan(source, /<if\s+[^>]*\sas\s+[A-Za-z_]\w*\s*>/g);
    },
  },
  {
    id: 'c015',
    scope: 'control',
    name: 'for_block',
    description: '<for> collection or range iteration.',
    examples: ['<for cards as card>', '<for 0..count as i>'],
    scan: function(source) {
      return _intentScan(source, /<for\s+[^>]+>/g);
    },
  },
  {
    id: 'c016',
    scope: 'control',
    name: 'during_block',
    description: '<during> reactive/lifecycle scope.',
    examples: ['<during loading>', '<during ready>'],
    scan: function(source) {
      return _intentScan(source, /<during\s+[^>]+>/g);
    },
  },
  {
    id: 'c017',
    scope: 'control',
    name: 'while_block',
    description: '<while> loop.',
    examples: ['<while sqlite3.step(prepared) as current>'],
    scan: function(source) {
      return _intentScan(source, /<while\s+[^>]+>/g);
    },
  },
  {
    id: 'c018',
    scope: 'control',
    name: 'switch_case_blocks',
    description: '<switch> and <case> branching.',
    examples: ['<switch condition>', '<case else>'],
    scan: function(source) {
      return _intentScan(source, /<switch\b[^>]*>|<case\b[^>]*>/g);
    },
  },
  {
    id: 'c019',
    scope: 'control',
    name: 'stop_skip',
    description: 'Control-flow keywords stop and skip.',
    examples: ['stop', 'skip'],
    scan: function(source) {
      return _intentScan(source, /^\s*(?:stop|skip)\s*$/gm);
    },
  },
  {
    id: 'c020',
    scope: 'visual',
    name: 'classifier_definition',
    description: 'Classifier definition against a primitive.',
    examples: ['<C.Btn is Pressable>', '<C.Value is Text>'],
    scan: function(source) {
      return _intentScan(source, /<C\.[A-Za-z_][\w.]*\s+is\s+(?:Box|Text|Image|Pressable|ScrollView|TextInput|Canvas|Effect)\s*>/g);
    },
  },
  {
    id: 'c021',
    scope: 'visual',
    name: 'classifier_usage',
    description: 'Classifier usage in return() including composed press actions.',
    examples: ['<C.Btn decrement>', '<C.Btn bounce + decrement>'],
    scan: function(source) {
      return _intentScan(source, /<C\.[A-Za-z_][\w.]*(?:\s+[^>]+)?>/g, function(match) {
        if (/\s+is\s+/.test(match[0])) return null;
        return {
          text: match[0],
          composed: match[0].indexOf('+') >= 0,
        };
      });
    },
  },
  {
    id: 'c022',
    scope: 'visual',
    name: 'token_theme_surface',
    description: 'Theme token declaration or theme-token reference.',
    examples: ['<tokens>', '<main>', 'theme-primary'],
    scan: function(source) {
      var tokensScan = _intentScan(source, /<tokens>|\btheme-[A-Za-z_]\w*/g);
      var mainScan = { count: 0, samples: [] };
      if (tokensScan.count > 0 || /\btheme-[A-Za-z_]\w*/.test(source)) {
        mainScan = _intentScan(source, /^\s*<main>\s*$/gm);
      }
      return {
        count: tokensScan.count + mainScan.count,
        samples: tokensScan.samples.concat(mainScan.samples).slice(0, 3),
      };
    },
  },
  {
    id: 'c023',
    scope: 'visual',
    name: 'colors_gradient_surface',
    description: '<colors> block or named gradient definition.',
    examples: ['<colors>', '<ocean gradient>'],
    scan: function(source) {
      return _intentScan(source, /<colors>|<[A-Za-z_][\w.]*\s+gradient\s*>/g);
    },
  },
  {
    id: 'c024',
    scope: 'visual',
    name: 'effect_surface',
    description: 'Effect definition block.',
    examples: ['<lava effect>'],
    scan: function(source) {
      return _intentScan(source, /<([A-Za-z_][\w.]*)\s+effect\s*>/g, function(match) {
        return {
          text: match[0],
          name: match[1],
        };
      });
    },
  },
  {
    id: 'c025',
    scope: 'visual',
    name: 'glyph_surface',
    description: 'Glyph definition block or inline glyph shortcode.',
    examples: ['<check glyph>', ':warning:', ':star[plasma]:'],
    scan: function(source) {
      return _intentScan(source, /<([A-Za-z_][\w.]*)\s+glyph(?:\s*\/)?\s*>|:[A-Za-z_][\w-]*(?:\[[^\]]+\])?:/g, function(match) {
        return {
          text: match[0],
          kind: match[0].charAt(0) === ':' ? 'shortcode' : 'block',
        };
      });
    },
  },
  {
    id: 'c026',
    scope: 'visual',
    name: 'animation_surface',
    description: 'Animation definition block.',
    examples: ['<pulse animation>'],
    scan: function(source) {
      return _intentScan(source, /<([A-Za-z_][\w.]*)\s+animation\s*>/g, function(match) {
        return {
          text: match[0],
          name: match[1],
        };
      });
    },
  },
  {
    id: 'c027',
    scope: 'backend',
    name: 'uses_block',
    description: '<uses> dependency block for modules.',
    examples: ['<uses>'],
    scan: function(source) {
      return _intentScan(source, /<uses>/g);
    },
  },
  {
    id: 'c028',
    scope: 'backend',
    name: 'ffi_block',
    description: 'Per-library FFI block.',
    examples: ['<sqlite3 ffi>', '<curl ffi>'],
    scan: function(source) {
      return _intentScan(source, /<([A-Za-z_][\w.]*)\s+ffi\s*>/g, function(match) {
        return {
          text: match[0],
          library: match[1],
        };
      });
    },
  },
  {
    id: 'c029',
    scope: 'backend',
    name: 'backend_hatch',
    description: 'Backend target hatch or raw hatch surface.',
    examples: ['<script>', '<lscript>', '<zscript>', '<svg>'],
    scan: function(source) {
      var hatchScan = _intentScan(source, /<(?:script|lscript|zscript)>/g);
      var svgScan = { count: 0, samples: [] };
      if (/<([A-Za-z_][\w.]*)\s+glyph\s*>/.test(source)) {
        svgScan = _intentScan(source, /<svg>/g);
      }
      return {
        count: hatchScan.count + svgScan.count,
        samples: hatchScan.samples.concat(svgScan.samples).slice(0, 3),
      };
    },
  },
  {
    id: 'c030',
    scope: 'collection',
    name: 'collection_ops',
    description: 'Collection helper ops retained by intent syntax.',
    examples: ['items.where(item.active)', 'items.without(item)', 'items.concat(newItem)'],
    scan: function(source) {
      return _intentScan(source, /\.(where|without|concat)\s*\(/g, function(match) {
        return {
          text: match[0],
          op: match[1],
        };
      });
    },
  },
];

function scanIntentInputPatterns(source) {
  source = source || '';
  var matchedPatterns = [];
  var matchedIds = [];
  var scopeState = {};
  for (var si = 0; si < INTENT_INPUT_PATTERN_SCOPES.length; si++) {
    var scope = INTENT_INPUT_PATTERN_SCOPES[si];
    scopeState[scope.id] = {
      id: scope.id,
      label: scope.label,
      matchedIds: [],
      matchedCount: 0,
    };
  }

  for (var pi = 0; pi < INTENT_INPUT_PATTERNS.length; pi++) {
    var pattern = INTENT_INPUT_PATTERNS[pi];
    var hit = pattern.scan(source);
    if (!hit || hit.count <= 0) continue;
    matchedIds.push(pattern.id);
    matchedPatterns.push({
      id: pattern.id,
      scope: pattern.scope,
      name: pattern.name,
      description: pattern.description,
      examples: pattern.examples,
      count: hit.count,
      samples: hit.samples,
    });
    scopeState[pattern.scope].matchedIds.push(pattern.id);
    scopeState[pattern.scope].matchedCount++;
  }

  var scopes = [];
  var matchedScopeCount = 0;
  for (var sj = 0; sj < INTENT_INPUT_PATTERN_SCOPES.length; sj++) {
    var scopeInfo = scopeState[INTENT_INPUT_PATTERN_SCOPES[sj].id];
    if (scopeInfo.matchedCount > 0) matchedScopeCount++;
    scopes.push(scopeInfo);
  }

  return {
    version: 'intent-input-v1',
    authority: {
      dictionary: 'tsz/docs/INTENT_DICTIONARY.md',
      conformance_include: [
        'tsz/carts/conformance/chad/widgets',
        'tsz/carts/conformance/chad/libs',
      ],
      conformance_exclude: [
        'tsz/carts/conformance/chad/apps',
      ],
    },
    catalogSize: INTENT_INPUT_PATTERNS.length,
    matchedScopeCount: matchedScopeCount,
    matchCount: matchedPatterns.length,
    matchedIds: matchedIds,
    scopes: scopes,
    patterns: matchedPatterns,
    summary: 'scopes=' + matchedScopeCount + ' patterns=' + matchedPatterns.length + (matchedIds.length ? ' ids=' + matchedIds.join(',') : ''),
  };
}

function hasIntentInputPatterns(source) {
  return scanIntentInputPatterns(source).matchCount > 0;
}
