// Smith — compiler intelligence in JS.
//
// Globals set by Forge:
//   __source  — .tsz source text
//   __tokens  — "kind start end\n..." flat token data
//   __file    — input file path

// ── Token kinds (must match lexer.zig TokenKind enum order) ──
const TK = {
  identifier: 0, number: 1, string: 2, template_literal: 3,
  lparen: 4, rparen: 5, lbrace: 6, rbrace: 7, lbracket: 8, rbracket: 9,
  comma: 10, colon: 11, semicolon: 12, dot: 13, spread: 14, equals: 15,
  arrow: 16, plus: 17, minus: 18, star: 19, slash: 20, percent: 21, bang: 22,
  eq_eq: 23, not_eq: 24, gt_eq: 25, lt_eq: 26,
  ampersand: 27, pipe: 28, caret: 29, tilde: 30, shift_left: 31, shift_right: 32,
  wrap_mul: 33, wrap_add: 34, wrap_sub: 35, caret_eq: 36,
  amp_amp: 37, pipe_pipe: 38,
  question: 39, question_question: 40,
  lt: 41, gt: 42, slash_gt: 43, lt_slash: 44,
  ffi_pragma: 45, comment: 46, builtin: 47, eof: 48,
};

// ── Rules ──

const styleKeys = {
  width: 'width', height: 'height',
  minWidth: 'min_width', maxWidth: 'max_width',
  minHeight: 'min_height', maxHeight: 'max_height',
  flexGrow: 'flex_grow', flexShrink: 'flex_shrink', flexBasis: 'flex_basis',
  gap: 'gap', order: 'order',
  padding: 'padding', paddingLeft: 'padding_left', paddingRight: 'padding_right',
  paddingTop: 'padding_top', paddingBottom: 'padding_bottom',
  margin: 'margin', marginLeft: 'margin_left', marginRight: 'margin_right',
  marginTop: 'margin_top', marginBottom: 'margin_bottom',
  borderRadius: 'border_radius', opacity: 'opacity', borderWidth: 'border_width',
  borderLeftWidth: 'border_left_width', borderRightWidth: 'border_right_width',
  borderTopWidth: 'border_top_width', borderBottomWidth: 'border_bottom_width',
  shadowOffsetX: 'shadow_offset_x', shadowOffsetY: 'shadow_offset_y', shadowBlur: 'shadow_blur',
  top: 'top', left: 'left', right: 'right', bottom: 'bottom',
  aspectRatio: 'aspect_ratio', rotation: 'rotation', scaleX: 'scale_x', scaleY: 'scale_y',
};

const colorKeys = {
  backgroundColor: 'background_color',
  borderColor: 'border_color',
  shadowColor: 'shadow_color',
  gradientColorEnd: 'gradient_color_end',
};

const enumKeys = {
  flexDirection:     { field: 'flex_direction', values: { row: '.row', column: '.column' }},
  justifyContent:    { field: 'justify_content', values: { start: '.start', center: '.center', end: '.end', 'space-between': '.space_between', spaceBetween: '.space_between', 'space-around': '.space_around', spaceAround: '.space_around', 'flex-start': '.start', 'flex-end': '.end' }},
  alignItems:        { field: 'align_items', values: { start: '.start', center: '.center', end: '.end', stretch: '.stretch', 'flex-start': '.start', 'flex-end': '.end' }},
  alignSelf:         { field: 'align_self', values: { auto: '.auto', start: '.start', center: '.center', end: '.end', stretch: '.stretch' }},
  alignContent:      { field: 'align_content', values: { start: '.start', center: '.center', end: '.end', stretch: '.stretch', 'space-between': '.space_between', 'space-around': '.space_around' }},
  flexWrap:          { field: 'flex_wrap', values: { nowrap: '.no_wrap', noWrap: '.no_wrap', wrap: '.wrap', 'wrap-reverse': '.wrap_reverse' }},
  position:          { field: 'position', values: { relative: '.relative', absolute: '.absolute' }},
  display:           { field: 'display', values: { flex: '.flex', none: '.none' }},
  textAlign:         { field: 'text_align', values: { left: '.left', center: '.center', right: '.right' }},
  overflow:          { field: 'overflow', values: { visible: '.visible', hidden: '.hidden', scroll: '.scroll' }},
  gradientDirection: { field: 'gradient_direction', values: { vertical: '.vertical', horizontal: '.horizontal', none: '.none' }},
};

const htmlTags = {
  div: 'Box', section: 'Box', article: 'Box', main: 'Box', aside: 'Box',
  header: 'Box', footer: 'Box', nav: 'Box', form: 'Box', fieldset: 'Box',
  ul: 'Box', ol: 'Box', li: 'Box', table: 'Box', tr: 'Box', td: 'Box',
  span: 'Text', p: 'Text', label: 'Text', h1: 'Text', h2: 'Text',
  h3: 'Text', h4: 'Text', h5: 'Text', h6: 'Text', strong: 'Text',
  button: 'Pressable', a: 'Pressable',
  input: 'TextInput', textarea: 'TextArea',
  img: 'Image',
};

const namedColors = {
  black: [0,0,0], white: [255,255,255], red: [255,0,0], green: [0,128,0],
  blue: [0,0,255], yellow: [255,255,0], cyan: [0,255,255], magenta: [255,0,255],
  gray: [128,128,128], grey: [128,128,128], silver: [192,192,192],
  orange: [255,165,0], transparent: [0,0,0],
};

// ── Token cursor ──

function mkCursor(raw, source) {
  const lines = raw.trim().split('\n');
  const count = lines.length;
  const kinds = new Array(count);
  const starts = new Array(count);
  const ends = new Array(count);
  for (let i = 0; i < count; i++) {
    const p = lines[i].split(' ');
    kinds[i] = parseInt(p[0]);
    starts[i] = parseInt(p[1]);
    ends[i] = parseInt(p[2]);
  }
  return {
    kinds, starts, ends, count, source, pos: 0,
    kind()    { return this.kinds[this.pos]; },
    text()    { return this.source.slice(this.starts[this.pos], this.ends[this.pos]); },
    advance() { if (this.pos < this.count) this.pos++; },
    isIdent(name) { return this.kind() === TK.identifier && this.text() === name; },
    save()    { return this.pos; },
    restore(p){ this.pos = p; },
  };
}

// ── Color parser ──

function parseColor(hex) {
  if (namedColors[hex]) {
    const [r,g,b] = namedColors[hex];
    return `Color.rgb(${r}, ${g}, ${b})`;
  }
  const h = hex.startsWith('#') ? hex.slice(1) : hex;
  if (h.length === 6) {
    const r = parseInt(h.slice(0,2), 16);
    const g = parseInt(h.slice(2,4), 16);
    const b = parseInt(h.slice(4,6), 16);
    return `Color.rgb(${r}, ${g}, ${b})`;
  }
  if (h.length === 3) {
    const r = parseInt(h[0], 16) * 17;
    const g = parseInt(h[1], 16) * 17;
    const b = parseInt(h[2], 16) * 17;
    return `Color.rgb(${r}, ${g}, ${b})`;
  }
  return 'Color.rgb(255, 255, 255)';
}

// ── Style parser ──

function parseStyleValue(c) {
  // String value: 'center', '#ff0000', '100%'
  if (c.kind() === TK.string) {
    const raw = c.text();
    const val = raw.slice(1, raw.length - 1); // strip quotes
    c.advance();
    return { type: 'string', value: val };
  }
  // Number value: 24, 16, 0.5
  if (c.kind() === TK.number) {
    const val = c.text();
    c.advance();
    return { type: 'number', value: val };
  }
  // Negative number: - 24
  if (c.kind() === TK.minus && c.pos + 1 < c.count && c.kinds[c.pos+1] === TK.number) {
    c.advance();
    const val = '-' + c.text();
    c.advance();
    return { type: 'number', value: val };
  }
  // Skip unknown
  c.advance();
  return { type: 'unknown', value: '' };
}

function parseStyleBlock(c) {
  const fields = [];
  // Consume opening {{ (style={{}})
  if (c.kind() === TK.lbrace) c.advance();
  if (c.kind() === TK.lbrace) c.advance();

  while (c.kind() !== TK.rbrace && c.kind() !== TK.eof) {
    if (c.kind() === TK.identifier || c.kind() === TK.string) {
      let key = c.text();
      if (c.kind() === TK.string) key = key.slice(1, key.length - 1);
      c.advance();
      if (c.kind() === TK.colon) c.advance();
      const val = parseStyleValue(c);

      // Map the key
      if (colorKeys[key] && val.type === 'string') {
        fields.push(`.${colorKeys[key]} = ${parseColor(val.value)}`);
      } else if (styleKeys[key]) {
        if (val.type === 'string' && val.value.endsWith('%')) {
          // Percentage: '100%' → -1 (sentinel for 100%)
          const pct = parseFloat(val.value);
          fields.push(`.${styleKeys[key]} = ${pct === 100 ? -1 : pct / 100}`);
        } else if (val.type === 'number') {
          fields.push(`.${styleKeys[key]} = ${val.value}`);
        } else if (val.type === 'string') {
          // Could be a named value or color
          fields.push(`.${styleKeys[key]} = ${val.value}`);
        }
      } else if (enumKeys[key]) {
        const e = enumKeys[key];
        if (val.type === 'string' && e.values[val.value]) {
          fields.push(`.${e.field} = ${e.values[val.value]}`);
        }
      }
      // Skip comma
      if (c.kind() === TK.comma) c.advance();
    } else {
      c.advance();
    }
  }
  // Consume closing }}
  if (c.kind() === TK.rbrace) c.advance();
  if (c.kind() === TK.rbrace) c.advance();
  return fields;
}

// ── JSX parser ──

let arrayCounter = 0;
let arrayDecls = [];

function resolveTag(name) {
  return htmlTags[name] || name;
}

function parseJSXElement(c) {
  if (c.kind() !== TK.lt) return '.{}';
  c.advance(); // consume <

  // Fragment: <>
  if (c.kind() === TK.gt) {
    c.advance();
    const children = parseChildren(c);
    // Consume </>
    if (c.kind() === TK.lt_slash) { c.advance(); if (c.kind() === TK.gt) c.advance(); }
    return buildNode('Box', [], children, null);
  }

  const rawTag = c.text();
  const tag = resolveTag(rawTag);
  c.advance(); // consume tag name

  // Parse attributes
  let styleFields = [];
  let textContent = null;
  let onPress = null;

  while (c.kind() !== TK.gt && c.kind() !== TK.slash_gt && c.kind() !== TK.eof) {
    if (c.kind() === TK.identifier) {
      const attr = c.text();
      c.advance();
      if (c.kind() === TK.equals) {
        c.advance();
        if (attr === 'style') {
          styleFields = parseStyleBlock(c);
        } else if (attr === 'onPress') {
          // Skip handler for now
          if (c.kind() === TK.lbrace) {
            let depth = 1; c.advance();
            while (depth > 0 && c.kind() !== TK.eof) {
              if (c.kind() === TK.lbrace) depth++;
              if (c.kind() === TK.rbrace) depth--;
              if (depth > 0) c.advance();
            }
            if (c.kind() === TK.rbrace) c.advance();
          }
        } else {
          // Skip other attributes
          if (c.kind() === TK.string) c.advance();
          else if (c.kind() === TK.lbrace) {
            let depth = 1; c.advance();
            while (depth > 0 && c.kind() !== TK.eof) {
              if (c.kind() === TK.lbrace) depth++;
              if (c.kind() === TK.rbrace) depth--;
              if (depth > 0) c.advance();
            }
            if (c.kind() === TK.rbrace) c.advance();
          }
        }
      }
    } else {
      c.advance();
    }
  }

  // Self-closing: />
  if (c.kind() === TK.slash_gt) {
    c.advance();
    return buildNode(tag, styleFields, [], textContent);
  }

  // Opening tag closed: >
  if (c.kind() === TK.gt) c.advance();

  // Parse children
  const children = parseChildren(c);

  // Consume closing tag: </Tag>
  if (c.kind() === TK.lt_slash) {
    c.advance();
    if (c.kind() === TK.identifier) c.advance(); // tag name
    if (c.kind() === TK.gt) c.advance();
  }

  return buildNode(tag, styleFields, children, textContent);
}

function parseChildren(c) {
  const children = [];
  while (c.kind() !== TK.lt_slash && c.kind() !== TK.eof) {
    if (c.kind() === TK.lt) {
      children.push(parseJSXElement(c));
    } else if (c.kind() === TK.identifier || c.kind() === TK.string || c.kind() === TK.number) {
      // Text content — collect consecutive text tokens
      let text = '';
      while (c.kind() !== TK.lt && c.kind() !== TK.lt_slash && c.kind() !== TK.lbrace && c.kind() !== TK.eof) {
        text += c.text();
        c.advance();
        if (c.kind() === TK.identifier || c.kind() === TK.number) text += ' ';
      }
      if (text.trim()) {
        children.push({ nodeExpr: `.{ .text = "${text.trim()}" }` });
      }
    } else if (c.kind() === TK.lbrace) {
      // {expression} — skip for now
      let depth = 1; c.advance();
      while (depth > 0 && c.kind() !== TK.eof) {
        if (c.kind() === TK.lbrace) depth++;
        if (c.kind() === TK.rbrace) depth--;
        if (depth > 0) c.advance();
      }
      if (c.kind() === TK.rbrace) c.advance();
    } else {
      c.advance();
    }
  }
  return children;
}

function buildNode(tag, styleFields, children, textContent) {
  const parts = [];

  // Style
  if (styleFields.length > 0) {
    parts.push(`.style = .{ ${styleFields.join(', ')} }`);
  }

  // Text content (from children that are just text)
  if (children.length === 1 && children[0].nodeExpr && children[0].nodeExpr.includes('.text =')) {
    // Single text child — hoist to parent .text field
    const textMatch = children[0].nodeExpr.match(/\.text = "(.*)"/);
    if (textMatch && (tag === 'Text' || tag === 'Pressable')) {
      parts.push(`.text = "${textMatch[1]}"`);
      children = [];
    }
  }

  // Children array
  if (children.length > 0) {
    const arrName = `_arr_${arrayCounter}`;
    arrayCounter++;
    const childExprs = children.map(ch => ch.nodeExpr || ch).join(', ');
    arrayDecls.push(`var ${arrName} = [_]Node{ ${childExprs} };`);
    parts.push(`.children = &${arrName}`);
  }

  const expr = `.{ ${parts.join(', ')} }`;
  return { nodeExpr: expr, isRoot: false };
}

// ── Main compile function ──

function compile() {
  const source = globalThis.__source;
  const tokens = globalThis.__tokens;
  const file = globalThis.__file || 'unknown.tsz';
  const c = mkCursor(tokens, source);

  // Reset state
  arrayCounter = 0;
  arrayDecls = [];

  // Find function App() — scan for 'function' 'App' '('
  let appStart = -1;
  for (let i = 0; i < c.count - 2; i++) {
    if (c.kinds[i] === TK.identifier && source.slice(c.starts[i], c.ends[i]) === 'function' &&
        c.kinds[i+1] === TK.identifier && c.kinds[i+2] === TK.lparen) {
      const name = source.slice(c.starts[i+1], c.ends[i+1]);
      if (name[0] >= 'A' && name[0] <= 'Z') {
        appStart = i;
      }
    }
  }

  if (appStart < 0) {
    return '// Smith error: no App function found\n';
  }

  // Find return ( ... ) — scan for 'return' '(' '<'
  c.pos = appStart;
  while (c.pos < c.count) {
    if (c.kind() === TK.identifier && c.text() === 'return') {
      c.advance();
      if (c.kind() === TK.lparen) c.advance();
      break;
    }
    c.advance();
  }

  // Parse JSX
  const rootResult = parseJSXElement(c);
  const rootExpr = rootResult.nodeExpr || rootResult;

  // Get app name from filename
  const basename = file.split('/').pop();
  const appName = basename.replace(/\.tsz$/, '').replace(/\.app$/, '');

  // ── Emit ──
  let out = '';
  out += `//! Generated by Forge+Smith\n`;
  out += `//! Source: ${basename}\n\n`;
  out += `const std = @import("std");\n`;
  out += `const builtin = @import("builtin");\n`;
  out += `const build_options = @import("build_options");\n`;
  out += `const IS_LIB = if (@hasDecl(build_options, "is_lib")) build_options.is_lib else false;\n\n`;
  out += `const layout = @import("framework/layout.zig");\n`;
  out += `const Node = layout.Node;\nconst Style = layout.Style;\nconst Color = layout.Color;\n`;
  out += `const engine = if (IS_LIB) struct {} else if (builtin.os.tag == .emscripten) @import("framework/engine_web.zig") else @import("framework/engine.zig");\n\n`;

  // Node tree
  out += `// ── Generated node tree ─────────────────────────────────────────\n`;
  for (const decl of arrayDecls) {
    out += decl + '\n';
  }
  // rootExpr starts with ".{ " — Node needs no dot before the brace
  const nodeInit = rootExpr.startsWith('.') ? rootExpr.slice(1) : rootExpr;
  out += `var _root = Node${nodeInit};\n\n`;

  // Empty logic blocks
  out += `const JS_LOGIC =\n    \\\\\n;\nconst LUA_LOGIC =\n    \\\\\n;\n\n`;

  // Functions
  out += `fn _initState() void {}\nfn _updateDynamicTexts() void {}\n\n`;
  out += `fn _appInit() void {\n    _initState();\n}\n\n`;
  out += `fn _appTick(now: u32) void {\n    _ = now;\n}\n\n`;

  // Exports
  out += `export fn app_get_root() *Node { return &_root; }\n`;
  out += `export fn app_get_init() ?*const fn () void { return _appInit; }\n`;
  out += `export fn app_get_tick() ?*const fn (u32) void { return _appTick; }\n`;
  out += `export fn app_get_js_logic() [*]const u8 { return JS_LOGIC.ptr; }\n`;
  out += `export fn app_get_js_logic_len() usize { return JS_LOGIC.len; }\n`;
  out += `export fn app_get_lua_logic() [*]const u8 { return LUA_LOGIC.ptr; }\n`;
  out += `export fn app_get_lua_logic_len() usize { return LUA_LOGIC.len; }\n`;
  out += `export fn app_get_title() [*:0]const u8 { return "${appName}"; }\n`;
  out += `export fn app_state_count() usize { return 0; }\n\n`;

  // Main
  out += `pub fn main() !void {\n`;
  out += `    if (IS_LIB) return;\n`;
  out += `    try engine.run(.{\n`;
  out += `        .title = "${appName}",\n`;
  out += `        .root = &_root,\n`;
  out += `        .js_logic = JS_LOGIC,\n`;
  out += `        .lua_logic = LUA_LOGIC,\n`;
  out += `        .init = _appInit,\n`;
  out += `        .tick = _appTick,\n`;
  out += `    });\n`;
  out += `}\n`;

  return out;
}
