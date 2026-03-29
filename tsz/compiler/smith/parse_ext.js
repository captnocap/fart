// ── Extended parsers (maps, conditionals, templates, children) ──
// Split from parse.js — these are called by parseJSXElement/parseChildren.
// All functions are globally scoped via forge's JS concatenation.

// ── OA inference fallback (Love2D-style robustness) ──
// If collectState missed an array, re-scan source to find and register it.
function inferOaFromSource(c, name) {
  const saved = c.save();
  c.pos = 0;
  const setter = 'set' + name[0].toUpperCase() + name.slice(1);
  while (c.pos < c.count) {
    if (c.kind() === TK.identifier && c.text() === name) {
      c.advance();
      // Scan forward (max 20 tokens) looking for [{
      let limit = 20;
      while (limit-- > 0 && c.pos < c.count) {
        if (c.kind() === TK.lbracket) {
          c.advance();
          if (c.kind() === TK.lbrace) {
            c.advance(); // skip {
            const fields = [];
            while (c.kind() !== TK.rbrace && c.kind() !== TK.eof) {
              if (c.kind() === TK.identifier) {
                const fname = c.text(); c.advance();
                if (c.kind() === TK.colon) c.advance();
                let ftype = 'int';
                if (c.kind() === TK.string) { ftype = 'string'; c.advance(); }
                else if (c.kind() === TK.number) {
                  const nv = c.text();
                  ftype = nv.startsWith('0x') ? 'int' : (nv.includes('.') ? 'float' : 'int');
                  c.advance();
                }
                else if (c.isIdent('true') || c.isIdent('false')) { ftype = 'boolean'; c.advance(); }
                fields.push({ name: fname, type: ftype });
              }
              if (c.kind() === TK.comma) c.advance();
              else if (c.kind() !== TK.rbrace) c.advance();
            }
            if (fields.length > 0) {
              const oaIdx = ctx.objectArrays.length;
              const oa = { fields, getter: name, setter, oaIdx };
              ctx.objectArrays.push(oa);
              c.restore(saved);
              return oa;
            }
          }
          break;
        }
        c.advance();
      }
    }
    c.advance();
  }
  c.restore(saved);
  return null;
}

// ── Map parser ──

function tryParseMap(c, oa) {
  const saved = c.save();
  c.advance(); // skip array name
  if (c.kind() !== TK.dot) { c.restore(saved); return null; }
  c.advance(); // skip .
  if (!c.isIdent('map')) { c.restore(saved); return null; }
  c.advance(); // skip 'map'
  if (c.kind() !== TK.lparen) { c.restore(saved); return null; }
  c.advance(); // skip (

  // Parse params: (item, i) => or (item) =>
  if (c.kind() !== TK.lparen) { c.restore(saved); return null; }
  c.advance(); // skip (
  let itemParam = '_item';
  let indexParam = '_i';
  if (c.kind() === TK.identifier) { itemParam = c.text(); c.advance(); }
  if (c.kind() === TK.comma) { c.advance(); if (c.kind() === TK.identifier) { indexParam = c.text(); c.advance(); } }
  if (c.kind() === TK.rparen) c.advance(); // skip )
  if (c.kind() === TK.arrow) c.advance(); // skip =>
  if (c.kind() === TK.lparen) c.advance(); // skip ( before JSX

  // Push map item context — so {item.label} resolves to _oa0_label[_i]
  const savedMapCtx = ctx.currentMap;
  // Reserve slot BEFORE parsing template so nested maps pushed during template
  // get higher indices, keeping this map's index stable.
  const mapIdx = ctx.maps.length;
  const isInline = !!(savedMapCtx && savedMapCtx.oaIdx !== oa.oaIdx);
  const mapInfo = {
    oaIdx: oa.oaIdx, itemParam, indexParam,
    oa, textsInMap: [], innerCount: 0, parentArr: '', childIdx: 0,
    mapArrayDecls: [], mapArrayComments: [],
    parentMap: savedMapCtx,  // track parent map for nested context
    isInline,  // separate-OA map inside another map's template (love2d: inline loop)
  };
  ctx.maps.push(mapInfo); // reserve slot early
  ctx.currentMap = mapInfo;

  // Save array state — arrays created during map template go to mapArrayDecls
  // But save top-level refs so component inlining can restore to them
  const savedArrayDecls = ctx.arrayDecls;
  const savedArrayComments = ctx.arrayComments;
  mapInfo._topArrayDecls = savedArrayDecls;
  mapInfo._topArrayComments = savedArrayComments;
  ctx.arrayDecls = mapInfo.mapArrayDecls;
  ctx.arrayComments = mapInfo.mapArrayComments;
  // DO NOT save/restore arrayCounter — each map gets unique array IDs

  // Parse the map template JSX
  const templateNode = parseJSXElement(c);

  // Restore array target — but counter keeps advancing (no overlaps)
  ctx.arrayDecls = savedArrayDecls;
  ctx.arrayComments = savedArrayComments;

  ctx.currentMap = savedMapCtx;

  // Skip closing ))}
  if (c.kind() === TK.rparen) c.advance(); // )
  if (c.kind() === TK.rparen) c.advance(); // )

  // Finalize map info (slot was reserved early)
  mapInfo.templateExpr = templateNode.nodeExpr;

  // Return a placeholder node — the parent array slot that gets .children set by _rebuildMap
  // Map placeholder — gets .children set by _rebuildMap at runtime
  return { nodeExpr: `.{}`, mapIdx };
}

// Nested map: cursor is on field name (e.g. "items" in group.items.map(...))
function tryParseNestedMap(c, nestedOa, fieldName) {
  const saved = c.save();
  c.advance(); // skip field name
  if (c.kind() !== TK.dot) { c.restore(saved); return null; }
  c.advance(); // skip .
  if (!c.isIdent('map')) { c.restore(saved); return null; }
  c.advance(); // skip 'map'
  if (c.kind() !== TK.lparen) { c.restore(saved); return null; }
  c.advance(); // skip (

  // Parse params: (item, i) => or (item) =>
  if (c.kind() !== TK.lparen) { c.restore(saved); return null; }
  c.advance(); // skip (
  let itemParam = '_item';
  let indexParam = '_j'; // nested uses _j
  if (c.kind() === TK.identifier) { itemParam = c.text(); c.advance(); }
  if (c.kind() === TK.comma) { c.advance(); if (c.kind() === TK.identifier) { indexParam = c.text(); c.advance(); } }
  if (c.kind() === TK.rparen) c.advance(); // skip )
  if (c.kind() === TK.arrow) c.advance(); // skip =>
  if (c.kind() === TK.lparen) c.advance(); // skip ( before JSX

  // Push nested map context
  const savedMapCtx = ctx.currentMap;
  const mapIdx = ctx.maps.length;
  const mapInfo = {
    oaIdx: nestedOa.oaIdx, itemParam, indexParam,
    oa: nestedOa, textsInMap: [], innerCount: 0, parentArr: '', childIdx: 0,
    mapArrayDecls: [], mapArrayComments: [],
    isNested: true, parentMapIdx: savedMapCtx ? ctx.maps.indexOf(savedMapCtx) : -1,
    parentOaIdx: savedMapCtx ? savedMapCtx.oaIdx : -1,
    nestedField: fieldName,
    iterVar: '_j',
    parentMap: savedMapCtx,
  };
  ctx.maps.push(mapInfo); // reserve slot early
  ctx.currentMap = mapInfo;

  // Save array state
  const savedArrayDecls = ctx.arrayDecls;
  const savedArrayComments = ctx.arrayComments;
  mapInfo._topArrayDecls = savedArrayDecls;
  mapInfo._topArrayComments = savedArrayComments;
  ctx.arrayDecls = mapInfo.mapArrayDecls;
  ctx.arrayComments = mapInfo.mapArrayComments;

  // Parse the map template JSX
  const templateNode = parseJSXElement(c);

  // Restore
  ctx.arrayDecls = savedArrayDecls;
  ctx.arrayComments = savedArrayComments;
  ctx.currentMap = savedMapCtx;

  // Skip closing ))}
  if (c.kind() === TK.rparen) c.advance();
  if (c.kind() === TK.rparen) c.advance();

  // Finalize (slot was reserved early)
  mapInfo.templateExpr = templateNode.nodeExpr;

  return { nodeExpr: `.{}`, mapIdx };
}

// Check if an identifier is a map item member access (item.field)
function isMapItemAccess(name) {
  if (!ctx.currentMap) return null;
  if (name === ctx.currentMap.itemParam) return ctx.currentMap;
  return null;
}

// ── Template literal parser ──

// Left-fold arithmetic: "A+B+C+D" → "(((A + B) + C) + D)"
function leftFoldExpr(expr) {
  const parts = [];
  let depth = 0, cur = '';
  for (let i = 0; i < expr.length; i++) {
    if (expr[i] === '(') depth++;
    else if (expr[i] === ')') depth--;
    else if (expr[i] === '+' && depth === 0) { parts.push(cur.trim()); cur = ''; continue; }
    cur += expr[i];
  }
  parts.push(cur.trim());
  if (parts.length <= 1) return expr;
  let result = parts[0];
  for (let i = 1; i < parts.length; i++) result = `(${result} + ${parts[i]})`;
  return result;
}

// UTF-8 byte length of a JS string
function utf8ByteLen(str) {
  let n = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 0x80) n++;
    else if (c < 0x800) n += 2;
    else if (c >= 0xD800 && c <= 0xDBFF) { n += 4; i++; }
    else n += 3;
  }
  return n;
}

function parseTemplateLiteral(raw) {
  // Split "text ${expr} more ${expr2}" into fmt string + args
  let fmt = '';
  const args = [];
  let i = 0;
  while (i < raw.length) {
    if (raw[i] === '$' && i + 1 < raw.length && raw[i + 1] === '{') {
      // Find matching }
      let j = i + 2;
      let depth = 1;
      while (j < raw.length && depth > 0) {
        if (raw[j] === '{') depth++;
        if (raw[j] === '}') depth--;
        j++;
      }
      const expr = raw.slice(i + 2, j - 1).trim();
      // Determine format specifier based on expression type
      const slotIdx = findSlot(expr);
      if (slotIdx >= 0) {
        const slot = ctx.stateSlots[slotIdx];
        fmt += slot.type === 'string' ? '{s}' : '{d}';
        args.push(slotGet(expr));
      } else if (/^(\w+)\s*([+\-*\/])\s*(.+)$/.test(expr)) {
        // Arithmetic expression: getter + N, getter - 1, etc.
        const m = expr.match(/^(\w+)\s*([+\-*\/])\s*(.+)$/);
        const lhsSlot = findSlot(m[1]);
        if (lhsSlot >= 0) {
          const rhsSlot = findSlot(m[3].trim());
          const rhsVal = rhsSlot >= 0 ? slotGet(m[3].trim()) : m[3].trim();
          fmt += '{d}';
          args.push(`${slotGet(m[1])} ${m[2]} ${rhsVal}`);
        } else if (ctx.currentMap && m[1] === ctx.currentMap.indexParam) {
          // Map index param in arithmetic: ${i + 1}, ${i - 1}, etc.
          fmt += '{d}';
          args.push(`@as(i64, @intCast(_i)) ${m[2]} ${m[3].trim()}`);
        } else {
          fmt += expr;
        }
      } else if (ctx.renderLocals && ctx.renderLocals[expr] !== undefined) {
        // Render-local variable substitution in template literal
        const rlVal = ctx.renderLocals[expr];
        const isNum = /^-?\d+(\.\d+)?$/.test(rlVal);
        const isZigExpr = rlVal.includes('state.get') || rlVal.includes('getSlot') || rlVal.includes('_oa') || rlVal.includes('@as');
        if (isNum) { fmt += '{d}'; args.push(rlVal); }
        else if (isZigExpr) { fmt += '{d}'; args.push(leftFoldExpr(rlVal)); }
        else { fmt += rlVal; }
      } else if (ctx.propStack[expr] !== undefined) {
        // Prop substitution — use the concrete prop value
        const propVal = ctx.propStack[expr];
        const isNum = /^-?\d+(\.\d+)?$/.test(propVal);
        const isZigExpr = propVal.includes('state.get') || propVal.includes('getSlot') || propVal.includes('_oa') || propVal.includes('@as');
        const isStringArray = isZigExpr && propVal.includes('[') && propVal.includes('..');
        if (isNum) {
          fmt += '{d}'; args.push(propVal);
        } else if (isStringArray) {
          // String array slice: _oaN_field[_i][0.._oaN_field_lens[_i]]
          fmt += '{s}'; args.push(propVal);
        } else if (isZigExpr) {
          // Other Zig expressions (OA integer fields, state getters)
          fmt += '{d}'; args.push(leftFoldExpr(propVal));
        } else {
          // Plain string literal
          fmt += '{s}'; args.push(`"${propVal}"`);
        }
      } else if (ctx.currentMap && expr === ctx.currentMap.indexParam) {
        // Map index parameter: ${idx} → {d} with @as(i64, @intCast(_i))
        fmt += '{d}';
        args.push('@as(i64, @intCast(_i))');
      } else if (ctx.currentMap && ctx.currentMap.parentMap && expr === ctx.currentMap.parentMap.indexParam) {
        // Parent map index parameter: ${parent_idx} → {d} with outer loop index
        // For nested maps, outer loop uses _i, inner loop uses iterator from parent
        fmt += '{d}';
        args.push('@as(i64, @intCast(_i))');  // parent map iteration still uses _i at its level
      } else if (ctx.currentMap && expr.startsWith(ctx.currentMap.itemParam + '.')) {
        // Map item member access: ${item.field} → {s}/{d} with OA field ref
        const field = expr.slice(ctx.currentMap.itemParam.length + 1);
        const oa = ctx.currentMap.oa;
        const fi = oa.fields.find(f => f.name === field);
        if (fi) {
          const oaIdx = oa.oaIdx;
          if (fi.type === 'string') {
            fmt += '{s}';
            args.push(`_oa${oaIdx}_${field}[_i][0.._oa${oaIdx}_${field}_lens[_i]]`);
          } else {
            fmt += '{d}';
            args.push(`_oa${oaIdx}_${field}[_i]`);
          }
        } else {
          fmt += expr;
        }
      } else if (expr.includes('?') && expr.includes(':')) {
        // Ternary expression in template literal: condition ? trueVal : falseVal
        // Parse recursively to handle chained ternaries: a == 0 ? "x" : a == 1 ? "y" : "z"
        const parseTernaryExpr = (e) => {
          const qIdx = e.indexOf('?');
          if (qIdx < 0) return { isLiteral: true, value: e.trim() };
          const condStr = e.slice(0, qIdx).trim();
          const rest = e.slice(qIdx + 1);
          // Find matching : considering nested ternaries (count ? depth)
          let depth = 0, colonIdx = -1;
          for (let ci = 0; ci < rest.length; ci++) {
            if (rest[ci] === '?') depth++;
            else if (rest[ci] === ':') { if (depth === 0) { colonIdx = ci; break; } depth--; }
          }
          if (colonIdx < 0) return { isLiteral: true, value: e.trim() };
          let trueStr = rest.slice(0, colonIdx).trim();
          let falseStr = rest.slice(colonIdx + 1).trim();
          // Strip quotes from branches
          const stripQ = (s) => (s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")) ? s.slice(1, -1) : null;
          // Resolve condition LHS
          let condZig = condStr;
          // Replace state getters in condition
          for (const s of ctx.stateSlots) {
            if (condStr.includes(s.getter)) {
              condZig = condZig.replace(new RegExp('\\b' + s.getter + '\\b', 'g'), slotGet(s.getter));
            }
          }
          // Fix === to ==, !== to !=
          condZig = condZig.replace(/===/g, '==').replace(/!==/g, '!=');
          const tv = stripQ(trueStr);
          const fv = stripQ(falseStr);
          if (tv !== null && fv !== null) {
            return { isLiteral: false, zigExpr: `if (${condZig}) "${tv}" else "${fv}"`, spec: '{s}' };
          }
          // Recursive: false branch might be another ternary
          const fvParsed = parseTernaryExpr(falseStr);
          if (tv !== null && !fvParsed.isLiteral) {
            return { isLiteral: false, zigExpr: `if (${condZig}) "${tv}" else ${fvParsed.zigExpr}`, spec: '{s}' };
          }
          // Numeric branches
          if (/^-?\d+$/.test(trueStr) && /^-?\d+$/.test(falseStr)) {
            return { isLiteral: false, zigExpr: `if (${condZig}) @as(i64, ${trueStr}) else @as(i64, ${falseStr})`, spec: '{d}' };
          }
          return { isLiteral: true, value: e.trim() };
        };
        const result = parseTernaryExpr(expr);
        if (!result.isLiteral) {
          fmt += result.spec;
          args.push(result.zigExpr);
        } else {
          fmt += result.value;
        }
      } else {
        // Non-resolvable arithmetic/complex expression — embed as literal text
        fmt += expr;
      }
      i = j;
    } else {
      fmt += raw[i] === '"' ? '\\"' : raw[i];
      i++;
    }
  }
  return { fmt, args };
}

// Try to parse {expr && <JSX>} conditional — returns true if consumed
function tryParseConditional(c, children) {
  // Look ahead: identifier (op identifier/number)* && <
  const saved = c.save();
  let condParts = [];
  // Collect condition expression until && or }
  while (c.kind() !== TK.eof && c.kind() !== TK.rbrace) {
    if (c.kind() === TK.amp_amp) {
      c.advance();
      // Check if next is JSX
      if (c.kind() === TK.lt) {
        const condExpr = condParts.join('');
        const jsxNode = parseJSXElement(c);
        if (c.kind() === TK.rbrace) c.advance();
        // Map-item conditional: inject display style inline instead of _updateConditionals
        if (ctx.currentMap) {
          const ip = ctx.currentMap.itemParam;
          const mm = condExpr.match(new RegExp('^' + ip + '\\.(\\w+)(\\s*==\\s*)(\\d+)$'));
          if (mm) {
            const oa = ctx.currentMap.oa;
            const resolved = `_oa${oa.oaIdx}_${mm[1]}[_i] == ${mm[3]}`;
            // Merge display into existing style if present, otherwise add new style
            let modified;
            if (jsxNode.nodeExpr.includes('.style = .{')) {
              modified = jsxNode.nodeExpr.replace('.style = .{', `.style = .{ .display = if (${resolved}) .flex else .none,`);
            } else {
              modified = jsxNode.nodeExpr.replace(/ \}$/, `, .style = .{ .display = if (${resolved}) .flex else .none } }`);
            }
            children.push({ nodeExpr: modified, dynBufId: jsxNode.dynBufId });
            return true;
          }
        }
        // Register as conditional
        const condIdx = ctx.conditionals.length;
        ctx.conditionals.push({ condExpr, kind: 'show_hide', inMap: !!ctx.currentMap });
        children.push({ nodeExpr: jsxNode.nodeExpr, condIdx, dynBufId: jsxNode.dynBufId });
        return true;
      }
      // Not JSX after && — might be chained condition, put && back
      condParts.push(' and ');
      continue;
    }
    if (c.kind() === TK.pipe_pipe) {
      condParts.push(' or ');
      c.advance();
      continue;
    }
    // Build condition expression with Zig-compatible ops
    if (c.kind() === TK.identifier) {
      const name = c.text();
      if (globalThis.__SMITH_DEBUG_INLINE && (name === 'activeTab' || name === 'connectedApp' || name === 'selectedIdx' || name === 'crashCount' || name === 'copied')) {
        globalThis.__dbg = globalThis.__dbg || [];
        globalThis.__dbg.push('[COND] name=' + name + ' isGetter=' + isGetter(name) + ' slot=' + findSlot(name) + ' inline=' + (ctx.inlineComponent || 'App') + ' pos=' + c.pos);
      }
      if (isGetter(name)) {
        condParts.push(slotGet(name));
      } else if (ctx.renderLocals && ctx.renderLocals[name] !== undefined) {
        // Render-local variable in conditional
        condParts.push(ctx.renderLocals[name]);
      } else if (ctx.propStack && ctx.propStack[name] !== undefined) {
        // Prop from component — resolve value for conditional use
        const pv = ctx.propStack[name];
        if (ctx.currentMap && ctx.currentMap.oa) {
          const fi = ctx.currentMap.oa.fields.find(f => f.name === name);
          if (fi) {
            condParts.push(`_oa${ctx.currentMap.oa.oaIdx}_${name}[_i]`);
          } else {
            condParts.push(_condPropValue(pv));
          }
        } else {
          condParts.push(_condPropValue(pv));
        }
      } else if (ctx.currentMap && name === ctx.currentMap.indexParam) {
        condParts.push('@as(i64, @intCast(_i))');
      } else if (ctx.currentMap && name === ctx.currentMap.itemParam) {
        // Map item parameter: check for .field access
        c.advance();
        if (c.kind() === TK.dot) {
          c.advance();
          if (c.kind() === TK.identifier) {
            const field = c.text();
            const oa = ctx.currentMap.oa;
            if (oa) {
              const fi = oa.fields.find(f => f.name === field);
              if (fi) {
                condParts.push(`_oa${oa.oaIdx}_${field}[_i]`);
              } else {
                condParts.push(`_oa${oa.oaIdx}_${field}[_i]`);
              }
            } else {
              condParts.push('0');
            }
          }
        } else {
          condParts.push('@as(i64, @intCast(_i))');
        }
        // c.advance() handled below
      } else if (ctx.inlineComponent) {
        // Inside inlined component: unresolved identifier is an unprovided prop → falsy (0)
        condParts.push('0');
      } else {
        condParts.push(name);
      }
    } else if (c.kind() === TK.number) {
      // Leading space before numbers after operators (matches reference double-space pattern)
      const lastPart = condParts.length > 0 ? condParts[condParts.length - 1] : '';
      if (lastPart.endsWith(' ')) condParts.push(' ' + c.text());
      else condParts.push(c.text());
    } else if (c.kind() === TK.eq_eq) {
      condParts.push(' == ');
      c.advance();
      if (c.kind() === TK.equals) c.advance(); // === → ==
      continue;
    } else if (c.kind() === TK.not_eq) {
      condParts.push(' != ');
      c.advance();
      if (c.kind() === TK.equals) c.advance(); // !== → !=
      continue;
    } else if (c.kind() === TK.gt_eq) {
      condParts.push(' >= ');
    } else if (c.kind() === TK.lt_eq) {
      condParts.push(' <= ');
    } else if (c.kind() === TK.gt) {
      condParts.push(' > ');
    } else if (c.kind() === TK.lt) {
      // Disambiguate: < followed by number/getter is less-than comparison, not JSX tag open
      if (c.pos + 1 < c.count && (c.kindAt(c.pos + 1) === TK.number || (c.kindAt(c.pos + 1) === TK.identifier && (isGetter(c.textAt(c.pos + 1)) || (ctx.propStack && ctx.propStack[c.textAt(c.pos + 1)] !== undefined))))) {
        condParts.push(' < ');
        c.advance();
        continue;
      }
      break;
    } else if (c.kind() === TK.question) {
      // Ternary — not a conditional, bail
      break;
    } else if (c.kind() === TK.string) {
      // JS string in condition: convert to Zig string comparison
      const sv = c.text().slice(1, -1); // strip quotes
      const lastOp = condParts.length > 0 ? condParts[condParts.length - 1] : '';
      if (sv === '' && (lastOp === ' == ' || lastOp === ' != ')) {
        condParts.pop();
        const lhs = condParts.join('');
        condParts.length = 0;
        condParts.push(lastOp === ' == ' ? `${lhs}.len == 0` : `${lhs}.len > 0`);
      } else if (lastOp === ' == ' || lastOp === ' != ') {
        condParts.pop();
        const lhs = condParts.join('');
        condParts.length = 0;
        const eql = `std.mem.eql(u8, ${lhs}, "${sv}")`;
        condParts.push(lastOp === ' == ' ? eql : `!${eql}`);
      } else {
        condParts.push(`"${sv}"`);
      }
    } else {
      condParts.push(c.text());
    }
    c.advance();
  }
  // Didn't find && <JSX> pattern — restore and return false
  c.restore(saved);
  return false;
}

// Try to parse {expr ? (<JSX>) : (<JSX>)} ternary JSX branches
function tryParseTernaryJSX(c, children) {
  const saved = c.save();
  let condParts = [];
  let foundQuestion = false;
  while (c.kind() !== TK.eof && c.kind() !== TK.rbrace) {
    if (c.kind() === TK.question) { foundQuestion = true; c.advance(); break; }
    if (c.kind() === TK.identifier) {
      const name = c.text();
      if (isGetter(name)) {
        condParts.push(slotGet(name));
      } else if (ctx.renderLocals && ctx.renderLocals[name] !== undefined) {
        condParts.push(ctx.renderLocals[name]);
      } else if (ctx.propStack && ctx.propStack[name] !== undefined) {
        const pv2 = ctx.propStack[name];
        if (ctx.currentMap && ctx.currentMap.oa) {
          const fi = ctx.currentMap.oa.fields.find(f => f.name === name);
          if (fi) {
            condParts.push(`_oa${ctx.currentMap.oa.oaIdx}_${name}[_i]`);
          } else {
            condParts.push(_condPropValue(pv2));
          }
        } else {
          condParts.push(_condPropValue(pv2));
        }
      } else if (ctx.currentMap && name === ctx.currentMap.indexParam) {
        condParts.push('@as(i64, @intCast(_i))');
      } else if (ctx.inlineComponent) {
        condParts.push('0');
      } else {
        condParts.push(name);
      }
    } else if (c.kind() === TK.eq_eq) { condParts.push(' == '); c.advance(); if (c.kind() === TK.equals) c.advance(); continue; }
    else if (c.kind() === TK.not_eq) { condParts.push(' != '); c.advance(); if (c.kind() === TK.equals) c.advance(); continue; }
    else if (c.kind() === TK.number) { condParts.push(c.text()); }
    else if (c.kind() === TK.gt) { condParts.push(' > '); }
    else if (c.kind() === TK.lt) {
      // Disambiguate: < followed by number/getter is less-than comparison, not JSX tag open
      if (c.pos + 1 < c.count && (c.kindAt(c.pos + 1) === TK.number || (c.kindAt(c.pos + 1) === TK.identifier && (isGetter(c.textAt(c.pos + 1)) || (ctx.propStack && ctx.propStack[c.textAt(c.pos + 1)] !== undefined))))) {
        condParts.push(' < ');
        c.advance();
        continue;
      }
      break;
    }
    else { condParts.push(c.text()); }
    c.advance();
  }
  if (!foundQuestion) { c.restore(saved); return false; }
  // Check for JSX branches: ? ( <JSX> ) : ( <JSX> )
  if (c.kind() !== TK.lparen) { c.restore(saved); return false; }
  c.advance();
  if (c.kind() !== TK.lt) { c.restore(saved); return false; }
  const trueBranch = parseJSXElement(c);
  if (c.kind() === TK.rparen) c.advance();
  if (c.kind() !== TK.colon) { c.restore(saved); return false; }
  c.advance();
  if (c.kind() !== TK.lparen) { c.restore(saved); return false; }
  c.advance();
  if (c.kind() !== TK.lt) { c.restore(saved); return false; }
  const falseBranch = parseJSXElement(c);
  if (c.kind() === TK.rparen) c.advance();
  if (c.kind() === TK.rbrace) c.advance();
  const condExpr = condParts.join('');
  const condIdx = ctx.conditionals.length;
  ctx.conditionals.push({ condExpr, kind: 'ternary_jsx', trueIdx: -1, falseIdx: -1, inMap: !!ctx.currentMap });
  children.push({ nodeExpr: trueBranch.nodeExpr, ternaryCondIdx: condIdx, ternaryBranch: 'true', dynBufId: trueBranch.dynBufId });
  children.push({ nodeExpr: falseBranch.nodeExpr, ternaryCondIdx: condIdx, ternaryBranch: 'false', dynBufId: falseBranch.dynBufId });
  return true;
}

// Try to parse {expr == val ? "a" : "b"} ternary text
function tryParseTernaryText(c, children) {
  // Look ahead for ? ... : pattern
  const saved = c.save();
  // Skip to ? while collecting condition
  let condParts = [];
  let foundQuestion = false;
  while (c.kind() !== TK.eof && c.kind() !== TK.rbrace) {
    if (c.kind() === TK.question) { foundQuestion = true; c.advance(); break; }
    // Bail out if we hit parens, JSX, or arrows — this is not a simple ternary text
    if (c.kind() === TK.lparen || c.kind() === TK.lt || c.kind() === TK.arrow ||
        c.kind() === TK.lbrace) { c.restore(saved); return false; }
    if (c.kind() === TK.identifier) {
      const name = c.text();
      if (isGetter(name)) condParts.push(slotGet(name));
      else if (ctx.renderLocals && ctx.renderLocals[name] !== undefined) condParts.push(ctx.renderLocals[name]);
      else condParts.push(name);
    } else if (c.kind() === TK.eq_eq) { condParts.push(' == '); c.advance(); if (c.kind() === TK.equals) c.advance(); continue; }
    else if (c.kind() === TK.not_eq) { condParts.push(' != '); c.advance(); if (c.kind() === TK.equals) c.advance(); continue; }
    else if (c.kind() === TK.number) { condParts.push(c.text()); }
    else if (c.kind() === TK.gt) { condParts.push(' > '); }
    else { condParts.push(c.text()); }
    c.advance();
  }
  if (!foundQuestion) { c.restore(saved); return false; }
  // Get true branch value
  let trueVal = '';
  if (c.kind() === TK.string) { trueVal = c.text().slice(1, -1); c.advance(); }
  else { c.restore(saved); return false; }
  // Expect :
  if (c.kind() !== TK.colon) { c.restore(saved); return false; }
  c.advance();
  // Get false branch value
  let falseVal = '';
  if (c.kind() === TK.string) { falseVal = c.text().slice(1, -1); c.advance(); }
  else { c.restore(saved); return false; }
  if (c.kind() === TK.rbrace) c.advance();
  // Ternary text: create dynamic text with conditional format
  const condExpr = condParts.join('');
  const isBool = condExpr.includes('==') || condExpr.includes('!=') ||
    condExpr.includes('>=') || condExpr.includes('<=') ||
    condExpr.includes(' > ') || condExpr.includes(' < ') ||
    condExpr.includes('getSlotBool') || condExpr.includes('getBool');
  const zigCond = isBool ? `(${condExpr})` : `((${condExpr}) != 0)`;
  const bufId = ctx.dynCount;
  // Use Zig if/else to select the string at runtime
  const fmtArgs = `if ${zigCond} @as([]const u8, "${trueVal}") else @as([]const u8, "${falseVal}")`;
  ctx.dynTexts.push({ bufId, fmtString: '{s}', fmtArgs, arrName: '', arrIndex: 0, bufSize: 64 });
  ctx.dynCount++;
  children.push({ nodeExpr: `.{ .text = "" }`, dynBufId: bufId });
  return true;
}

function parseChildren(c) {
  const children = [];
  while (c.kind() !== TK.lt_slash && c.kind() !== TK.eof) {
    if (c.kind() === TK.lt) {
      // Detect <Glyph .../> inside <Text> — emit as inline glyph marker
      if (c.kind() === TK.lt && c.pos + 1 < c.count && c.textAt(c.pos + 1) === 'Glyph') {
        const glyph = parseInlineGlyph(c);
        if (glyph) { children.push(glyph); continue; }
      }
      children.push(parseJSXElement(c));
    } else if (c.kind() === TK.lbrace) {
      c.advance();
      if (globalThis.__SMITH_DEBUG_MAP_DETECT) {
        if (!globalThis.__dbg) globalThis.__dbg = [];
        globalThis.__dbg.push(`BRACE kind=${c.kind()} text=${c.text()} pos=${c.pos}`);
      }
      // Try conditional: {expr && <JSX>} or {expr != val && <JSX>}
      const condResult = tryParseConditional(c, children);
      if (condResult) { if (globalThis.__SMITH_DEBUG_MAP_DETECT) globalThis.__dbg.push(`-> consumed by tryParseConditional`); continue; }
      // Try ternary JSX: {expr ? (<JSX>) : (<JSX>)}
      const ternJSXResult = tryParseTernaryJSX(c, children);
      if (ternJSXResult) { if (globalThis.__SMITH_DEBUG_MAP_DETECT) globalThis.__dbg.push(`-> consumed by tryParseTernaryJSX`); continue; }
      // Try ternary text: {expr == val ? "str" : "str"}
      const ternTextResult = tryParseTernaryText(c, children);
      if (ternTextResult) { if (globalThis.__SMITH_DEBUG_MAP_DETECT) globalThis.__dbg.push(`-> consumed by tryParseTernaryText`); continue; }
      // Map: {items.map((item, i) => (...))} — syntactic detection (Love2D style)
      if (c.kind() === TK.identifier) {
        const maybeArr = c.text();
        // Detect .map( syntactically FIRST, then find/create OA
        if (c.pos + 3 < c.count && c.kindAt(c.pos + 1) === TK.dot) {
          const savedPeek = c.save();
          c.advance(); c.advance(); // skip identifier, skip .
          const isMapCall = c.isIdent('map') && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.lparen;
          c.restore(savedPeek);
          if (isMapCall) {
            let oa = ctx.objectArrays.find(o => o.getter === maybeArr);
            if (!oa) oa = inferOaFromSource(c, maybeArr);
            if (oa) {
              const mapResult = tryParseMap(c, oa);
              if (mapResult) {
                children.push(mapResult);
                if (c.kind() === TK.rbrace) c.advance();
                continue;
              }
            }
          }
        }
        // Nested map: {group.items.map(...)} inside an outer .map()
        if (ctx.currentMap && maybeArr === ctx.currentMap.itemParam &&
            c.pos + 3 < c.count && c.kindAt(c.pos + 1) === TK.dot) {
          const saved2 = c.save();
          c.advance(); // skip item param
          c.advance(); // skip .
          if (c.kind() === TK.identifier) {
            const nestedField = c.text();
            // Find nested OA for this field
            const parentOa = ctx.currentMap.oa;
            const nestedFieldInfo = parentOa.fields.find(f => f.type === 'nested_array' && f.name === nestedField);
            if (nestedFieldInfo && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.dot) {
              const nestedOa = ctx.objectArrays.find(o => o.oaIdx === nestedFieldInfo.nestedOaIdx);
              if (nestedOa) {
                const mapResult = tryParseNestedMap(c, nestedOa, nestedField);
                if (mapResult) {
                  children.push(mapResult);
                  if (c.kind() === TK.rbrace) c.advance();
                  continue;
                }
              }
            }
          }
          c.restore(saved2);
        }
      }
      // Template literal: {`text ${expr}`}
      if (!globalThis.__dbg) globalThis.__dbg = [];
      globalThis.__dbg.push('[PC] at template check: kind=' + c.kind() + ' text=' + (c.text() || '').substring(0, 40) + ' TK.template_literal=' + TK.template_literal);
      if (c.kind() === TK.template_literal) {
        const raw = c.text().slice(1, -1); // strip backticks
        c.advance();
        if (c.kind() === TK.rbrace) c.advance();
        // Parse template: split on ${...} and build fmt string + args
        const { fmt, args } = parseTemplateLiteral(raw);
        if (args.length > 0) {
          // Check if this template references map data (inside a .map() template)
          const isMapTemplate = ctx.currentMap && args.some(a => a.includes('_oa') || a.includes('_i'));
          if (isMapTemplate) {
            const mapBufId = ctx.mapDynCount || 0;
            ctx.mapDynCount = mapBufId + 1;
            ctx.dynTexts.push({ bufId: mapBufId, fmtString: fmt, fmtArgs: args.join(', '), arrName: '', arrIndex: 0, bufSize: 256, inMap: true, mapIdx: ctx.maps.indexOf(ctx.currentMap) });
            children.push({ nodeExpr: `.{ .text = "" }`, dynBufId: mapBufId, inMap: true });
          } else {
            const bufId = ctx.dynCount;
            // Buffer size: for bare `${expr}` use 64, otherwise formula
            const staticText = fmt.replace(/\{[ds](?::\.?\d+)?\}/g, '');
            const strArgCount = args.filter(a => a.includes('getSlotString')).length;
            const intArgCount = args.length - strArgCount;
            const staticLen = utf8ByteLen(staticText);
            const bufSize = staticText.length === 0 ? 64 : Math.max(64, staticLen + 20 * intArgCount + 128 * strArgCount);
            ctx.dynTexts.push({ bufId, fmtString: fmt, fmtArgs: args.join(', '), arrName: '', arrIndex: 0, bufSize });
            ctx.dynCount++;
            children.push({ nodeExpr: `.{ .text = "" }`, dynBufId: bufId });
          }
        } else {
          children.push({ nodeExpr: `.{ .text = "${fmt}" }` });
        }
        continue;
      }
      // Map item access: {item.field} inside a .map()
      if (c.kind() === TK.identifier && ctx.currentMap && c.text() === ctx.currentMap.itemParam) {
        c.advance();
        if (c.kind() === TK.dot) {
          c.advance();
          if (c.kind() === TK.identifier) {
            const field = c.text();
            const oa = ctx.currentMap.oa;
            const oaIdx = oa.oaIdx;
            const fieldInfo = oa.fields.find(f => f.name === field);
            c.advance();
            if (c.kind() === TK.rbrace) c.advance();
            // Create dynamic text for this map item field
            const mapBufId = ctx.mapDynCount || 0;
            ctx.mapDynCount = mapBufId + 1;
            const fmt = fieldInfo && fieldInfo.type === 'string' ? '{s}' : '{d}';
            let args;
            if (fieldInfo && fieldInfo.type === 'string') {
              args = `_oa${oaIdx}_${field}[_i][0.._oa${oaIdx}_${field}_lens[_i]]`;
            } else {
              args = `_oa${oaIdx}_${field}[_i]`;
            }
            ctx.dynTexts.push({ bufId: mapBufId, fmtString: fmt, fmtArgs: args, arrName: '', arrIndex: 0, bufSize: 256, inMap: true, mapIdx: ctx.maps.indexOf(ctx.currentMap) });
            children.push({ nodeExpr: `.{ .text = "" }`, dynBufId: mapBufId, inMap: true });
            continue;
          }
        }
      }
      // {children} splice — insert component children
      if (c.kind() === TK.identifier && c.text() === 'children' && ctx.componentChildren) {
        c.advance();
        if (c.kind() === TK.rbrace) c.advance();
        for (const ch of ctx.componentChildren) children.push(ch);
        continue;
      }
      // {renderLocal} — substitute render-local variables (Love2D: renderLocals)
      if (c.kind() === TK.identifier && ctx.renderLocals && ctx.renderLocals[c.text()] !== undefined) {
        const rlVal = ctx.renderLocals[c.text()];
        c.advance();
        if (c.kind() === TK.rbrace) c.advance();
        children.push({ nodeExpr: `.{ .text = "${rlVal}" }` });
        continue;
      }
      // {expr} — check props first, then state getters
      if (c.kind() === TK.identifier && ctx.propStack[c.text()] !== undefined) {
        const propVal = ctx.propStack[c.text()];
        c.advance();
        if (c.kind() === TK.rbrace) c.advance();
        // OA field refs or Zig expressions inside maps → per-item dynamic text
        const isMapExpr = propVal.includes('_oa') || propVal.includes('[_i]') || propVal.includes('state.get');
        if (ctx.currentMap && isMapExpr) {
          const mapBufId = ctx.dynCount;
          const isStr = propVal.includes('..');
          const fmt = isStr ? '{s}' : '{d}';
          const args = isStr ? propVal : leftFoldExpr(propVal);
          ctx.dynTexts.push({ bufId: mapBufId, fmtString: fmt, fmtArgs: args, arrName: '', arrIndex: 0, bufSize: 256, inMap: true, mapIdx: ctx.maps.indexOf(ctx.currentMap) });
          ctx.dynCount++;
          children.push({ nodeExpr: `.{ .text = "" }` });
        } else {
          children.push({ nodeExpr: `.{ .text = "${propVal}" }` });
        }
      } else if (c.kind() === TK.identifier && isGetter(c.text())) {
        const getter = c.text();
        const slotIdx = findSlot(getter);
        const slot = ctx.stateSlots[slotIdx];
        c.advance();
        // Check for ternary text: getter == N ? "A" : "B"
        if (c.kind() === TK.eq_eq || c.kind() === TK.not_eq || c.kind() === TK.gt || c.kind() === TK.lt || c.kind() === TK.gt_eq || c.kind() === TK.lt_eq) {
          const op = c.kind() === TK.eq_eq ? '==' : c.kind() === TK.not_eq ? '!=' : c.text();
          c.advance();
          if ((op === '==' || op === '!=') && c.kind() === TK.equals) c.advance(); // === / !==
          let rhs = '';
          let rhsIsString = false;
          if (c.kind() === TK.number) { rhs = c.text(); c.advance(); }
          else if (c.kind() === TK.string) { rhs = c.text().slice(1, -1); c.advance(); rhsIsString = true; }
          if (c.kind() === TK.question) {
            c.advance(); // skip ?
            // Parse true branch string
            let trueText = '';
            if (c.kind() === TK.string) { trueText = c.text().slice(1, -1); c.advance(); }
            if (c.kind() === TK.colon) c.advance();
            // Parse false branch — could be another ternary or a string
            let falseExpr = '';
            if (c.kind() === TK.string) {
              falseExpr = `"${c.text().slice(1, -1)}"`;
              c.advance();
            } else if (c.kind() === TK.identifier && isGetter(c.text())) {
              // Nested ternary: getter == M ? "C" : "D"
              const g2 = c.text(); c.advance();
              if (c.kind() === TK.eq_eq || c.kind() === TK.not_eq) {
                const op2 = c.kind() === TK.eq_eq ? '==' : '!='; c.advance();
                if (c.kind() === TK.equals) c.advance();
                let rhs2 = '';
                if (c.kind() === TK.number) { rhs2 = c.text(); c.advance(); }
                else if (c.kind() === TK.string) { rhs2 = c.text().slice(1, -1); c.advance(); }
                if (c.kind() === TK.question) {
                  c.advance();
                  let t2 = ''; if (c.kind() === TK.string) { t2 = c.text().slice(1, -1); c.advance(); }
                  if (c.kind() === TK.colon) c.advance();
                  let f2 = ''; if (c.kind() === TK.string) { f2 = c.text().slice(1, -1); c.advance(); }
                  const cond2 = `(${slotGet(g2)} ${op2} ${rhs2})`;
                  falseExpr = `if ${cond2} @as([]const u8, "${t2}") else @as([]const u8, "${f2}")`;
                }
              }
            }
            if (!falseExpr) falseExpr = '@as([]const u8, "")';
            // Build condition
            let cond;
            if (rhsIsString || slot.type === 'string') {
              const eql = `std.mem.eql(u8, ${slotGet(getter)}, "${rhs}")`;
              cond = op === '!=' ? `(!${eql})` : `(${eql})`;
            } else {
              cond = `(${slotGet(getter)} ${op} ${rhs})`;
            }
            const ternaryExpr = `if ${cond} @as([]const u8, "${trueText}") else @as([]const u8, ${falseExpr})`;
            // Use dynTexts — same as state getters, just with if/else as the format arg
            const bufId = ctx.dynCount;
            const bufSize = Math.max(64, trueText.length + 32);
            ctx.dynTexts.push({ bufId, fmtString: '{s}', fmtArgs: ternaryExpr, arrName: '', arrIndex: 0, bufSize });
            ctx.dynCount++;
            // Consume remaining tokens until }
            let _bd2 = 0;
            while (c.kind() !== TK.eof) {
              if (c.kind() === TK.lbrace) _bd2++;
              if (c.kind() === TK.rbrace) { if (_bd2 === 0) break; _bd2--; }
              c.advance();
            }
            if (c.kind() === TK.rbrace) c.advance();
            children.push({ nodeExpr: '.{ .text = "" }', dynBufId: bufId });
          } else {
            // Not a ternary — consume rest and skip
            while (c.kind() !== TK.rbrace && c.kind() !== TK.eof) c.advance();
            if (c.kind() === TK.rbrace) c.advance();
            children.push({ nodeExpr: '.{ .text = "" }' });
          }
        } else {
          // Simple getter display
          const bufId = ctx.dynCount;
          const fmt = slot.type === 'string' ? '{s}' : slot.type === 'float' ? '{d:.2}' : '{d}';
          const bufSize = slot.type === 'string' ? 128 : 64;
          const args = slotGet(getter);
          ctx.dynTexts.push({ bufId, fmtString: fmt, fmtArgs: args, arrName: '', arrIndex: 0, bufSize });
          ctx.dynCount++;
          // Consume remaining expression tokens until closing brace
          let _bd = 0;
          while (c.kind() !== TK.eof) {
            if (c.kind() === TK.lbrace) _bd++;
            if (c.kind() === TK.rbrace) { if (_bd === 0) break; _bd--; }
            c.advance();
          }
          if (c.kind() === TK.rbrace) c.advance();
          // Placeholder node — text will be set by _updateDynamicTexts
          children.push({ nodeExpr: '.{ .text = "" }', dynBufId: bufId });
        }
      } else {
        // Skip unknown expression
        let depth = 1;
        while (depth > 0 && c.kind() !== TK.eof) {
          if (c.kind() === TK.lbrace) depth++;
          if (c.kind() === TK.rbrace) depth--;
          if (depth > 0) c.advance();
        }
        if (c.kind() === TK.rbrace) c.advance();
      }
    } else if (c.kind() === TK.comment) {
      // Skip block comments in JSX children
      c.advance();
    } else if (c.kind() !== TK.rbrace) {
      // Text content — use raw source between first and last token to preserve apostrophes etc
      const textStart = c.starts[c.pos];
      let textEnd = textStart;
      while (c.kind() !== TK.lt && c.kind() !== TK.lt_slash && c.kind() !== TK.lbrace && c.kind() !== TK.eof && c.kind() !== TK.rbrace) {
        textEnd = c.ends[c.pos];
        c.advance();
      }
      const text = c._byteSlice(textStart, textEnd).trim();
      if (text.trim()) {
        if (globalThis.__SMITH_DEBUG_INLINE && (text.includes('import') || text.includes('function ') || text.includes('setMyPid'))) {
          globalThis.__dbg = globalThis.__dbg || [];
          globalThis.__dbg.push('[TEXT_LEAK] text="' + text.substring(0, 80) + '" pos=' + c.pos + ' inline=' + (ctx.inlineComponent || 'none'));
          // Dump surrounding tokens for diagnostics
          for (let di = Math.max(0, c.pos - 5); di < Math.min(c.count, c.pos + 5); di++) {
            globalThis.__dbg.push('[TOK@' + di + '] kind=' + c.kindAt(di) + ' text="' + c.textAt(di).substring(0, 40) + '"');
          }
          // Only dump first leak
          if (!globalThis.__firstLeakDumped) {
            globalThis.__firstLeakDumped = true;
            // Dump what happened around SourcePage bodyPos
            globalThis.__dbg.push('[CONTEXT] SourcePage bodyPos check: components=' + ctx.components.map(function(cc) { return cc.name + '@' + cc.bodyPos; }).join(', '));
          }
        }
        children.push({ nodeExpr: `.{ .text = "${text.trim().replace(/"/g, '\\"')}" }` });
      }
    } else { c.advance(); }
  }
  return children;
}

function skipBraces(c) {
  let depth = 1; c.advance();
  while (depth > 0 && c.kind() !== TK.eof) {
    if (c.kind() === TK.lbrace) depth++;
    if (c.kind() === TK.rbrace) depth--;
    if (depth > 0) c.advance();
  }
  if (c.kind() === TK.rbrace) c.advance();
}

function offsetToLine(source, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < source.length; i++) {
    if (source[i] === '\n') line++;
  }
  return line;
}

// Parse <Glyph d="..." fill="#color" fillEffect="name" /> inside <Text>
// Returns a glyph marker child node or null
function parseInlineGlyph(c) {
  if (c.kind() !== TK.lt) return null;
  c.advance(); // skip <
  if (c.text() !== 'Glyph') return null;
  c.advance(); // skip Glyph
  let d = '', fill = '#ffffff', fillEffect = '', stroke = '', strokeWidth = '0', scale = '1.0';
  while (c.kind() === TK.identifier && c.kind() !== TK.eof) {
    const aname = c.text(); c.advance();
    if (c.kind() !== TK.equals) continue;
    c.advance(); // skip =
    let aval = '';
    if (c.kind() === TK.string) { aval = c.text().slice(1, -1); c.advance(); }
    else if (c.kind() === TK.lbrace) { c.advance(); if (c.kind() === TK.identifier || c.kind() === TK.number) { aval = c.text(); c.advance(); } if (c.kind() === TK.rbrace) c.advance(); }
    else { aval = c.text(); c.advance(); }
    if (aname === 'd') d = aval;
    else if (aname === 'fill') fill = aval;
    else if (aname === 'fillEffect') fillEffect = aval;
    else if (aname === 'stroke') stroke = aval;
    else if (aname === 'strokeWidth') strokeWidth = aval;
    else if (aname === 'scale') scale = aval;
  }
  // Skip /> or >
  if (c.kind() === TK.slash_gt) c.advance();
  else if (c.kind() === TK.gt) c.advance();
  const fillColor = fill.startsWith('#') ? parseColor(fill) : 'Color.rgb(255, 255, 255)';
  const strokeColor = stroke ? (stroke.startsWith('#') ? parseColor(stroke) : 'Color.rgba(0, 0, 0, 0)') : 'Color.rgba(0, 0, 0, 0)';
  const fillEffectStr = fillEffect ? `, .fill_effect = "${fillEffect}"` : '';
  const glyphExpr = `.{ .d = "${d}", .fill = ${fillColor}, .stroke = ${strokeColor}, .stroke_width = ${strokeWidth}, .scale = ${scale}${fillEffectStr} }`;
  return { nodeExpr: '.{ .text = "\\x01" }', isGlyph: true, glyphExpr };
}

