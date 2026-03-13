#!/usr/bin/env node
/**
 * tsz compiler — Phase 3 proof of concept
 *
 * Takes a .tsz file (TypeScript + JSX targeting Zig) and produces
 * a native binary via the ReactJIT Zig engine.
 *
 * Pipeline: .tsz → TypeScript parser → AST → Zig codegen → zig build → binary
 *
 * Usage:
 *   node compiler.mjs build input.tsz
 *   node compiler.mjs run input.tsz
 */

import ts from 'typescript';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// ── Color helper ────────────────────────────────────────────────────────────

function parseColor(value) {
  if (typeof value === 'string') {
    // Hex color: #RRGGBB or #RGB
    const hex = value.replace('#', '');
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `Color.rgb(${r}, ${g}, ${b})`;
    }
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return `Color.rgb(${r}, ${g}, ${b})`;
    }
  }
  return null;
}

// ── Style prop → Zig field mapping ──────────────────────────────────────────

const STYLE_MAP = {
  width: 'width',
  height: 'height',
  minWidth: 'min_width',
  maxWidth: 'max_width',
  minHeight: 'min_height',
  maxHeight: 'max_height',
  flexGrow: 'flex_grow',
  flexShrink: 'flex_shrink',
  flexBasis: 'flex_basis',
  gap: 'gap',
  padding: 'padding',
  paddingLeft: 'padding_left',
  paddingRight: 'padding_right',
  paddingTop: 'padding_top',
  paddingBottom: 'padding_bottom',
  margin: 'margin',
  marginLeft: 'margin_left',
  marginRight: 'margin_right',
  marginTop: 'margin_top',
  marginBottom: 'margin_bottom',
  borderRadius: 'border_radius',
};

const ENUM_MAP = {
  flexDirection: { field: 'flex_direction', values: { row: '.row', column: '.column' } },
  justifyContent: {
    field: 'justify_content',
    values: { start: '.start', center: '.center', end: '.end_', 'space-between': '.space_between', 'space-around': '.space_around', 'space-evenly': '.space_evenly' },
  },
  alignItems: {
    field: 'align_items',
    values: { start: '.start', center: '.center', end: '.end_', stretch: '.stretch' },
  },
  display: { field: 'display', values: { flex: '.flex', none: '.none' } },
};

// ── AST → Zig codegen ──────────────────────────────────────────────────────

class TszCompiler {
  constructor(sourceFile) {
    this.sf = sourceFile;
    this.nodeArrays = []; // collected var arrays for the generated main()
    this.arrayCounter = 0;
  }

  /** Compile a .tsz source file to a complete Zig source string. */
  compile() {
    // Find the default export or the last function that returns JSX
    let rootComponent = null;

    ts.forEachChild(this.sf, (node) => {
      if (ts.isFunctionDeclaration(node) && node.name) {
        rootComponent = node;
      }
    });

    if (!rootComponent) {
      throw new Error('No component function found in .tsz file');
    }

    // Find the return statement with JSX
    const returnStmt = this.findReturn(rootComponent.body);
    if (!returnStmt || !returnStmt.expression) {
      throw new Error('Component must return JSX');
    }

    // Generate the node tree from JSX
    const { zigExpr, arrays } = this.emitJSX(returnStmt.expression);

    // Build complete Zig source
    return this.buildZigSource(arrays, zigExpr);
  }

  findReturn(block) {
    if (!block) return null;
    for (const stmt of block.statements) {
      if (ts.isReturnStatement(stmt)) return stmt;
      // Check inside if/else blocks
      if (ts.isIfStatement(stmt)) {
        const r = this.findReturn(stmt.thenStatement);
        if (r) return r;
      }
    }
    return null;
  }

  /** Emit a JSX element as a Zig Node literal. Returns { zigExpr, arrays }. */
  emitJSX(node) {
    if (ts.isParenthesizedExpression(node)) {
      return this.emitJSX(node.expression);
    }

    if (ts.isJsxElement(node)) {
      return this.emitJSXElement(node.openingElement, node.children);
    }

    if (ts.isJsxSelfClosingElement(node)) {
      return this.emitJSXElement(node, []);
    }

    if (ts.isJsxFragment(node)) {
      // Fragment — emit children as an array
      return this.emitJSXChildren(node.children);
    }

    // String literal in JSX
    if (ts.isJsxText(node)) {
      const text = node.text.trim();
      if (!text) return null;
      return {
        zigExpr: `.{ .text = "${this.escapeZigString(text)}" }`,
        arrays: [],
      };
    }

    throw new Error(`Unsupported JSX node: ${ts.SyntaxKind[node.kind]}`);
  }

  emitJSXElement(opening, children) {
    const tagName = opening.tagName.getText(this.sf);
    const attrs = this.parseAttributes(opening.attributes);
    const arrays = [];

    // Build style struct
    let styleFields = [];
    if (attrs.style) {
      styleFields = this.emitStyleObject(attrs.style);
    }

    // Handle backgroundColor in style
    if (attrs.style?.backgroundColor) {
      const colorStr = this.extractStringLiteral(attrs.style.backgroundColor);
      if (colorStr) {
        const zigColor = parseColor(colorStr);
        if (zigColor) {
          styleFields.push(`.background_color = ${zigColor}`);
        }
      }
    }

    // Build node fields
    const fields = [];

    // Style
    if (styleFields.length > 0) {
      fields.push(`.style = .{ ${styleFields.join(', ')} }`);
    }

    // Text content — from children or text prop
    const textContent = this.extractTextContent(children);
    if (textContent) {
      fields.push(`.text = "${this.escapeZigString(textContent)}"`);
    }

    // fontSize prop
    if (attrs.fontSize !== undefined) {
      fields.push(`.font_size = ${this.evalNumeric(attrs.fontSize)}`);
    }

    // color prop → text_color
    if (attrs.color !== undefined) {
      const colorStr = this.extractStringLiteral(attrs.color);
      if (colorStr) {
        const zigColor = parseColor(colorStr);
        if (zigColor) {
          fields.push(`.text_color = ${zigColor}`);
        }
      }
    }

    // Children (non-text JSX children)
    const jsxChildren = this.getJSXChildren(children);
    if (jsxChildren.length > 0) {
      const childExprs = [];
      for (const child of jsxChildren) {
        const result = this.emitJSX(child);
        if (result) {
          childExprs.push(result.zigExpr);
          arrays.push(...result.arrays);
        }
      }

      if (childExprs.length > 0) {
        const arrName = `_arr_${this.arrayCounter++}`;
        arrays.push(`    var ${arrName} = [_]Node{ ${childExprs.join(', ')} };`);
        fields.push(`.children = &${arrName}`);
      }
    }

    return {
      zigExpr: `.{ ${fields.join(', ')} }`,
      arrays,
    };
  }

  parseAttributes(attrs) {
    const result = {};
    if (!attrs || !attrs.properties) return result;

    for (const prop of attrs.properties) {
      if (ts.isJsxAttribute(prop) && prop.name) {
        const name = prop.name.getText(this.sf);

        if (prop.initializer) {
          if (ts.isStringLiteral(prop.initializer)) {
            result[name] = prop.initializer;
          } else if (ts.isJsxExpression(prop.initializer) && prop.initializer.expression) {
            const expr = prop.initializer.expression;
            if (ts.isObjectLiteralExpression(expr) && name === 'style') {
              result.style = this.parseObjectLiteral(expr);
            } else {
              result[name] = expr;
            }
          }
        }
      }
    }
    return result;
  }

  parseObjectLiteral(node) {
    const obj = {};
    for (const prop of node.properties) {
      if (ts.isPropertyAssignment(prop)) {
        const key = prop.name.getText(this.sf);
        obj[key] = prop.initializer;
      }
    }
    return obj;
  }

  emitStyleObject(styleObj) {
    const fields = [];

    for (const [key, valueNode] of Object.entries(styleObj)) {
      if (key === 'backgroundColor') continue; // handled separately

      // Check enum mappings
      if (ENUM_MAP[key]) {
        const mapping = ENUM_MAP[key];
        const strVal = this.extractStringLiteral(valueNode);
        if (strVal && mapping.values[strVal]) {
          fields.push(`.${mapping.field} = ${mapping.values[strVal]}`);
        }
        continue;
      }

      // Check numeric style props
      if (STYLE_MAP[key]) {
        const num = this.evalNumeric(valueNode);
        if (num !== null) {
          fields.push(`.${STYLE_MAP[key]} = ${num}`);
        }
        continue;
      }
    }

    return fields;
  }

  evalNumeric(node) {
    if (ts.isNumericLiteral(node)) return parseFloat(node.text);
    if (ts.isStringLiteral(node)) return parseFloat(node.text) || null;
    // Expression: try to extract the text
    const text = node.getText ? node.getText(this.sf) : null;
    if (text && !isNaN(Number(text))) return Number(text);
    return null;
  }

  extractStringLiteral(node) {
    if (ts.isStringLiteral(node)) return node.text;
    if (ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (ts.isJsxExpression(node) && node.expression) {
      return this.extractStringLiteral(node.expression);
    }
    return null;
  }

  extractTextContent(children) {
    if (!children || children.length === 0) return null;
    const texts = [];
    for (const child of children) {
      if (ts.isJsxText(child)) {
        const t = child.text.trim();
        if (t) texts.push(t);
      } else if (ts.isJsxExpression(child) && child.expression) {
        if (ts.isStringLiteral(child.expression)) {
          texts.push(child.expression.text);
        } else if (ts.isTemplateExpression(child.expression)) {
          // Template literal — extract the static parts for now
          texts.push(child.expression.getText(this.sf));
        }
      }
    }
    return texts.length > 0 ? texts.join(' ') : null;
  }

  getJSXChildren(children) {
    if (!children) return [];
    return children.filter((c) => {
      if (ts.isJsxText(c) && !c.text.trim()) return false;
      if (ts.isJsxText(c)) return false; // text handled separately
      return true;
    });
  }

  escapeZigString(s) {
    return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  }

  buildZigSource(arrays, rootExpr) {
    return `//! Generated by tsz compiler — do not edit
//!
//! Source: ${path.basename(this.sf.fileName)}

const std = @import("std");
const c = @import("c.zig").imports;
const layout = @import("layout.zig");
const text_mod = @import("text.zig");
const Node = layout.Node;
const Style = layout.Style;
const Color = layout.Color;
const LayoutRect = layout.LayoutRect;
const TextEngine = text_mod.TextEngine;

var g_text_engine: ?*TextEngine = null;

fn measureCallback(t: []const u8, font_size: u16) layout.TextMetrics {
    if (g_text_engine) |te| {
        return te.measureText(t, font_size);
    }
    return .{};
}

const Painter = struct {
    renderer: *c.SDL_Renderer,
    text_engine: *TextEngine,

    pub fn clear(self: *Painter, color: Color) void {
        _ = c.SDL_SetRenderDrawColor(self.renderer, color.r, color.g, color.b, color.a);
        _ = c.SDL_RenderClear(self.renderer);
    }

    pub fn present(self: *Painter) void {
        c.SDL_RenderPresent(self.renderer);
    }

    pub fn paintTree(self: *Painter, node: *Node) void {
        if (node.style.display == .none) return;
        if (node.style.background_color) |col| {
            _ = c.SDL_SetRenderDrawColor(self.renderer, col.r, col.g, col.b, col.a);
            var r = c.SDL_Rect{
                .x = @intFromFloat(node.computed.x),
                .y = @intFromFloat(node.computed.y),
                .w = @intFromFloat(node.computed.w),
                .h = @intFromFloat(node.computed.h),
            };
            _ = c.SDL_RenderFillRect(self.renderer, &r);
        }
        if (node.text) |txt| {
            const pad_l = node.style.padLeft();
            const pad_t = node.style.padTop();
            const col = node.text_color orelse Color.rgb(255, 255, 255);
            self.text_engine.drawText(txt, node.computed.x + pad_l, node.computed.y + pad_t, node.font_size, col);
        }
        for (node.children) |*child| {
            self.paintTree(child);
        }
    }
};

pub fn main() !void {
    if (c.SDL_Init(c.SDL_INIT_VIDEO) != 0) return error.SDLInitFailed;
    defer c.SDL_Quit();

    const window = c.SDL_CreateWindow("tsz app", c.SDL_WINDOWPOS_CENTERED, c.SDL_WINDOWPOS_CENTERED, 800, 600, c.SDL_WINDOW_SHOWN | c.SDL_WINDOW_RESIZABLE) orelse return error.WindowCreateFailed;
    defer c.SDL_DestroyWindow(window);

    const renderer = c.SDL_CreateRenderer(window, -1, c.SDL_RENDERER_ACCELERATED | c.SDL_RENDERER_PRESENTVSYNC) orelse return error.RendererFailed;
    defer c.SDL_DestroyRenderer(renderer);
    _ = c.SDL_SetRenderDrawBlendMode(renderer, c.SDL_BLENDMODE_BLEND);

    var text_engine = TextEngine.init(renderer, "fonts/base/DejaVuSans-Regular.ttf") catch
        TextEngine.init(renderer, "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf") catch return error.FontNotFound;
    defer text_engine.deinit();

    g_text_engine = &text_engine;
    layout.setMeasureFn(measureCallback);
    var painter = Painter{ .renderer = renderer, .text_engine = &text_engine };

    // ── Generated node tree ─────────────────────────────────────────
${arrays.join('\n')}
    var root = Node{ ${rootExpr.slice(2)} ;

    var running = true;
    var win_w: f32 = 800;
    var win_h: f32 = 600;

    while (running) {
        var event: c.SDL_Event = undefined;
        while (c.SDL_PollEvent(&event) != 0) {
            switch (event.type) {
                c.SDL_QUIT => running = false,
                c.SDL_WINDOWEVENT => {
                    if (event.window.event == c.SDL_WINDOWEVENT_SIZE_CHANGED) {
                        win_w = @floatFromInt(event.window.data1);
                        win_h = @floatFromInt(event.window.data2);
                    }
                },
                c.SDL_KEYDOWN => { if (event.key.keysym.sym == c.SDLK_ESCAPE) running = false; },
                else => {},
            }
        }

        layout.layout(&root, 0, 0, win_w, win_h);
        painter.clear(Color.rgb(24, 24, 32));
        painter.paintTree(&root);
        painter.present();
    }
}
`;
  }
}

// ── CLI ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const command = args[0];
const inputFile = args[1];

if (!command || !inputFile) {
  console.log('Usage: tsz build <file.tsz>');
  console.log('       tsz run <file.tsz>');
  process.exit(1);
}

// Parse the .tsz file using TypeScript's parser
const source = fs.readFileSync(inputFile, 'utf-8');
const sf = ts.createSourceFile(inputFile, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

const compiler = new TszCompiler(sf);
const zigSource = compiler.compile();

// Write generated Zig to the engine directory
const engineDir = path.resolve(import.meta.dirname, '..');
const outPath = path.join(engineDir, 'generated_app.zig');
fs.writeFileSync(outPath, zigSource);

console.log(`[tsz] Compiled ${path.basename(inputFile)} → generated_app.zig`);

// Build with Zig
const repoRoot = path.resolve(engineDir, '../..');
try {
  execSync(`zig build engine-app 2>&1`, { cwd: repoRoot, stdio: 'pipe' });
  console.log(`[tsz] Built → zig-out/bin/tsz-app`);
} catch (e) {
  console.error(`[tsz] Build failed:\n${e.stdout?.toString() || e.stderr?.toString() || e.message}`);
  process.exit(1);
}

if (command === 'run') {
  console.log('[tsz] Running...\n');
  execSync(`./zig-out/bin/tsz-app`, { cwd: repoRoot, stdio: 'inherit' });
}
