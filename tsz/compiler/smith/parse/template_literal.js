// ── Template literal parsing ──────────────────────────────────────

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
      } else if (expr.endsWith('.length')) {
        // Array .length → OA _len variable
        const arrName = expr.slice(0, -7);
        const oa = ctx.objectArrays.find(function(o) { return o.getter === arrName; });
        if (oa) {
          fmt += '{d}';
          args.push(`@as(i64, @intCast(_oa${oa.oaIdx}_len))`);
        } else if ((ctx.scriptBlock || globalThis.__scriptContent) && (ctx.renderLocals && ctx.renderLocals[arrName] !== undefined)) {
          // Render-local .length — evaluate via QuickJS
          if (!ctx._jsEvalCount) ctx._jsEvalCount = 0;
          const evalBufId = ctx._jsEvalCount;
          ctx._jsEvalCount = evalBufId + 1;
          fmt += '{s}';
          // Don't expand — use the raw variable name. __computeRenderBody makes it a JS global.
          const escaped = expr.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          args.push(`qjs_runtime.evalToString("String(${escaped})", &_eval_buf_${evalBufId})`);
        } else {
          fmt += expr;
        }
      } else if (/^(\w+)\s*([+\-*\/])\s*(.+)$/.test(expr)) {
        // Arithmetic expression: getter + N, getter - 1, getter + getter + getter, etc.
        // Resolve ALL state getter identifiers in the expression
        const resolveArithExpr = (e) => {
          return e.replace(/\b(\w+)\b/g, (w) => {
            const si = findSlot(w);
            if (si >= 0) return slotGet(w);
            if (ctx.currentMap && w === ctx.currentMap.indexParam) {
              return '@as(i64, @intCast(' + (ctx.currentMap.iterVar || '_i') + '))';
            }
            return w;
          });
        };
        const m = expr.match(/^(\w+)\s*([+\-*\/])\s*(.+)$/);
        const lhsSlot = findSlot(m[1]);
        if (lhsSlot >= 0 || (ctx.currentMap && m[1] === ctx.currentMap.indexParam)) {
          const resolved = resolveArithExpr(expr);
          fmt += '{d}';
          if (m[2] === '/' && !m[3].includes('+') && !m[3].includes('-')) {
            args.push(`@divTrunc(${resolveArithExpr(m[1])}, ${resolveArithExpr(m[3].trim())})`);
          } else if (m[2] === '%' && !m[3].includes('+') && !m[3].includes('-')) {
            args.push(`@mod(${resolveArithExpr(m[1])}, ${resolveArithExpr(m[3].trim())})`);
          } else {
            args.push(resolved);
          }
        } else {
          fmt += expr;
        }
      } else if (ctx.renderLocals && ctx.renderLocals[expr] !== undefined) {
        // Render-local variable substitution in template literal
        const rlVal = ctx.renderLocals[expr];
        const isNum = /^-?\d+(\.\d+)?$/.test(rlVal);
        const isEvalExpr = rlVal.includes('qjs_runtime.evalToString');
        const isZigExpr = rlVal.includes('state.get') || rlVal.includes('getSlot') || rlVal.includes('_oa') || rlVal.includes('@as');
        const isStringArray = isZigExpr && rlVal.includes('[') && rlVal.includes('..');
        if (isEvalExpr) {
          fmt += '{s}';
          args.push(rlVal);
        } else if (isNum) {
          fmt += '{d}';
          args.push(rlVal);
        } else if (isStringArray) {
          fmt += '{s}';
          args.push(rlVal);
        } else if (isZigExpr) {
          fmt += '{d}';
          args.push(leftFoldExpr(rlVal));
        } else {
          fmt += rlVal;
        }
      } else if (ctx.propStack[expr] !== undefined) {
        // Prop substitution — use the concrete prop value
        const propVal = ctx.propStack[expr];
        const isNum = /^-?\d+(\.\d+)?$/.test(propVal);
        const isZigExpr = propVal.includes('state.get') || propVal.includes('getSlot') || propVal.includes('_oa') || propVal.includes('@as');
        const isStringArray = isZigExpr && propVal.includes('[') && propVal.includes('..');
        if (isNum) {
          fmt += '{d}';
          args.push(propVal);
        } else if (isStringArray) {
          // String array slice: _oaN_field[_i][0.._oaN_field_lens[_i]]
          fmt += '{s}';
          args.push(propVal);
        } else if (isZigExpr) {
          // Other Zig expressions (OA integer fields, state getters)
          fmt += '{d}';
          args.push(leftFoldExpr(propVal));
        } else {
          // Plain string literal
          fmt += '{s}';
          args.push(`"${propVal}"`);
        }
      } else if (ctx.currentMap && expr === ctx.currentMap.indexParam) {
        // Map index: use iterVar so inline inner maps use _j, outer maps use _i
        const iv = ctx.currentMap.iterVar || '_i';
        fmt += '{d}';
        args.push('@as(i64, @intCast(' + iv + '))');
      } else if (ctx.currentMap && ctx.currentMap.parentMap && expr === ctx.currentMap.parentMap.indexParam) {
        // Parent map index parameter: ${parent_idx} → outer loop variable (inline: _i)
        const piv = ctx.currentMap.parentMap.iterVar || '_i';
        fmt += '{d}';
        args.push('@as(i64, @intCast(' + piv + '))');
      } else if (ctx.currentMap && expr.startsWith(ctx.currentMap.itemParam + '.')) {
        // Map item member access: ${item.field} → {s}/{d} with OA field ref
        let field = expr.slice(ctx.currentMap.itemParam.length + 1);
        const oa = ctx.currentMap.oa;
        // Handle item.field || 'fallback' — logical OR with string default
        let orFallback = null;
        const orMatch = field.match(/^(\w+)\s*\|\|\s*['"]([^'"]*)['"]\s*$/);
        if (orMatch) {
          field = orMatch[1];
          orFallback = orMatch[2];
        }
        const fi = oa.fields.find(f => f.name === field);
        const iv = ctx.currentMap.iterVar || '_i';
        if (fi) {
          const oaIdx = oa.oaIdx;
          if (fi.type === 'string') {
            fmt += '{s}';
            if (orFallback !== null) {
              args.push(`if (_oa${oaIdx}_${field}_lens[${iv}] > 0) _oa${oaIdx}_${field}[${iv}][0.._oa${oaIdx}_${field}_lens[${iv}]] else "${orFallback}"`);
            } else {
              args.push(`_oa${oaIdx}_${field}[${iv}][0.._oa${oaIdx}_${field}_lens[${iv}]]`);
            }
          } else {
            fmt += '{d}';
            args.push(`_oa${oaIdx}_${field}[${iv}]`);
          }
        } else {
          fmt += expr;
        }
      } else if (ctx.currentMap && ctx.currentMap.parentMap && expr.startsWith(ctx.currentMap.parentMap.itemParam + '.')) {
        // Parent map item member access: ${section.field} → {s}/{d} with parent OA field ref
        const pField = expr.slice(ctx.currentMap.parentMap.itemParam.length + 1);
        const pOa = ctx.currentMap.parentMap.oa;
        const pFi = pOa ? pOa.fields.find(f => f.name === pField) : null;
        const pIv = ctx.currentMap.parentMap.iterVar || '_i';
        if (pFi) {
          const pOaIdx = pOa.oaIdx;
          if (pFi.type === 'string') {
            fmt += '{s}';
            args.push(`_oa${pOaIdx}_${pField}[${pIv}][0.._oa${pOaIdx}_${pField}_lens[${pIv}]]`);
          } else {
            fmt += '{d}';
            args.push(`_oa${pOaIdx}_${pField}[${pIv}]`);
          }
        } else {
          fmt += expr;
        }
      } else if (expr.includes('?') && expr.includes(':')) {
        // Ternary expression in template literal
        const parseTernaryExpr = (e) => {
          const qIdx = e.indexOf('?');
          if (qIdx < 0) return { isLiteral: true, value: e.trim() };
          const condStr = e.slice(0, qIdx).trim();
          const rest = e.slice(qIdx + 1);
          let depth = 0;
          let colonIdx = -1;
          for (let ci = 0; ci < rest.length; ci++) {
            if (rest[ci] === '?') depth++;
            else if (rest[ci] === ':') {
              if (depth === 0) {
                colonIdx = ci;
                break;
              }
              depth--;
            }
          }
          if (colonIdx < 0) return { isLiteral: true, value: e.trim() };
          let trueStr = rest.slice(0, colonIdx).trim();
          let falseStr = rest.slice(colonIdx + 1).trim();
          const stripQ = (s) => (s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")) ? s.slice(1, -1) : null;
          let condZig = condStr;
          // Resolve OA .length → _oaN_len (before getter resolution to avoid partial match)
          for (const oa of ctx.objectArrays) {
            if (condZig.includes(oa.getter + '.length')) {
              condZig = condZig.replace(new RegExp('\\b' + oa.getter + '\\.length\\b', 'g'), '_oa' + oa.oaIdx + '_len');
            }
          }
          for (const s of ctx.stateSlots) {
            if (condStr.includes(s.getter)) {
              condZig = condZig.replace(new RegExp('\\b' + s.getter + '\\b', 'g'), slotGet(s.getter));
            }
          }
          condZig = condZig.replace(/===/g, '==').replace(/!==/g, '!=');
          const tv = stripQ(trueStr);
          const fv = stripQ(falseStr);
          if (tv !== null && fv !== null) {
            return { isLiteral: false, zigExpr: `if (${condZig}) "${tv}" else "${fv}"`, spec: '{s}' };
          }
          const fvParsed = parseTernaryExpr(falseStr);
          if (tv !== null && !fvParsed.isLiteral) {
            return { isLiteral: false, zigExpr: `if (${condZig}) "${tv}" else ${fvParsed.zigExpr}`, spec: '{s}' };
          }
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
          if (!ctx._jsEvalCount) ctx._jsEvalCount = 0;
          const evalBufId = ctx._jsEvalCount;
          ctx._jsEvalCount = evalBufId + 1;
          fmt += '{s}';
          const escaped = expr.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          args.push(`qjs_runtime.evalToString("String(${escaped})", &_eval_buf_${evalBufId})`);
        }
      } else if (ctx.currentMap) {
        const wrapper = expr.match(/^([A-Za-z_]\w*)\(([^(),]+)\)$/);
        if (wrapper && /^(String|format[A-Z]\w*)$/.test(wrapper[1])) {
          const innerExpr = wrapper[2].trim();
          if (innerExpr.startsWith(ctx.currentMap.itemParam + '.')) {
            const field = innerExpr.slice(ctx.currentMap.itemParam.length + 1).replace(/\./g, '_');
            const oa = ctx.currentMap.oa;
            const fi = oa && oa.fields.find(function(f) { return f.name === field; });
            const iv = ctx.currentMap.iterVar || '_i';
            if (fi && fi.type === 'string') {
              fmt += '{s}';
              args.push(`_oa${oa.oaIdx}_${field}[${iv}][0.._oa${oa.oaIdx}_${field}_lens[${iv}]]`);
            } else if (fi) {
              fmt += '{d}';
              args.push(`_oa${oa.oaIdx}_${field}[${iv}]`);
            } else {
              fmt += expr;
            }
          } else if (ctx.renderLocals && ctx.renderLocals[innerExpr] !== undefined) {
            const rlVal = ctx.renderLocals[innerExpr];
            const isStringArray = typeof rlVal === 'string' && rlVal.includes('[') && rlVal.includes('..');
            if (isStringArray) {
              fmt += '{s}';
              args.push(rlVal);
            } else {
              fmt += '{d}';
              args.push(leftFoldExpr(rlVal));
            }
          } else {
            fmt += expr;
          }
        } else if (expr.includes('(') && expr.includes(')')) {
          // Function call expression — evaluate via QuickJS at runtime
          if (!ctx._jsEvalCount) ctx._jsEvalCount = 0;
          const evalBufId = ctx._jsEvalCount;
          ctx._jsEvalCount = evalBufId + 1;
          fmt += '{s}';
          const escaped = expr.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          args.push(`qjs_runtime.evalToString("${escaped}", &_eval_buf_${evalBufId})`);
        } else {
          // Non-resolvable expression — embed as literal text
          fmt += expr;
        }
      } else if (expr.includes('(') && expr.includes(')')) {
        // Function call expression — evaluate via QuickJS at runtime
        if (!ctx._jsEvalCount) ctx._jsEvalCount = 0;
        const evalBufId = ctx._jsEvalCount;
        ctx._jsEvalCount = evalBufId + 1;
        fmt += '{s}';
        // Expand render-local references before embedding in eval string
        const expanded = (typeof expandRenderLocalRawExpr === 'function' && ctx._renderLocalRaw)
          ? expandRenderLocalRawExpr(expr) : expr;
        const escaped = expanded.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        args.push(`qjs_runtime.evalToString("${escaped}", &_eval_buf_${evalBufId})`);
      } else if (expr.includes('||') || expr.includes('&&')) {
        // Logical OR/AND expression — evaluate via QuickJS at runtime
        if (!ctx._jsEvalCount) ctx._jsEvalCount = 0;
        const evalBufId = ctx._jsEvalCount;
        ctx._jsEvalCount = evalBufId + 1;
        fmt += '{s}';
        const escaped = expr.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        args.push(`qjs_runtime.evalToString("String(${escaped})", &_eval_buf_${evalBufId})`);
      } else if (ctx.scriptBlock || globalThis.__scriptContent) {
        // Script available — evaluate via QuickJS at runtime instead of embedding as literal
        if (!ctx._jsEvalCount) ctx._jsEvalCount = 0;
        const evalBufId = ctx._jsEvalCount;
        ctx._jsEvalCount = evalBufId + 1;
        fmt += '{s}';
        const expanded = (typeof expandRenderLocalRawExpr === 'function' && ctx._renderLocalRaw)
          ? expandRenderLocalRawExpr(expr) : expr;
        const escaped = expanded.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        args.push(`qjs_runtime.evalToString("String(${escaped})", &_eval_buf_${evalBufId})`);
      } else {
        // Non-resolvable expression — embed as literal text
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
