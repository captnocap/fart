// .autotest DSL parser. Text in, AST out.
// See framework/autotest/FORMAT.md for the grammar.

'use strict';

function tokenizeArgs(line) {
  // Split a statement's arg portion respecting "double-quoted" strings
  // and the `->` binary operator used by `drag`.
  const out = [];
  let i = 0;
  const n = line.length;
  while (i < n) {
    const c = line[i];
    if (c === ' ' || c === '\t') { i++; continue; }
    if (c === '"') {
      let j = i + 1;
      let s = '';
      while (j < n && line[j] !== '"') {
        if (line[j] === '\\' && j + 1 < n) { s += line[j + 1]; j += 2; continue; }
        s += line[j++];
      }
      if (j >= n) throw new Error('unterminated string: ' + line);
      out.push({ kind: 'str', value: s });
      i = j + 1;
      continue;
    }
    if (c === '-' && line[i + 1] === '>') { out.push({ kind: 'op', value: '->' }); i += 2; continue; }
    if (c === '{' ) { out.push({ kind: 'brace', value: '{' }); i++; continue; }
    // bare token: identifier / number / keybinding / simple literal
    let j = i;
    while (j < n && line[j] !== ' ' && line[j] !== '\t' && line[j] !== '{') j++;
    const raw = line.slice(i, j);
    if (/^-?\d+(\.\d+)?$/.test(raw)) out.push({ kind: 'num', value: parseFloat(raw) });
    else out.push({ kind: 'bare', value: raw });
    i = j;
  }
  return out;
}

function parse(src) {
  const lines = src.split(/\r?\n/);
  const directives = {};
  const body = [];
  const stack = [body]; // stack of child arrays for nested blocks

  for (let lineNo = 0; lineNo < lines.length; lineNo++) {
    const raw = lines[lineNo];
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (trimmed.startsWith('@')) {
      const m = trimmed.match(/^@(\w+)\s*(.*)$/);
      if (!m) throw new Error(`line ${lineNo + 1}: bad directive: ${trimmed}`);
      const key = m[1];
      const rest = m[2].trim();
      const toks = tokenizeArgs(rest);
      directives[key] = toks.length === 1 ? toks[0].value : toks.map((t) => t.value);
      continue;
    }

    if (trimmed === 'end' || trimmed === '}') {
      if (stack.length <= 1) throw new Error(`line ${lineNo + 1}: stray '${trimmed}'`);
      stack.pop();
      continue;
    }

    const firstSpace = trimmed.search(/\s/);
    const verb = firstSpace < 0 ? trimmed : trimmed.slice(0, firstSpace);
    const restStr = firstSpace < 0 ? '' : trimmed.slice(firstSpace + 1);
    const toks = tokenizeArgs(restStr);

    const opensBlock = toks.length > 0 && toks[toks.length - 1].kind === 'brace';
    const argToks = opensBlock ? toks.slice(0, -1) : toks;
    const args = argToks.map((t) => t.value);

    const stmt = { kind: opensBlock ? 'block' : 'verb', verb, args, line: lineNo + 1 };
    if (opensBlock) stmt.body = [];
    stack[stack.length - 1].push(stmt);
    if (opensBlock) stack.push(stmt.body);
  }

  if (stack.length !== 1) throw new Error('missing end for open block');
  return { directives, body };
}

module.exports = { parse, tokenizeArgs };
