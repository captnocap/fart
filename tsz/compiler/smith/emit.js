function emitOutput(rootExpr, file) {
  const basename = file.split('/').pop();
  const appName = basename.replace(/\.tsz$/, '');
  const hasState = ctx.stateSlots.length > 0;
  const hasDynText = ctx.dynCount > 0;
  const prefix = 'framework/';

  let out = '';
  const pfLane = ctx._preflight ? ctx._preflight.lane : 'unknown';
  const hasDynamicOA = ctx.objectArrays.some(o => !o.isConst && !o.isNested);
  const fastBuild = globalThis.__fastBuild === 1;
  const hasScriptRuntime = hasDynamicOA || ctx.scriptBlock || globalThis.__scriptContent;

  out += emitPreamble({
    basename: basename,
    pfLane: pfLane,
    prefix: prefix,
    hasState: hasState,
    hasDynamicOA: hasDynamicOA,
    fastBuild: fastBuild,
    hasScriptRuntime: hasScriptRuntime,
  });
  out += emitStateManifest(ctx, hasState);

  // Pre-scan: find top-level arrays that will be promoted to per-item in map pools
  // Build set of map parent arrays — these host map placeholders and must NOT be promoted
  // Only exclude parentArrs of flat (non-inline) maps from promotion.
  // Inline map parentArrs MUST be promoted so each parent iteration gets independent children.
  const _mapParentArrs = new Set();
  for (const m of ctx.maps) { if (m.parentArr && !m.isInline) _mapParentArrs.add(m.parentArr); }
  const _promotedToPerItem = new Set();
  for (const m of ctx.maps) {
    if (!m.mapArrayDecls) continue;
    const pendingDT = ctx.dynTexts.filter(dt => dt.inMap && dt.mapIdx === ctx.maps.indexOf(m));
    if (pendingDT.length === 0) continue;
    for (const decl of m.mapArrayDecls) {
      if (decl.includes('.text = ""')) {
        const nm = decl.match(/^var (_arr_\d+)/);
        if (nm) _promotedToPerItem.add(nm[1]);
      }
    }
    // Propagate: parent arrays within the map template that reference promoted arrays
    // IMPORTANT: Only propagate upward within mapArrayDecls, NOT top-level arrays.
    // Top-level arrays that reference map arrays are map PARENTS (contain the map slot),
    // not per-item arrays. Promoting them destroys the static tree above the map.
    const allDecls = [...m.mapArrayDecls, ...ctx.arrayDecls];
    let changed = true;
    while (changed) {
      changed = false;
      // Upward propagation: only within mapArrayDecls (arrays inside the map template)
      for (const decl of m.mapArrayDecls) {
        const nm = decl.match(/^var (_arr_\d+)/);
        if (!nm || _promotedToPerItem.has(nm[1])) continue;
        for (const pn of _promotedToPerItem) {
          if (decl.includes(`&${pn}`)) { _promotedToPerItem.add(nm[1]); changed = true; break; }
        }
      }
      // Downward propagation: children of promoted arrays (from any source)
      for (const pn of _promotedToPerItem) {
        const pDecl = allDecls.find(d => d.startsWith(`var ${pn} `));
        if (!pDecl) continue;
        const childRefs = pDecl.match(/&(_arr_\d+)/g);
        if (!childRefs) continue;
        for (const ref of childRefs) {
          const childName = ref.slice(1); // strip &
          if (!_promotedToPerItem.has(childName) && !_mapParentArrs.has(childName)) {
            _promotedToPerItem.add(childName);
            changed = true;
          }
        }
      }
    }
    // Inject promoted top-level arrays into mapArrayDecls so emit path creates per-item pools
    for (const decl of ctx.arrayDecls) {
      const nm = decl.match(/^var (_arr_\d+)/);
      if (nm && _promotedToPerItem.has(nm[1])) {
        if (!m.mapArrayDecls.some(d => d.startsWith(`var ${nm[1]}`))) {
          m.mapArrayDecls.push(decl);
        }
      }
    }
  }

  out += emitNodeTree(ctx, rootExpr, _promotedToPerItem);
  out += emitDynamicTextBuffers(ctx);

  // Emit Zig fns for non-map handlers (map handlers dispatch through QuickJS/Lua, no Zig stub needed)
  const nonMapHandlers = ctx.handlers.filter(h => !h.inMap);
  out += emitNonMapHandlers(nonMapHandlers);

  // Effect render functions — transpile JS onRender callbacks to Zig
  out += emitEffectRenders(ctx, prefix);

  out += emitObjectArrayInfrastructure(ctx, {
    fastBuild: fastBuild,
    prefix: prefix,
  });

  // Map pools — two passes: (1) all declarations, (2) all rebuild functions
  const mapPoolDecls = emitMapPoolDeclarations(ctx, _promotedToPerItem);
  const _mapMeta = mapPoolDecls.mapMeta;
  const mapOrder = mapPoolDecls.mapOrder;
  out += mapPoolDecls.out;
  out += emitMapPoolRebuilds(ctx, {
    mapMeta: _mapMeta,
    mapOrder: mapOrder,
    promotedToPerItem: _promotedToPerItem,
  });

  out = appendOrphanedMapArrays(out, ctx);

  if (nonMapHandlers.length > 0 && !out.endsWith('\n\n')) out += '\n';


  out += emitLogicBlocks(ctx);

  out += emitInitState(ctx);

  // _updateDynamicTexts (skip map-internal texts)
  // Build set of all per-item pool array names across all maps
  const _mapPoolArrayNames = new Set();
  for (const m of ctx.maps) {
    if (m._mapPerItemDecls) {
      for (const pid of m._mapPerItemDecls) _mapPoolArrayNames.add(pid.name);
    }
  }

  out += `fn _updateDynamicTexts() void {\n`;
  for (const dt of ctx.dynTexts) {
    if (dt.inMap) continue;
    // Skip if this dynText targets a map-scoped per-item array
    if (dt.arrName && _mapPoolArrayNames.has(dt.arrName)) continue;
    out += `    _dyn_text_${dt.bufId} = std.fmt.bufPrint(&_dyn_buf_${dt.bufId}, "${dt.fmtString}", .{ ${dt.fmtArgs} }) catch "";\n`;
    const dtField = dt.targetField || 'text';
    if (dt.arrName) {
      out += `    ${dt.arrName}[${dt.arrIndex}].${dtField} = _dyn_text_${dt.bufId};\n`;
    } else {
      out += `    _root.${dtField} = _dyn_text_${dt.bufId};\n`;
    }
  }
  // Color prop + dynamic style runtime assignments — merged and sorted by array index
  const dynUpdates = [];
  for (const dc of ctx.dynColors) {
    if (dc.arrName && _promotedToPerItem.has(dc.arrName)) continue;
    if (dc.arrName && dc.arrIndex >= 0) {
      const arrNum = parseInt(dc.arrName.replace('_arr_', ''));
      dynUpdates.push({ arrNum, arrIndex: dc.arrIndex, line: `    ${dc.arrName}[${dc.arrIndex}].text_color = ${dc.colorExpr};\n` });
    }
  }
  if (ctx.dynStyles && ctx.dynStyles.length > 0) {
    for (const ds of ctx.dynStyles) {
      // Skip dynStyles that reference _i (map loop var) — can't resolve in global update
      if (ds.expression && (ds.expression.includes('_i)') || ds.expression.includes('_i]') || ds.expression.includes('(_i'))) continue;
      // Skip dynStyles targeting arrays promoted to per-item in map pools
      if (ds.arrName && _promotedToPerItem.has(ds.arrName)) continue;
      if (ds.arrName && ds.arrIndex >= 0) {
        const arrNum = parseInt(ds.arrName.replace('_arr_', ''));
        const nodeFields = ['text_color', 'font_size', 'text'];
        const prefix = nodeFields.includes(ds.field) ? '' : 'style.';
        dynUpdates.push({ arrNum, arrIndex: ds.arrIndex, line: `    ${ds.arrName}[${ds.arrIndex}].${prefix}${ds.field} = ${ds.expression};\n` });
      } else {
        // No arrName — only target _root if the root node actually has this field
        const zigField = ds.field.replace(/([A-Z])/g, '_$1').toLowerCase();
        if (rootExpr.includes(zigField) || rootExpr.includes(ds.field)) {
          const nodeFields = ['text_color', 'font_size', 'text'];
          const prefix = nodeFields.includes(ds.field) ? '' : 'style.';
          dynUpdates.push({ arrNum: 99998, arrIndex: 0, line: `    _root.${prefix}${ds.field} = ${ds.expression};\n` });
        }
        // else: lost binding from map/component inlining — skip silently
      }
    }
  }
  dynUpdates.sort((a, b) => a.arrNum - b.arrNum || a.arrIndex - b.arrIndex);
  for (const u of dynUpdates) out += u.line;
  out += `}\n\n`;

  const hasConds = ctx.conditionals.length > 0;

  // _updateConditionals
  if (hasConds) {
    out += `fn _updateConditionals() void {\n`;
    for (const cond of ctx.conditionals) {
      if (!cond.arrName) continue;
      // Skip if this conditional is inside a map (handled per-item in map rebuild)
      if (cond.inMap) continue;
      // Skip if this conditional targets a map-scoped per-item array or uses _i
      if (_mapPoolArrayNames.has(cond.arrName)) continue;
      if (cond.condExpr.includes('[_i]') || cond.condExpr.includes('(_i)') || cond.condExpr.includes('task.') || cond.condExpr.includes('tag.') || cond.condExpr.includes(' ci') || cond.condExpr.includes(' ti')) continue;
      const isComparison = cond.condExpr.includes('==') || cond.condExpr.includes('!=') ||
        cond.condExpr.includes('>=') || cond.condExpr.includes('<=') ||
        cond.condExpr.includes(' > ') || cond.condExpr.includes(' < ') ||
        cond.condExpr.includes('getBool') || cond.condExpr.includes('getSlotBool') || cond.condExpr.includes('std.mem.eql');
      const wrapped = isComparison ? `((${cond.condExpr}))` : `((${cond.condExpr}) != 0)`;
      if (cond.kind === 'show_hide') {
        out += `    ${cond.arrName}[${cond.trueIdx}].style.display = if ${wrapped} .flex else .none;\n`;
      } else if (cond.kind === 'ternary_jsx') {
        out += `    ${cond.arrName}[${cond.trueIdx}].style.display = if ${wrapped} .flex else .none;\n`;
        out += `    ${cond.arrName}[${cond.falseIdx}].style.display = if ${wrapped} .none else .flex;\n`;
      }
    }
    out += `}\n\n`;
  }

  out += `\n`;

  // _updateVariants — runtime variant/bp style switching
  const hasVariants = ctx.variantBindings && ctx.variantBindings.length > 0;
  if (hasVariants) {
    const variantCount = ctx.variantNames.length + 1; // +1 for base
    out += `fn _updateVariants() void {\n`;
    const hasBp = ctx.variantBindings.some(vb => vb.bpStyles);
    if (fastBuild) {
      // Fast build: use api extern functions (shared state across .so boundary)
      if (hasBp) {
        out += `    const _bp_tier = @as(u8, api.breakpoint.rjit_breakpoint_current());\n`;
      }
      out += `    const _v = @as(usize, api.theme.rjit_theme_active_variant());\n`;
    } else {
      out += `    const _theme = @import("${prefix}theme.zig");\n`;
      if (hasBp) {
        out += `    const _bp = @import("${prefix}breakpoint.zig");\n`;
        out += `    const _bp_tier = @intFromEnum(_bp.current());\n`;
      }
      out += `    const _v = @as(usize, _theme.activeVariant());\n`;
    }
    // Helper: convert ".field = value, .field2 = value2" to individual assignments
    function styleAssignments(target, styleStr, indent) {
      if (!styleStr) return '';
      return styleStr.split(/,\s*(?=\.)/).map(function(f) {
        f = f.trim();
        if (!f.startsWith('.')) return '';
        var eqIdx = f.indexOf('=');
        if (eqIdx < 0) return '';
        var field = f.slice(1, eqIdx).trim();
        var value = f.slice(eqIdx + 1).trim();
        return `${indent}${target}.style.${field} = ${value};\n`;
      }).join('');
    }
    function nodeFieldAssignments(target, nfStr, indent) {
      if (!nfStr) return '';
      return nfStr.split(/,\s*(?=\.)/).map(function(f) {
        f = f.trim();
        if (!f.startsWith('.')) return '';
        var eqIdx = f.indexOf('=');
        if (eqIdx < 0) return '';
        var field = f.slice(1, eqIdx).trim();
        var value = f.slice(eqIdx + 1).trim();
        return `${indent}${target}.${field} = ${value};\n`;
      }).join('');
    }
    for (const vb of ctx.variantBindings) {
      // Skip map-internal bindings (handled per-item in map rebuild — future)
      if (vb.inMap) continue;
      // Skip bindings targeting promoted per-item arrays (inside map pools)
      if (vb.arrName && _promotedToPerItem.has(vb.arrName)) continue;
      // Skip unbound bindings inside inlined components (they don't have static addresses)
      if (!vb.arrName && vb.inComponent) continue;
      // Determine target: arrName[arrIndex] or _root for root node
      const target = vb.arrName ? `${vb.arrName}[${vb.arrIndex}]` : '_root';
      // Emit variant style selection — set individual fields to preserve parser-added fields
      if (vb.bpStyles) {
        // BP + variants: bp overrides take priority
        let bpBlock = '';
        if (vb.bpStyles.sm) {
          bpBlock += `    if (_bp_tier == 0) {\n${styleAssignments(target, vb.bpStyles.sm, '        ')}    }\n`;
        }
        if (vb.bpStyles.md) {
          const prefix2 = vb.bpStyles.sm ? '    else ' : '    ';
          bpBlock += `${prefix2}if (_bp_tier == 1) {\n${styleAssignments(target, vb.bpStyles.md, '        ')}    }\n`;
        }
        // Else: use variant-based style
        const elsePrefix = (vb.bpStyles.sm || vb.bpStyles.md) ? '    else ' : '    ';
        bpBlock += `${elsePrefix}{\n`;
        for (let vi = 0; vi < vb.styles.length; vi++) {
          if (vi === 0) {
            bpBlock += `        if (_v == 0) {\n${styleAssignments(target, vb.styles[0], '            ')}        }\n`;
          } else {
            bpBlock += `        else if (_v == ${vi}) {\n${styleAssignments(target, vb.styles[vi], '            ')}        }\n`;
          }
        }
        bpBlock += `    }\n`;
        out += bpBlock;
      } else {
        // Variants only (no bp): emit style fields
        for (let vi = 0; vi < vb.styles.length; vi++) {
          if (vi === 0) {
            out += `    if (_v == 0) {\n${styleAssignments(target, vb.styles[0], '        ')}    }\n`;
          } else {
            out += `    else if (_v == ${vi}) {\n${styleAssignments(target, vb.styles[vi], '        ')}    }\n`;
          }
        }
      }
      // Spacer fix: when a bp switches flex_direction to column, zero flex_grow on
      // pure-spacer children (empty Box with only flex_grow=1). Restore on row.
      if (vb.bpStyles) {
        const smIsCol = vb.bpStyles.sm && vb.bpStyles.sm.includes('.column');
        if (smIsCol) {
          // Find the children array for this node: look for .children = &_arr_N in the parent decl
          const parentDecl = ctx.arrayDecls.find(d => d.includes(`var ${vb.arrName} =`));
          if (parentDecl) {
            // Extract the node at vb.arrIndex — find its .children = &_arr_N
            const childArrMatch = parentDecl.match(new RegExp(`\\.children\\s*=\\s*&(_arr_\\d+)`));
            // Need to find the Nth node's children ref — simpler: scan all children refs
            const allChildRefs = [];
            const re = /\.children\s*=\s*&(_arr_\d+)/g;
            let m;
            while ((m = re.exec(parentDecl)) !== null) allChildRefs.push(m[1]);
            const childArr = allChildRefs[vb.arrIndex];
            if (childArr) {
              // Find spacers in that children array
              const childDecl = ctx.arrayDecls.find(d => d.includes(`var ${childArr} =`));
              if (childDecl) {
                // Find spacer-only nodes: .{ .style = .{ .flex_grow = 1 } }
                const nodeStr = childDecl.slice(childDecl.indexOf('[_]Node{') + 8);
                let idx = 0, bd = 0, ns = 0;
                for (let ci = 0; ci < nodeStr.length; ci++) {
                  if (nodeStr[ci] === '{') bd++;
                  if (nodeStr[ci] === '}') {
                    bd--;
                    if (bd === 0) {
                      const nc = nodeStr.slice(ns, ci + 1).trim();
                      if (/^\.{\s*\.style\s*=\s*\.{\s*\.flex_grow\s*=\s*1\s*}\s*}$/.test(nc)) {
                        out += `    if (_bp_tier == 0) { ${childArr}[${idx}].style.flex_grow = 0; }\n`;
                        out += `    else { ${childArr}[${idx}].style.flex_grow = 1; }\n`;
                      }
                      idx++;
                      ns = ci + 1;
                      while (ns < nodeStr.length && (nodeStr[ns] === ',' || nodeStr[ns] === ' ')) ns++;
                    }
                  }
                }
              }
            }
          }
        }
      }
      // Node fields (fontSize, textColor) per variant
      if (vb.nodeFieldStrs && vb.nodeFieldStrs.some(nf => nf.length > 0)) {
        for (let vi = 0; vi < vb.nodeFieldStrs.length; vi++) {
          if (!vb.nodeFieldStrs[vi]) continue;
          const nfParts = vb.nodeFieldStrs[vi].split(/,\s*(?=\.)/).filter(p => p.trim().startsWith('.'));
          for (const nf of nfParts) {
            const eqIdx = nf.indexOf('=');
            if (eqIdx < 0) continue;
            const field = nf.slice(1, eqIdx).trim(); // strip leading .
            const value = nf.slice(eqIdx + 1).trim();
            if (vi === 0) {
              out += `    if (_v == 0) { ${target}.${field} = ${value}; }\n`;
            } else {
              out += `    else if (_v == ${vi}) { ${target}.${field} = ${value}; }\n`;
            }
          }
        }
      }
    }
    // Map-internal variant patching: loop over pool nodes and set variant styles
    for (const vb of ctx.variantBindings) {
      if (!vb.inMap) continue;
      // Find which map this binding belongs to
      const mapIdx = ctx.maps.findIndex(m => !m.isNested && !m.isInline);
      if (mapIdx < 0) continue;
      // Skip if no variant has any style fields to patch (avoids empty loop with unused capture)
      const hasAnyStyleFields = vb.styles.some(function(s) {
        return s && s.split(/,\s*(?=\.)/).some(function(f) { return f.trim().startsWith('.'); });
      });
      if (!hasAnyStyleFields) continue;
      out += `    // Map variant patch: ${vb.clsName}\n`;
      out += `    for (0.._map_count_${mapIdx}) |_mi| {\n`;
      for (let vi = 0; vi < vb.styles.length; vi++) {
        if (!vb.styles[vi]) continue;
        const fields = vb.styles[vi].split(/,\s*(?=\.)/).filter(f => f.trim().startsWith('.'));
        const assignments = fields.map(function(f) {
          const eqIdx = f.indexOf('=');
          if (eqIdx < 0) return '';
          const field = f.trim().slice(1, eqIdx).trim();
          const value = f.slice(eqIdx + 1).trim();
          return `            _map_pool_${mapIdx}[_mi].style.${field} = ${value};\n`;
        }).join('');
        if (vi === 0) {
          out += `        if (_v == 0) {\n${assignments}        }\n`;
        } else {
          out += `        else if (_v == ${vi}) {\n${assignments}        }\n`;
        }
      }
      out += `    }\n`;
    }
    out += `}\n\n`;
  }

  // Input submit/change handler functions (onSubmit, onChangeText on TextInput)
  if (ctx._inputSubmitHandlers) {
    for (const h of ctx._inputSubmitHandlers) {
      out += `fn _inputSubmit${h.inputId}() void {\n`;
      out += `    qjs_runtime.evalExpr("${h.jsBody.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}");\n`;
      out += `}\n`;
    }
  }
  if (ctx._inputChangeHandlers) {
    for (const h of ctx._inputChangeHandlers) {
      out += `fn _inputChange${h.inputId}() void {\n`;
      out += `    qjs_runtime.evalExpr("${h.jsBody.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}");\n`;
      out += `}\n`;
    }
  }

  const hasDynStyles = ctx.dynStyles && ctx.dynStyles.length > 0;
  const _hasFlatMaps = ctx.maps.some(m => !m.isNested && !m.isInline);
  out += emitRuntimeEntrypoints(ctx, {
    appName: appName,
    prefix: prefix,
    fastBuild: fastBuild,
    hasState: hasState,
    hasDynText: hasDynText,
    hasConds: hasConds,
    hasVariants: hasVariants,
    hasDynStyles: hasDynStyles,
    hasFlatMaps: _hasFlatMaps,
  });

  return finalizeEmitOutput(out, file);
}
