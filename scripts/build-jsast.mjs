#!/usr/bin/env node
/*
 * build-jsast — parse a JS file with acorn and emit its AST as a Lua table
 * literal. Output is data, not code. JSRT's evaluator loads this table and
 * walks it directly — no JS-to-Lua translation ever happens.
 *
 * Usage:
 *   node scripts/build-jsast.mjs <input.js> <output.lua>
 */
import { parse } from 'acorn';
import fs from 'fs';

// Source-location fields we drop from the emitted AST — they're noise for the
// evaluator and would bloat the Lua file. Also drop `raw` on Literals (we only
// use `value`).
const SKIP_KEYS = new Set(['start', 'end', 'loc', 'range', 'raw']);

const LUA_KEYWORDS = new Set([
  'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function',
  'goto', 'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return', 'then',
  'true', 'until', 'while',
]);

function luaString(s) {
  return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t') + '"';
}

function emit(value, indent) {
  const pad = '  '.repeat(indent);
  const inner = '  '.repeat(indent + 1);

  if (value === null || value === undefined) return 'nil';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('Cannot emit non-finite number: ' + value);
    }
    return String(value);
  }
  if (typeof value === 'bigint') {
    throw new Error('BigInt literal not supported in JSRT');
  }
  if (value instanceof RegExp) {
    return '{ __regex = true, source = ' + luaString(value.source) + ', flags = ' + luaString(value.flags) + ' }';
  }
  if (typeof value === 'string') return luaString(value);

  if (Array.isArray(value)) {
    if (value.length === 0) return '{}';
    const items = value.map((v) => inner + emit(v, indent + 1));
    return '{\n' + items.join(',\n') + '\n' + pad + '}';
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value).filter((k) => !SKIP_KEYS.has(k));
    if (keys.length === 0) return '{}';
    const pairs = keys.map((k) => {
      const valueEmit = emit(value[k], indent + 1);
      const keyEmit = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k) && !LUA_KEYWORDS.has(k)
        ? k
        : '[' + luaString(k) + ']';
      return inner + keyEmit + ' = ' + valueEmit;
    });
    return '{\n' + pairs.join(',\n') + '\n' + pad + '}';
  }

  throw new Error('Unhandled value type: ' + typeof value);
}

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error('Usage: node scripts/build-jsast.mjs <input.js> <output.lua>');
  process.exit(1);
}

const source = fs.readFileSync(inputPath, 'utf8');
const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
const lua = '-- AUTO-GENERATED from ' + inputPath + '. Do not edit.\n' +
            '-- Regenerate: node scripts/build-jsast.mjs ' + inputPath + ' ' + outputPath + '\n' +
            'return ' + emit(ast, 0) + '\n';
fs.writeFileSync(outputPath, lua);
