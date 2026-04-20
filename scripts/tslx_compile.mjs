#!/usr/bin/env node
/**
 * tslx_compile.mjs — primitive compiler for reactjit.
 *
 * Inspired by love2d/scripts/tslx_compile.mjs, adapted to reactjit's
 * stack (Zig host, React-in-QJS reconciler). Love2D compiled JSX to Lua
 * rendering commands because layout + paint live in Lua; reactjit's hot
 * path is Zig, so the compiler's job is different: take one declarative
 * primitive spec and generate all the framework wiring needed to expose
 * it as a native host type that React sees as ONE node.
 *
 * Input: `framework/primitives/<name>.tslx`
 * Output:
 *   - framework/primitives/generated/<name>.zig  (paint fn + row struct)
 *   - runtime/primitives_gen/<name>.tsx          (React wrapper)
 *   - stdout: snippets to splice into layout.zig / qjs_app.zig
 *
 * The user writes the paint body in Zig directly (it IS performance-
 * critical and needs all of Zig's tools) — the compiler just handles
 * the mechanical surrounding wiring. This matches what we learned
 * from hand-writing CodeGutter/Minimap: the creative part is the
 * paint function, everything else is glue that benefits from codegen.
 *
 * Usage:
 *   node scripts/tslx_compile.mjs framework/primitives/code_gutter.tslx
 *   node scripts/tslx_compile.mjs --all   # compile every .tslx in framework/primitives
 *
 * Spec grammar (indent-sensitive, `end` closes blocks):
 *
 *   primitive <Name>
 *     guard_field: <snake_name>         # the Node field that tells paint
 *                                       # this primitive is active (usually
 *                                       # the rows slice pointer)
 *
 *     row_type <ZigTypeName>            # optional — defines the struct
 *       <field>: <zig_type> = <default>   each row carries
 *       ...
 *     end
 *
 *     fields                            # Node struct fields (all at once)
 *       <name>: <zig_type> = <default>
 *       ...
 *     end
 *
 *     props                             # JS prop name → Zig setter
 *       <jsName>: <parser>(v) -> <field>
 *       ...
 *     end
 *
 *     intrinsic_height: <zig-expr>      # used by layout to compute h
 *                                       # when the cart doesn't specify one
 *                                       # — `gr` is the bound rows slice
 *
 *     paint                             # Zig body of the paint function.
 *       <zig code>                        `node` is *Node. The compiler
 *       ...                               wraps this in the signature +
 *     end                                 stdlib imports.
 *
 *   end
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');

// ── Tiny indent-block parser ────────────────────────────────────

function parseTslx(src, filename) {
  const lines = src.split('\n');
  const spec = { fields: [], props: [], row_type: null };
  let i = 0;

  function err(msg) {
    throw new Error(`${filename}:${i + 1}: ${msg}`);
  }

  // Skip blank + leading whitespace; find `primitive <Name>`
  while (i < lines.length && !lines[i].trim()) i++;
  const primMatch = lines[i]?.match(/^primitive\s+(\w+)\s*$/);
  if (!primMatch) err(`expected 'primitive <Name>' as first non-blank line, got: ${lines[i]}`);
  spec.name = primMatch[1];
  i++;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) { i++; continue; }
    if (trimmed === 'end') { i++; break; }

    // Single-line directives: `key: value`
    const kv = trimmed.match(/^(\w+)\s*:\s*(.+)$/);
    if (kv && !['props', 'fields', 'paint', 'row_type'].includes(kv[1])) {
      spec[kv[1]] = kv[2].trim();
      i++;
      continue;
    }

    // Block: `row_type <Name>` — followed by fields, ended by `end`
    const rtMatch = trimmed.match(/^row_type\s+(\w+)\s*$/);
    if (rtMatch) {
      spec.row_type = { name: rtMatch[1], fields: [] };
      i++;
      while (i < lines.length && lines[i].trim() !== 'end') {
        const t = lines[i].trim();
        if (t) {
          const fm = t.match(/^(\w+)\s*:\s*([^=]+?)(?:\s*=\s*(.+))?$/);
          if (!fm) err(`bad row_type field: ${t}`);
          spec.row_type.fields.push({
            name: fm[1].trim(),
            type: fm[2].trim(),
            default: fm[3]?.trim() ?? null,
          });
        }
        i++;
      }
      i++; // skip end
      continue;
    }

    // Block: `fields` — lines of `name: type = default`
    if (trimmed === 'fields') {
      i++;
      while (i < lines.length && lines[i].trim() !== 'end') {
        const t = lines[i].trim();
        if (t) {
          const fm = t.match(/^(\w+)\s*:\s*([^=]+?)(?:\s*=\s*(.+))?$/);
          if (!fm) err(`bad field: ${t}`);
          spec.fields.push({
            name: fm[1].trim(),
            type: fm[2].trim(),
            default: fm[3]?.trim() ?? null,
          });
        }
        i++;
      }
      i++;
      continue;
    }

    // Block: `props` — lines of `jsName: parser(v) -> field`
    if (trimmed === 'props') {
      i++;
      while (i < lines.length && lines[i].trim() !== 'end') {
        const t = lines[i].trim();
        if (t) {
          const pm = t.match(/^(\w+)\s*:\s*(.+?)\s*->\s*(\w+)\s*$/);
          if (!pm) err(`bad prop: ${t}  (expected 'jsName: parser_expr -> zig_field')`);
          spec.props.push({
            js_name: pm[1],
            parser: pm[2].trim(),
            field: pm[3],
          });
        }
        i++;
      }
      i++;
      continue;
    }

    // Block: `paint` — verbatim Zig body, closed by a line that is exactly `end`
    if (trimmed === 'paint') {
      const body = [];
      i++;
      while (i < lines.length && lines[i].trim() !== 'end') {
        body.push(lines[i]);
        i++;
      }
      spec.paint = body.join('\n');
      i++;
      continue;
    }

    err(`unexpected line: ${trimmed}`);
  }

  if (!spec.name) err('missing primitive name');
  if (!spec.guard_field) err('missing guard_field');
  if (!spec.paint) err('missing paint block');
  return spec;
}

// ── Emitters ────────────────────────────────────────────────────

function emitRowStruct(spec) {
  if (!spec.row_type) return '';
  const { name, fields } = spec.row_type;
  const lines = fields.map((f) => {
    const d = f.default == null ? '' : ` = ${f.default}`;
    return `    ${f.name}: ${f.type}${d},`;
  });
  return `pub const ${name} = struct {\n${lines.join('\n')}\n};\n`;
}

function emitPaintFile(spec, pastePath) {
  const paintFnName = `paint${spec.name}`;
  const header = `//! Generated by scripts/tslx_compile.mjs from ${pastePath}.
//! Do NOT edit by hand — edit the .tslx source and recompile.
//!
//! Primitive: ${spec.name}
//! Guard field: node.${spec.guard_field}

const std = @import("std");
const layout = @import("../../layout.zig");
const gpu = @import("../../gpu/gpu.zig");
const Node = layout.Node;
const Color = layout.Color;
`;

  const rowStruct = emitRowStruct(spec);

  const fnSig = `/// Paint ${spec.name}. Caller has already verified node.${spec.guard_field} is active.
pub fn ${paintFnName}(node: *Node, g_paint_opacity: f32) void {`;

  const body = spec.paint.replace(/^\n+|\n+$/g, '');

  return `${header}\n${rowStruct}\n${fnSig}\n${body}\n}\n`;
}

function emitTsxWrapper(spec) {
  const propLines = spec.props.map((p) => ` *   ${p.js_name}`).join('\n');
  return `/**
 * ${spec.name} — generated by scripts/tslx_compile.mjs.
 *
 * Bulk-rendering primitive: one React host node that the framework
 * paints natively in Zig from data-in props. Do NOT pass children.
 *
 * Props:
${propLines}
 */
const React: any = require('react');
export const ${spec.name}: any = (props: any) => React.createElement('${spec.name}', props);
`;
}

function emitZigSnippets(spec) {
  // Node struct fields block (to paste into layout.zig)
  const nodeFieldsBlock = spec.fields.map((f) => {
    const d = f.default == null ? '' : ` = ${f.default}`;
    return `    ${f.name}: ${f.type}${d},`;
  }).join('\n');

  // applyTypeDefaults branch (to paste into qjs_app.zig)
  const typeDefault = `    } else if (eq(u8, type_name, "${spec.name}")) {
        ${spec.type_default_init ?? `node.${spec.guard_field} = &[_]layout.${spec.row_type?.name ?? 'u8'}{};`}`;

  // applyProps branches (to paste into qjs_app.zig)
  const propsBranches = spec.props.map((p) => {
    return `        } else if (node.${spec.guard_field} != null and std.mem.eql(u8, k, "${p.js_name}")) {
            ${expandParserExpr(p.parser, p.field)}`;
  }).join('\n');

  // Intrinsic-height snippet (to paste into estimateIntrinsicHeight + main layout fallback)
  const ih = spec.intrinsic_height
    ? `    if (node.${spec.guard_field}) |gr| {
        return ${spec.intrinsic_height} + pt + pb;
    }`
    : '    // (no intrinsic_height declared — layout uses 0 unless style sets height)';

  return { nodeFieldsBlock, typeDefault, propsBranches, ih };
}

/**
 * Expand a prop parser expression like `parseGutterRows(v)` or `jsonFloat`
 * into a Zig statement that writes to `node.<field>`. Rules:
 *   - `parseFoo(v)`       → `node.<field> = parseFoo(v);`
 *   - `jsonFloat`         → `if (jsonFloat(v)) |f| node.<field> = f;`
 *   - `jsonInt`           → `if (jsonInt(v)) |i| node.<field> = @intCast(@max(0, i));`
 *   - `jsonBool`          → `if (jsonBool(v)) |b| node.<field> = b;`
 *   - `parseColor`        → `if (v == .string) node.<field> = parseColor(v.string);`
 *   - `dupJsonText`       → `if (dupJsonText(v)) |s| node.<field> = s;`
 *   - literal Zig body    → emitted verbatim (use `{field}` placeholder)
 */
function expandParserExpr(expr, field) {
  const e = expr.trim();
  if (e === 'jsonFloat') return `if (jsonFloat(v)) |f| node.${field} = f;`;
  if (e === 'jsonInt') return `if (jsonInt(v)) |i| node.${field} = @intCast(@max(0, i));`;
  if (e === 'jsonBool') return `if (jsonBool(v)) |b| node.${field} = b;`;
  if (e === 'parseColor') return `if (v == .string) node.${field} = parseColor(v.string);`;
  if (e === 'dupJsonText') return `if (dupJsonText(v)) |s| node.${field} = s;`;
  // parser(v) form — assume the parser returns the value directly
  const callMatch = e.match(/^(\w+)\((v)\)$/);
  if (callMatch) return `node.${field} = ${callMatch[1]}(v);`;
  // Verbatim with {field} placeholder
  return e.replace(/\{field\}/g, `node.${field}`);
}

// ── Driver ─────────────────────────────────────────────────────

function compileOne(srcPath) {
  const relSrc = path.relative(REPO, srcPath);
  const src = fs.readFileSync(srcPath, 'utf-8');
  const spec = parseTslx(src, relSrc);

  // Generated Zig paint module
  const paintZig = emitPaintFile(spec, relSrc);
  const paintOutDir = path.resolve(REPO, 'framework/primitives/generated');
  fs.mkdirSync(paintOutDir, { recursive: true });
  const paintOutPath = path.join(paintOutDir, toSnake(spec.name) + '.zig');
  fs.writeFileSync(paintOutPath, paintZig);

  // TSX wrapper
  const wrapperOutDir = path.resolve(REPO, 'runtime/primitives_gen');
  fs.mkdirSync(wrapperOutDir, { recursive: true });
  const wrapperPath = path.join(wrapperOutDir, spec.name + '.tsx');
  fs.writeFileSync(wrapperPath, emitTsxWrapper(spec));

  // Snippets for manual paste (future: auto-splice)
  const snippets = emitZigSnippets(spec);

  console.log(`== compiled ${spec.name} ==`);
  console.log(`  wrote: ${path.relative(REPO, paintOutPath)}`);
  console.log(`  wrote: ${path.relative(REPO, wrapperPath)}`);
  console.log();
  console.log(`// ── paste into framework/layout.zig Node struct ──`);
  console.log(snippets.nodeFieldsBlock);
  console.log();
  console.log(`// ── paste into framework/layout.zig estimateIntrinsicHeight + h-fallback ──`);
  console.log(snippets.ih);
  console.log();
  console.log(`// ── paste into qjs_app.zig applyTypeDefaults ──`);
  console.log(snippets.typeDefault);
  console.log();
  console.log(`// ── paste into qjs_app.zig applyProps (after existing primitive blocks) ──`);
  console.log(`        // ── ${spec.name} primitive props ──`);
  console.log(snippets.propsBranches);
  console.log();
  console.log(`// ── also: @import("primitives/generated/${toSnake(spec.name)}.zig").paint${spec.name}(node, g_paint_opacity);`);
  console.log(`// ── from paintNodeVisuals in framework/engine.zig (guarded by node.${spec.guard_field} != null).`);
}

function toSnake(s) {
  return s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

// ── Entry ───────────────────────────────────────────────────────

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('usage: node scripts/tslx_compile.mjs <path.tslx> | --all');
  process.exit(1);
}

let paths = [];
if (args[0] === '--all') {
  const dir = path.resolve(REPO, 'framework/primitives');
  if (fs.existsSync(dir)) {
    for (const name of fs.readdirSync(dir)) {
      if (name.endsWith('.tslx')) paths.push(path.join(dir, name));
    }
  }
} else {
  paths = args.map((a) => path.resolve(a));
}

if (paths.length === 0) {
  console.error('no .tslx files found');
  process.exit(1);
}

for (const p of paths) compileOne(p);
