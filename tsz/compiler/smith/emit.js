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
  if (ctx.maps.length > 0) {
    // Pass 2: emit rebuild functions (all declarations are now above)
    for (const mi of mapOrder) {
      const m = ctx.maps[mi];
      if (m.isNested || m.isInline) continue; // nested/inline rebuilds inlined into parent
      const { mapPerItemDecls, mapDynTexts, mapHandlers } = _mapMeta[mi];
      let { innerCount, innerArr } = _mapMeta[mi];

      out += `fn _rebuildMap${mi}() void {\n`;
      out += `    _map_count_${mi} = @min(_oa${m.oaIdx}_len, MAX_MAP_${mi});\n`;
      out += `    _map_pool_${mi} = _pool_arena.allocator().alloc(Node, _map_count_${mi}) catch unreachable;\n`;
      out += `    for (0.._map_count_${mi}) |_i| {\n`;

      // Emit per-item text formatting
      for (const dt of mapDynTexts) {
        const ti = dt._mapTextIdx;
        out += `        _map_texts_${mi}_${ti}[_i] = std.fmt.bufPrint(&_map_text_bufs_${mi}_${ti}[_i], "${dt.fmtString}", .{ ${dt.fmtArgs} }) catch "";\n`;
      }

      // Pre-count how many .text = "" slots are in inner array vs per-item arrays
      // so we can assign dynTexts in JSX order (inner first, then per-item)
      if (typeof globalThis.__SMITH_DEBUG_MAP_TEXT !== 'undefined') {
        ctx._debugLines.push('[MAP_TEXT_DEBUG] map ' + mi + ': ' + mapDynTexts.length + ' dynTexts');
        for (let _dbi = 0; _dbi < mapDynTexts.length; _dbi++) {
          const _ddt = mapDynTexts[_dbi];
          ctx._debugLines.push('[MAP_TEXT_DEBUG]   dt[' + _dbi + '] bufId=' + _ddt.bufId + ' fmt="' + _ddt.fmtString + '" args="' + _ddt.fmtArgs + '"');
        }
        if (innerArr) {
          const _innerDecl2 = (m.mapArrayDecls || []).find(d => d.startsWith('var ' + innerArr)) || ctx.arrayDecls.find(d => d.startsWith('var ' + innerArr));
          ctx._debugLines.push('[MAP_TEXT_DEBUG]   innerArr=' + innerArr + ' decl=' + (_innerDecl2 ? _innerDecl2.substring(0, 200) : 'null'));
        }
        for (const _pid of m._mapPerItemDecls) {
          ctx._debugLines.push('[MAP_TEXT_DEBUG]   perItem=' + _pid.name + ' decl=' + _pid.decl.substring(0, 200));
        }
      }
      let innerTextSlots = 0;
      if (innerArr) {
        const innerDecl = (m.mapArrayDecls || []).find(d => d.startsWith(`var ${innerArr}`)) ||
                          ctx.arrayDecls.find(d => d.startsWith(`var ${innerArr}`));
        if (innerDecl) innerTextSlots = (innerDecl.match(/\.text = ""/g) || []).length;
      }

      // Fill per-item component arrays
      let dtConsumed = 0;
      // Per-item child arrays come FIRST in JSX depth-first order, inner array texts come LAST
      let dtSkippedForInner = 0;
      for (const pid of m._mapPerItemDecls) {
        const content = pid.decl.replace(/var \w+ = \[_\]Node\{ /, '').replace(/ \};.*$/, '');
        // Replace references to per-item arrays from ALL maps
        let fixedContent = content;
        for (let mj = 0; mj < ctx.maps.length; mj++) {
          const otherMap = ctx.maps[mj];
          if (!otherMap._mapPerItemDecls) continue;
          for (const pid2 of otherMap._mapPerItemDecls) {
            if (!otherMap.isNested && !otherMap.isInline) {
              fixedContent = fixedContent.replace(new RegExp(`&${pid2.name}\\b`, 'g'), `_pi_${pid2.name}_${mj}`);
            } else {
              fixedContent = fixedContent.replace(new RegExp(`&${pid2.name}\\b`, 'g'), `&_map_${pid2.name}_${mj}[_i]`);
            }
          }
        }
        // Replace tagged map text refs in this per-item array
        // Tags are "__mtN__" where N is the specific text buffer index
        for (const dt of mapDynTexts) {
          const ti = dt._mapTextIdx;
          fixedContent = fixedContent.replace(`"__mt${ti}__"`, `_map_texts_${mi}_${ti}[_i]`);
        }
        // Legacy fallback: replace any remaining untagged .text = "" sequentially
        let pidDtIdx = dtConsumed;
        while (pidDtIdx < mapDynTexts.length) {
          const dt = mapDynTexts[pidDtIdx];
          const ti = dt._mapTextIdx;
          const next = fixedContent.replace('.text = ""', `.text = _map_texts_${mi}_${ti}[_i]`);
          if (next === fixedContent) break;
          fixedContent = next;
          pidDtIdx++;
          dtConsumed++;
        }
        // Replace handler refs in per-item arrays with per-item handler string pointers
        // Must check ALL maps' handlers since nested map handlers may appear in parent per-item arrays
        const pidPressField = (ctx.scriptBlock || globalThis.__scriptContent) ? 'js_on_press' : 'lua_on_press';
        for (let mj = 0; mj < ctx.maps.length; mj++) {
          const allMH = ctx.handlers.filter(h => h.inMap && h.mapIdx === mj);
          for (let hi = 0; hi < allMH.length; hi++) {
            const mh = allMH[hi];
            if (mh.luaBody) {
              const escaped = mh.luaBody.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
              const escapedRegex = escaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              // Match both .lua_on_press and .js_on_press — parse.js emits js_on_press for script blocks
              const ptrReplacement = `.${pidPressField} = _map_lua_ptrs_${mj}_${hi}[_i]`;
              if (globalThis.__SMITH_DEBUG_MAP_PTRS) {
                print(`[MAP_PTR_WIRE] map=${mj} handler=${hi} field=${pidPressField} escaped="${escaped.substring(0,60)}..." replacing in fixedContent(len=${fixedContent.length})`);
              }
              fixedContent = fixedContent.replace(new RegExp(`\\.lua_on_press = "${escapedRegex}"`, 'g'), ptrReplacement);
              fixedContent = fixedContent.replace(new RegExp(`\\.js_on_press = "${escapedRegex}"`, 'g'), ptrReplacement);
            }
            const ptrReplacement2 = `.${pidPressField} = _map_lua_ptrs_${mj}_${hi}[_i]`;
            fixedContent = fixedContent.replace(new RegExp(`\\.on_press = ${mh.name}`, 'g'), ptrReplacement2);
          }
        }
        // Replace raw map index param (e.g. 'i') with Zig loop variable in ternary conditions
        const idxParam = m.indexParam || 'i';
        if (idxParam !== '_i') {
          fixedContent = fixedContent.replace(new RegExp(`\\b${idxParam}\\b`, 'g'), '@as(i64, @intCast(_i))');
        }
        out += `        const _pi_${pid.name}_${mi} = _pool_arena.allocator().alloc(Node, ${pid.elemCount}) catch unreachable;\n`;
        out += `        @memcpy(_pi_${pid.name}_${mi}, &[_]Node{ ${fixedContent} });\n`;
      }

      // Per-item conditionals (visibility toggling inside map components)
      for (const cond of ctx.conditionals) {
        if (!cond.arrName || !m._mapPerItemDecls) continue;
        // Skip conditionals that belong to a different map
        if (cond.inMap && cond.mapIdx !== undefined && cond.mapIdx !== mi) continue;
        const pid = m._mapPerItemDecls.find(p => p.name === cond.arrName);
        if (!pid) continue;
        const poolArr = `_pi_${cond.arrName}_${mi}`;
        // Resolve item.field references to OA field access
        let resolvedExpr = cond.condExpr;
        // DEBUG: trace map cond resolution
        if (resolvedExpr.includes('0.0')) ctx._debugLines.push('[MAP_COND_DEBUG] raw=' + resolvedExpr + ' arrName=' + cond.arrName + ' mapIdx=' + mi + ' itemParam=' + (m.itemParam || '?'));
        if (m.oa) {
          const itemParam = m.itemParam || 'item';
          for (const f of m.oa.fields) {
            resolvedExpr = resolvedExpr.replace(new RegExp(`${itemParam}\\.${f.name}`, 'g'), `_oa${m.oa.oaIdx}_${f.name}[_i]`);
          }
        }
        const isComparison = resolvedExpr.includes('==') || resolvedExpr.includes('!=') ||
          resolvedExpr.includes('>=') || resolvedExpr.includes('<=') ||
          resolvedExpr.includes(' > ') || resolvedExpr.includes(' < ') ||
          resolvedExpr.includes('std.mem.eql') || resolvedExpr.includes('getSlotBool');
        const wrapped = isComparison ? `((${resolvedExpr}))` : `((${resolvedExpr}) != 0)`;
        if (cond.kind === 'show_hide') {
          out += `        ${poolArr}[${cond.trueIdx}].style.display = if ${wrapped} .flex else .none;\n`;
        } else if (cond.kind === 'ternary_jsx') {
          out += `        ${poolArr}[${cond.trueIdx}].style.display = if ${wrapped} .flex else .none;\n`;
          out += `        ${poolArr}[${cond.falseIdx}].style.display = if ${wrapped} .none else .flex;\n`;
        }
      }

      // Per-item dynamic texts (text formatting inside map components)
      for (const dt of ctx.dynTexts) {
        if (dt.inMap) continue;  // inMap texts handled separately
        if (!dt.arrName || !m._mapPerItemDecls) continue;
        const pid = m._mapPerItemDecls.find(p => p.name === dt.arrName);
        if (!pid) continue;
        const poolArr = `_pi_${dt.arrName}_${mi}`;
        const dtF = dt.targetField || 'text';
        out += `        ${poolArr}[${dt.arrIndex}].${dtF} = std.fmt.bufPrint(&_dyn_buf_${dt.bufId}, "${dt.fmtString}", .{ ${dt.fmtArgs} }) catch "";\n`;
      }

      // Inline nested map rebuilds — for each nested map that belongs to this parent
      for (let nmi = 0; nmi < ctx.maps.length; nmi++) {
        const nm = ctx.maps[nmi];
        if (!nm.isNested || nm.parentOaIdx !== m.oaIdx) continue;
        const nestedOa = nm.oa;
        const cidx = nestedOa.oaIdx;
        // Build inner pool by filtering nested OA items by parentIdx
        out += `        // Nested map ${nmi}: ${nm.nestedField}\n`;
        out += `        _map_count_${nmi}[_i] = 0;\n`;
        out += `        for (0.._oa${cidx}_len) |_flat_j| {\n`;
        out += `            if (_oa${cidx}_parentIdx[_flat_j] == _i) {\n`;
        out += `                const _jj = _map_count_${nmi}[_i];\n`;
        out += `                if (_jj >= MAX_MAP_${nmi}) break;\n`;
        // Build nested pool node from template, replacing field refs
        let nestedPoolNode = nm.templateExpr;
        // Replace nested OA field refs: _oaX_field[_i] → _oaX_field[_flat_j]
        for (const cf of nestedOa.fields) {
          if (cf.type === 'string') {
            nestedPoolNode = nestedPoolNode.replace(
              new RegExp(`_oa${cidx}_${cf.name}\\[_i\\]\\[0\\.\\._{1}oa${cidx}_${cf.name}_lens\\[_i\\]\\]`, 'g'),
              `_oa${cidx}_${cf.name}[_flat_j][0.._oa${cidx}_${cf.name}_lens[_flat_j]]`
            );
          }
          nestedPoolNode = nestedPoolNode.replace(
            new RegExp(`_oa${cidx}_${cf.name}\\[_i\\]`, 'g'),
            `_oa${cidx}_${cf.name}[_flat_j]`
          );
        }
        // Replace nested map dynamic texts — use _flat_j for flat indexing
        const nestedMapDynTexts = ctx.dynTexts.filter(dt => dt.inMap && dt.mapIdx === nmi);
        for (const dt of nestedMapDynTexts) {
          const ti = dt._mapTextIdx;
          // Fix fmt args to use _flat_j instead of _i for nested OA access
          let fixedArgs = dt.fmtArgs;
          for (const cf of nestedOa.fields) {
            fixedArgs = fixedArgs.replace(
              new RegExp(`_oa${cidx}_${cf.name}\\[_i\\]`, 'g'),
              `_oa${cidx}_${cf.name}[_flat_j]`
            );
            fixedArgs = fixedArgs.replace(
              new RegExp(`_oa${cidx}_${cf.name}_lens\\[_i\\]`, 'g'),
              `_oa${cidx}_${cf.name}_lens[_flat_j]`
            );
          }
          out += `                _map_texts_${nmi}_${ti}[_flat_j] = std.fmt.bufPrint(&_map_text_bufs_${nmi}_${ti}[_flat_j], "${dt.fmtString}", .{ ${fixedArgs} }) catch "";\n`;
        }
        // Build per-item inner array from the shared children template
        const nestedMeta = _mapMeta[nmi];
        if (nestedMeta && nestedMeta.innerArr && nestedMeta.innerCount > 0) {
          // Find the shared array declaration to get the node template
          const sharedDecl = (nm.mapArrayDecls || []).find(d => d.startsWith(`var ${nestedMeta.innerArr}`)) ||
                             ctx.arrayDecls.find(d => d.startsWith(`var ${nestedMeta.innerArr}`));
          if (sharedDecl) {
            let innerContent = sharedDecl.replace(/var \w+ = \[_\]Node\{ /, '').replace(/ \};.*$/, '');
            // Replace tagged map text refs, then fallback to sequential for untagged
            for (const dt of nestedMapDynTexts) {
              const ti = dt._mapTextIdx;
              innerContent = innerContent.replace(`"__mt${ti}__"`, `_map_texts_${nmi}_${ti}[_flat_j]`);
            }
            for (const dt of nestedMapDynTexts) {
              const ti = dt._mapTextIdx;
              innerContent = innerContent.replace('.text = ""', `.text = _map_texts_${nmi}_${ti}[_flat_j]`);
            }
            out += `                _map_inner_${nmi}[_flat_j] = [${nestedMeta.innerCount}]Node{ ${innerContent} };\n`;
            // Replace children ref in pool node to use per-item inner array
            nestedPoolNode = nestedPoolNode.replace(`&${nestedMeta.innerArr}`, `&_map_inner_${nmi}[_flat_j]`);
          }
        }
        // Replace handler refs + build per-item Lua ptrs with (parent_idx, item_idx)
        const nestedHandlers = ctx.handlers.filter(h => h.inMap && h.mapIdx === nmi);
        for (let nhi = 0; nhi < nestedHandlers.length; nhi++) {
          out += `                {\n`;
          out += `                    const _n = std.fmt.bufPrint(_map_lua_bufs_${nmi}_${nhi}[_flat_j][0..47], "__mapPress_${nmi}_${nhi}({d},{d})", .{_i, _jj}) catch "";\n`;
          out += `                    _map_lua_bufs_${nmi}_${nhi}[_flat_j][_n.len] = 0;\n`;
          out += `                    _map_lua_ptrs_${nmi}_${nhi}[_flat_j] = @ptrCast(_map_lua_bufs_${nmi}_${nhi}[_flat_j][0.._n.len :0]);\n`;
          out += `                }\n`;
          const mh = nestedHandlers[nhi];
          nestedPoolNode = nestedPoolNode.replace(`.lua_on_press = "${mh.luaBody ? mh.luaBody.replace(/\\/g, '\\\\').replace(/"/g, '\\"') : ''}"`, `.lua_on_press = _map_lua_ptrs_${nmi}_${nhi}[_flat_j]`);
          nestedPoolNode = nestedPoolNode.replace(`.on_press = ${mh.name}`, `.lua_on_press = _map_lua_ptrs_${nmi}_${nhi}[_flat_j]`);
        }
        out += `                _map_pool_${nmi}[_i][_jj] = ${nestedPoolNode};\n`;
        out += `                _map_count_${nmi}[_i] += 1;\n`;
        out += `            }\n`;
        out += `        }\n`;
      }

      // Inline map rebuilds — separate-OA maps inside this map's JSX template
      // Love2d pattern: inner loop runs per outer iteration, giving each parent independent child nodes
      for (let imi = 0; imi < ctx.maps.length; imi++) {
        const im = ctx.maps[imi];
        if (!im.isInline || im._parentMi !== mi) continue;
        const imMeta = _mapMeta[imi];
        if (!imMeta) continue;
        const imOa = im.oa;
        const imPressField = (ctx.scriptBlock || globalThis.__scriptContent) ? 'js_on_press' : 'lua_on_press';

        out += `        // inline map ${imi}: ${imOa.getter}.map (per-parent)\n`;
        out += `        _map_count_${imi}[_i] = @min(_oa${im.oaIdx}_len, MAX_MAP_${imi});\n`;
        out += `        {\n        var _j: usize = 0;\n        while (_j < _map_count_${imi}[_i]) : (_j += 1) {\n`;

        // Text formatting with [_i][_j], inner OA uses _j
        for (const dt of imMeta.mapDynTexts) {
          const ti = dt._mapTextIdx;
          let args = dt.fmtArgs;
          for (const f of imOa.fields) {
            args = args.replace(new RegExp(`_oa${im.oaIdx}_${f.name}\\[_i\\]\\[0\\.\\._{1}oa${im.oaIdx}_${f.name}_lens\\[_i\\]\\]`, 'g'),
              `_oa${im.oaIdx}_${f.name}[_j][0.._oa${im.oaIdx}_${f.name}_lens[_j]]`);
            args = args.replace(new RegExp(`_oa${im.oaIdx}_${f.name}_lens\\[_i\\]`, 'g'), `_oa${im.oaIdx}_${f.name}_lens[_j]`);
            args = args.replace(new RegExp(`_oa${im.oaIdx}_${f.name}\\[_i\\]`, 'g'), `_oa${im.oaIdx}_${f.name}[_j]`);
          }
          args = args.replace(/@as\(i64, @intCast\(_i\)\)/g, '@as(i64, @intCast(_j))');
          out += `            _map_texts_${imi}_${ti}[_i][_j] = std.fmt.bufPrint(&_map_text_bufs_${imi}_${ti}[_i][_j], "${dt.fmtString}", .{ ${args} }) catch "";\n`;
        }

        // Per-item array fills with content fixup
        // IMPORTANT: handler replacement FIRST (before _i→_j), since handler body
        // strings in declarations match the original pre-fixup content
        let imDtConsumed = 0;
        for (const pid of imMeta.mapPerItemDecls) {
          let content = pid.decl.replace(/var \w+ = \[_\]Node\{ /, '').replace(/ \};.*$/, '');
          // 1. Wire handler refs FIRST — match original handler body before content changes
          for (let hi = 0; hi < imMeta.mapHandlers.length; hi++) {
            const mh = imMeta.mapHandlers[hi];
            if (mh.luaBody) {
              const escaped = mh.luaBody.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
              const escapedRegex = escaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              content = content.replace(new RegExp(`\\.lua_on_press = "${escapedRegex}"`, 'g'), `.${imPressField} = _map_lua_ptrs_${imi}_${hi}[_i][_j]`);
              content = content.replace(new RegExp(`\\.js_on_press = "${escapedRegex}"`, 'g'), `.${imPressField} = _map_lua_ptrs_${imi}_${hi}[_i][_j]`);
            }
            content = content.replace(new RegExp(`\\.on_press = ${mh.name}`, 'g'), `.${imPressField} = _map_lua_ptrs_${imi}_${hi}[_i][_j]`);
          }
          // 2. Fix inner OA field refs: _i→_j
          for (const f of imOa.fields) {
            content = content.replace(new RegExp(`_oa${im.oaIdx}_${f.name}\\[_i\\]\\[0\\.\\._{1}oa${im.oaIdx}_${f.name}_lens\\[_i\\]\\]`, 'g'),
              `_oa${im.oaIdx}_${f.name}[_j][0.._oa${im.oaIdx}_${f.name}_lens[_j]]`);
            content = content.replace(new RegExp(`_oa${im.oaIdx}_${f.name}\\[_i\\]`, 'g'), `_oa${im.oaIdx}_${f.name}[_j]`);
          }
          content = content.replace(/@intCast\(_i\)/g, '@intCast(_j)');
          content = content.replace(/@as\(i64, @intCast\(_i\)\)/g, '@as(i64, @intCast(_j))');
          // 3. Fix per-item array refs to [_i][_j]
          for (const pid2 of imMeta.mapPerItemDecls) {
            content = content.replace(new RegExp(`&${pid2.name}\\b`, 'g'), `&_map_${pid2.name}_${imi}[_i][_j]`);
          }
          // 4. Wire tagged map text refs [_i][_j], then fallback sequential
          for (const dt of imMeta.mapDynTexts) {
            const ti = dt._mapTextIdx;
            content = content.replace(`"__mt${ti}__"`, `_map_texts_${imi}_${ti}[_i][_j]`);
          }
          while (imDtConsumed < imMeta.mapDynTexts.length) {
            const dt = imMeta.mapDynTexts[imDtConsumed];
            const ti = dt._mapTextIdx;
            const next = content.replace('.text = ""', `.text = _map_texts_${imi}_${ti}[_i][_j]`);
            if (next === content) break;
            content = next;
            imDtConsumed++;
          }
          out += `            _map_${pid.name}_${imi}[_i][_j] = [${pid.elemCount}]Node{ ${content} };\n`;
        }

        // Handler pointer building
        for (let hi = 0; hi < imMeta.mapHandlers.length; hi++) {
          out += `            {\n`;
          out += `                const _n = std.fmt.bufPrint(_map_lua_bufs_${imi}_${hi}[_i][_j][0..47], "__mapPress_${imi}_${hi}({d})", .{_j}) catch "";\n`;
          out += `                _map_lua_bufs_${imi}_${hi}[_i][_j][_n.len] = 0;\n`;
          out += `                _map_lua_ptrs_${imi}_${hi}[_i][_j] = @ptrCast(_map_lua_bufs_${imi}_${hi}[_i][_j][0.._n.len :0]);\n`;
          out += `            }\n`;
        }

        // Inner array construction
        if (imMeta.innerArr && imMeta.innerCount > 0) {
          const sharedDecl = (im.mapArrayDecls || []).find(d => d.startsWith(`var ${imMeta.innerArr}`)) ||
                             ctx.arrayDecls.find(d => d.startsWith(`var ${imMeta.innerArr}`));
          if (sharedDecl) {
            let ic = sharedDecl.replace(/var \w+ = \[_\]Node\{ /, '').replace(/ \};.*$/, '');
            for (const f of imOa.fields) {
              ic = ic.replace(new RegExp(`_oa${im.oaIdx}_${f.name}\\[_i\\]\\[0\\.\\._{1}oa${im.oaIdx}_${f.name}_lens\\[_i\\]\\]`, 'g'),
                `_oa${im.oaIdx}_${f.name}[_j][0.._oa${im.oaIdx}_${f.name}_lens[_j]]`);
              ic = ic.replace(new RegExp(`_oa${im.oaIdx}_${f.name}\\[_i\\]`, 'g'), `_oa${im.oaIdx}_${f.name}[_j]`);
            }
            ic = ic.replace(/@intCast\(_i\)/g, '@intCast(_j)');
            ic = ic.replace(/@as\(i64, @intCast\(_i\)\)/g, '@as(i64, @intCast(_j))');
            for (const pid of imMeta.mapPerItemDecls) {
              ic = ic.replace(new RegExp(`&${pid.name}\\b`, 'g'), `&_map_${pid.name}_${imi}[_i][_j]`);
            }
            for (const dt of imMeta.mapDynTexts) {
              const ti = dt._mapTextIdx;
              ic = ic.replace(`"__mt${ti}__"`, `_map_texts_${imi}_${ti}[_i][_j]`);
              ic = ic.replace('.text = ""', `.text = _map_texts_${imi}_${ti}[_i][_j]`);
            }
            for (let hi = 0; hi < imMeta.mapHandlers.length; hi++) {
              const mh = imMeta.mapHandlers[hi];
              if (mh.luaBody) {
                const escaped = mh.luaBody.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
                const escapedRegex = escaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                ic = ic.replace(new RegExp(`\\.lua_on_press = "${escapedRegex}"`, 'g'), `.${imPressField} = _map_lua_ptrs_${imi}_${hi}[_i][_j]`);
                ic = ic.replace(new RegExp(`\\.js_on_press = "${escapedRegex}"`, 'g'), `.${imPressField} = _map_lua_ptrs_${imi}_${hi}[_i][_j]`);
              }
              ic = ic.replace(new RegExp(`\\.on_press = ${mh.name}`, 'g'), `.${imPressField} = _map_lua_ptrs_${imi}_${hi}[_i][_j]`);
            }
            out += `            _map_inner_${imi}[_i][_j] = [${imMeta.innerCount}]Node{ ${ic} };\n`;
          }
        }

        // Pool node
        let imPool = im.templateExpr;
        for (const f of imOa.fields) {
          imPool = imPool.replace(new RegExp(`_oa${im.oaIdx}_${f.name}\\[_i\\]`, 'g'), `_oa${im.oaIdx}_${f.name}[_j]`);
        }
        imPool = imPool.replace(/@intCast\(_i\)/g, '@intCast(_j)');
        if (imMeta.innerArr) imPool = imPool.replace(`&${imMeta.innerArr}`, `&_map_inner_${imi}[_i][_j]`);
        for (const pid of imMeta.mapPerItemDecls) {
          imPool = imPool.replace(new RegExp(`&${pid.name}\\b`, 'g'), `&_map_${pid.name}_${imi}[_i][_j]`);
        }
        for (let hi = 0; hi < imMeta.mapHandlers.length; hi++) {
          const mh = imMeta.mapHandlers[hi];
          if (mh.luaBody) {
            const escaped = mh.luaBody.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            imPool = imPool.replace(`.lua_on_press = "${escaped}"`, `.${imPressField} = _map_lua_ptrs_${imi}_${hi}[_i][_j]`);
            imPool = imPool.replace(`.js_on_press = "${escaped}"`, `.${imPressField} = _map_lua_ptrs_${imi}_${hi}[_i][_j]`);
          }
          imPool = imPool.replace(`.on_press = ${mh.name}`, `.${imPressField} = _map_lua_ptrs_${imi}_${hi}[_i][_j]`);
        }
        // Per-item conditionals for inline map (display:none toggling)
        // Resolve raw .tsz names in condition expressions:
        //   item.field → _oaX_field[_j], parentItem.field → _oaY_field[_i]
        //   innerIdx → @as(i64, @intCast(_j)), outerIdx → @as(i64, @intCast(_i))
        function resolveInlineCond(expr) {
          let r = expr;
          // Inner map item.field → _oaX_field[_j]
          if (imOa) {
            const ip = im.itemParam || 'item';
            for (const f of imOa.fields) {
              r = r.replace(new RegExp(`${ip}\\.${f.name}`, 'g'), `_oa${im.oaIdx}_${f.name}[_j]`);
              r = r.replace(new RegExp(`_oa${im.oaIdx}_${f.name}\\[_i\\]`, 'g'), `_oa${im.oaIdx}_${f.name}[_j]`);
            }
          }
          // Outer map item.field → _oaY_field[_i]
          if (m.oa) {
            const op = m.itemParam || 'col';
            for (const f of m.oa.fields) {
              r = r.replace(new RegExp(`${op}\\.${f.name}`, 'g'), `_oa${m.oa.oaIdx}_${f.name}[_i]`);
            }
          }
          // Index params: outer stays _i, inner becomes _j
          const outerIdx = m.indexParam || 'ci';
          const innerIdx = im.indexParam || 'ti';
          // Use placeholder to prevent overwrite: outer→__OUTER__, then inner→_j, then __OUTER__→_i
          r = r.replace(new RegExp(`\\b${outerIdx}\\b`, 'g'), '@as(i64, @intCast(__OUTER_IDX__))');
          r = r.replace(new RegExp(`\\b${innerIdx}\\b`, 'g'), '@as(i64, @intCast(_j))');
          // Inner OA _i refs already handled above (lines 1054-1059).
          // Any remaining @intCast(_i) are outer-scope references — leave as _i.
          // Restore outer index placeholder
          r = r.replace(/__OUTER_IDX__/g, '_i');
          return r;
        }
        for (const cond of ctx.conditionals) {
          if (!cond.arrName) continue;
          const pid = imMeta.mapPerItemDecls.find(p => p.name === cond.arrName);
          if (!pid) continue;
          const poolArr = `_map_${cond.arrName}_${imi}[_i][_j]`;
          let resolvedExpr = resolveInlineCond(cond.condExpr);
          if (cond.kind === 'show_hide') {
            out += `            ${poolArr}[${cond.trueIdx}].style.display = if ((${resolvedExpr})) .flex else .none;\n`;
          } else if (cond.kind === 'ternary_jsx') {
            const _w = (resolvedExpr.includes('==') || resolvedExpr.includes('!=') || resolvedExpr.includes('std.mem.eql') || resolvedExpr.includes('getSlotBool')) ? `((${resolvedExpr}))` : `((${resolvedExpr}) != 0)`;
            out += `            ${poolArr}[${cond.trueIdx}].style.display = if ${_w} .flex else .none;\n`;
            out += `            ${poolArr}[${cond.falseIdx}].style.display = if ${_w} .none else .flex;\n`;
          }
        }
        // Inner array conditionals (applied to _map_inner)
        if (imMeta.innerArr && imMeta.innerCount > 0) {
          for (const cond of ctx.conditionals) {
            if (!cond.arrName || cond.arrName !== imMeta.innerArr) continue;
            let resolvedExpr = resolveInlineCond(cond.condExpr);
            if (cond.kind === 'show_hide') {
              out += `            _map_inner_${imi}[_i][_j][${cond.trueIdx}].style.display = if ((${resolvedExpr})) .flex else .none;\n`;
            } else if (cond.kind === 'ternary_jsx') {
              const _w2 = (resolvedExpr.includes('==') || resolvedExpr.includes('!=') || resolvedExpr.includes('std.mem.eql') || resolvedExpr.includes('getSlotBool')) ? `((${resolvedExpr}))` : `((${resolvedExpr}) != 0)`;
              out += `            _map_inner_${imi}[_i][_j][${cond.trueIdx}].style.display = if ${_w2} .flex else .none;\n`;
              out += `            _map_inner_${imi}[_i][_j][${cond.falseIdx}].style.display = if ${_w2} .none else .flex;\n`;
            }
          }
        }

        // If inner node has display conditional and pool node doesn't, hoist display to pool
        if (!imPool.includes('.style')) {
          imPool = imPool.replace('.{', '.{ .style = .{},');
          out += `            _map_pool_${imi}[_i][_j] = ${imPool};\n`;
          out += `            _map_pool_${imi}[_i][_j].style.display = _map_inner_${imi}[_i][_j][0].style.display;\n`;
        } else {
          out += `            _map_pool_${imi}[_i][_j] = ${imPool};\n`;
        }
        out += `        }\n        }\n`;

        // Bind inline pool to parent's per-item array
        if (im.parentArr && _promotedToPerItem.has(im.parentArr)) {
          out += `        _pi_${im.parentArr}_${mi}[${im.childIdx}].children = _map_pool_${imi}[_i][0.._map_count_${imi}[_i]];\n`;
        }
      }

      // Emit inner array + pool node
      if (innerCount > 0) {
        // Build inner array items, replacing dynamic text refs
        let innerItems = [];
        if (innerArr) {
          const decl = (m.mapArrayDecls || []).find(d => d.startsWith(`var ${innerArr}`)) ||
                       ctx.arrayDecls.find(d => d.startsWith(`var ${innerArr}`));
          if (decl) {
            // Replace tagged map text refs in inner array — tags "__mtN__" wire precisely
            let inner = decl.replace(/var \w+ = \[_\]Node\{ /, '').replace(/ \};.*$/, '');
            for (const dt of mapDynTexts) {
              const ti = dt._mapTextIdx;
              inner = inner.replace(`"__mt${ti}__"`, `_map_texts_${mi}_${ti}[_i]`);
            }
            // Legacy fallback: replace any remaining untagged .text = "" sequentially
            for (let dti = dtConsumed; dti < dtConsumed + innerTextSlots && dti < mapDynTexts.length; dti++) {
              const dt = mapDynTexts[dti];
              const ti = dt._mapTextIdx;
              inner = inner.replace('.text = ""', `.text = _map_texts_${mi}_${ti}[_i]`);
            }
            // Replace references to per-item arrays from ALL maps
            for (let mj = 0; mj < ctx.maps.length; mj++) {
              const otherMap = ctx.maps[mj];
              if (!otherMap._mapPerItemDecls) continue;
              for (const pid of otherMap._mapPerItemDecls) {
                if (!otherMap.isNested && !otherMap.isInline) {
                  inner = inner.replace(new RegExp(`&${pid.name}\\b`, 'g'), `_pi_${pid.name}_${mj}`);
                } else {
                  inner = inner.replace(new RegExp(`&${pid.name}\\b`, 'g'), `&_map_${pid.name}_${mj}[_i]`);
                }
              }
            }
            // Replace nested map shared children refs with per-group pool slices
            for (let nmi = 0; nmi < ctx.maps.length; nmi++) {
              const nm = ctx.maps[nmi];
              if (!nm.isNested || nm.parentOaIdx !== m.oaIdx) continue;
              if (nm.parentArr && inner.includes(`&${nm.parentArr}`)) {
                inner = inner.replace(`&${nm.parentArr}`, `_map_pool_${nmi}[_i][0.._map_count_${nmi}[_i]]`);
              }
            }
            // Replace handler refs in inner array items with per-item handler string pointers
            // Must check ALL maps' handlers since nested map handlers may appear in parent inner arrays
            const innerPressField = (ctx.scriptBlock || globalThis.__scriptContent) ? 'js_on_press' : 'lua_on_press';
            for (let mj = 0; mj < ctx.maps.length; mj++) {
              const allMH = ctx.handlers.filter(h => h.inMap && h.mapIdx === mj);
              for (let hi = 0; hi < allMH.length; hi++) {
                const mh = allMH[hi];
                if (mh.luaBody) {
                  const escaped = mh.luaBody.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
                  const escapedRegex = escaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                  const ptrReplacement = `.${innerPressField} = _map_lua_ptrs_${mj}_${hi}[_i]`;
                  inner = inner.replace(new RegExp(`\\.lua_on_press = "${escapedRegex}"`, 'g'), ptrReplacement);
                  inner = inner.replace(new RegExp(`\\.js_on_press = "${escapedRegex}"`, 'g'), ptrReplacement);
                }
                inner = inner.replace(new RegExp(`\\.on_press = ${mh.name}`, 'g'), `.${innerPressField} = _map_lua_ptrs_${mj}_${hi}[_i]`);
              }
            }
            // Replace raw map index param with Zig loop variable in inner node ternaries
            const innerIdxParam = m.indexParam || 'i';
            if (innerIdxParam !== '_i') {
              inner = inner.replace(new RegExp(`\\b${innerIdxParam}\\b`, 'g'), '@as(i64, @intCast(_i))');
            }
            out += `        const _inner_${mi} = _pool_arena.allocator().alloc(Node, ${innerCount}) catch unreachable;\n`;
            out += `        @memcpy(_inner_${mi}, &[_]Node{ ${inner} });\n`;
          }
        }

        // Inner array conditionals (display toggling for conditionals on inner array children)
        // These are conditionals like {filter == 0 && <Box>...} inside a map template,
        // where the conditional target is a child of the inner array, not a per-item sub-array.
        if (innerArr) {
          for (const cond of ctx.conditionals) {
            if (!cond.arrName || cond.arrName !== innerArr) continue;
            let resolvedExpr = cond.condExpr;
            // Resolve any remaining item.field references to OA field access
            if (m.oa) {
              const itemParam = m.itemParam || 'item';
              for (const f of m.oa.fields) {
                resolvedExpr = resolvedExpr.replace(new RegExp(`${itemParam}\\.${f.name}`, 'g'), `_oa${m.oa.oaIdx}_${f.name}[_i]`);
              }
            }
            const isComp = resolvedExpr.includes('==') || resolvedExpr.includes('!=') ||
              resolvedExpr.includes('>=') || resolvedExpr.includes('<=') ||
              resolvedExpr.includes(' > ') || resolvedExpr.includes(' < ') ||
              resolvedExpr.includes('getSlotBool') || resolvedExpr.includes('std.mem.eql');
            if (cond.kind === 'show_hide') {
              const wrapped = isComp ? `(${resolvedExpr})` : `((${resolvedExpr}) != 0)`;
              out += `        _inner_${mi}[${cond.trueIdx}].style.display = if ${wrapped} .flex else .none;\n`;
            } else if (cond.kind === 'ternary_jsx') {
              const _w3 = isComp ? `(${resolvedExpr})` : `((${resolvedExpr}) != 0)`;
              out += `        _inner_${mi}[${cond.trueIdx}].style.display = if ${_w3} .flex else .none;\n`;
              out += `        _inner_${mi}[${cond.falseIdx}].style.display = if ${_w3} .none else .flex;\n`;
            }
          }
        }

        // Assign nested map children to the correct inner array slot
        for (let nmi = 0; nmi < ctx.maps.length; nmi++) {
          const nm = ctx.maps[nmi];
          if (!nm.isNested || nm.parentOaIdx !== m.oaIdx) continue;
          if (nm.parentArr) {
            // Find which inner array slot this nested map targets
            // nm.parentArr is the array name, nm.childIdx is the slot index
            // Check if parentArr is in the inner array
            const isInnerChild = innerArr && nm.parentArr === innerArr;
            if (isInnerChild) {
              out += `        _inner_${mi}[${nm.childIdx}].children = _map_pool_${nmi}[_i][0.._map_count_${nmi}[_i]];\n`;
            } else if (_promotedToPerItem.has(nm.parentArr)) {
              out += `        _pi_${nm.parentArr}_${mi}[${nm.childIdx}].children = _map_pool_${nmi}[_i][0.._map_count_${nmi}[_i]];\n`;
            } else {
              out += `        ${nm.parentArr}[${nm.childIdx}].children = _map_pool_${nmi}[_i][0.._map_count_${nmi}[_i]];\n`;
            }
          }
        }

        // Build pool node from template, replacing children ref + handler refs
        let poolNode = m.templateExpr;
        if (innerArr) {
          poolNode = poolNode.replace(`&${innerArr}`, `_inner_${mi}`);
        }
        // Replace per-item array refs in pool node from ALL maps
        for (let mj = 0; mj < ctx.maps.length; mj++) {
          const otherMap = ctx.maps[mj];
          if (!otherMap._mapPerItemDecls) continue;
          for (const pid of otherMap._mapPerItemDecls) {
            if (!otherMap.isNested && !otherMap.isInline) {
              poolNode = poolNode.replace(new RegExp(`&${pid.name}\\b`, 'g'), `_pi_${pid.name}_${mj}`);
            } else {
              poolNode = poolNode.replace(new RegExp(`&${pid.name}\\b`, 'g'), `&_map_${pid.name}_${mj}[_i]`);
            }
          }
        }
        // Replace handler refs with per-item handler string pointers
        // Use js_on_press when there's a <script> block (QuickJS dispatch)
        const pressField = (ctx.scriptBlock || globalThis.__scriptContent) ? 'js_on_press' : 'lua_on_press';
        if (typeof globalThis.__SMITH_DEBUG_MAP_TEXT !== 'undefined') {
          ctx._debugLines.push('[MAP_POOL_NODE] mi=' + mi + ' pressField=' + pressField + ' poolNode=' + poolNode.substring(0, 300));
        }
        for (let hi = 0; hi < mapHandlers.length; hi++) {
          const mh = mapHandlers[hi];
          const escaped = mh.luaBody ? mh.luaBody.replace(/\\/g, '\\\\').replace(/"/g, '\\"') : '';
          const ptrReplacement = `.${pressField} = _map_lua_ptrs_${mi}_${hi}[_i]`;
          if (globalThis.__SMITH_DEBUG_MAP_PTRS) {
            print(`[MAP_PTR_WIRE_POOL] map=${mi} handler=${hi} field=${pressField} escaped="${escaped.substring(0,60)}..." poolNode has lua_on_press=${poolNode.includes('.lua_on_press')} js_on_press=${poolNode.includes('.js_on_press')}`);
          }
          // Match both .lua_on_press and .js_on_press — parse.js emits js_on_press for script blocks
          poolNode = poolNode.replace(`.lua_on_press = "${escaped}"`, ptrReplacement);
          poolNode = poolNode.replace(`.js_on_press = "${escaped}"`, ptrReplacement);
          poolNode = poolNode.replace(`.on_press = ${mh.name}`, ptrReplacement);
        }
        // Swap field order: .children before .handlers in map pool nodes (matches reference)
        const hm = poolNode.match(/\.handlers = \.{[^}]+\}/);
        const cm = poolNode.match(/\.children = &[\w\[\]_]+/);
        if (hm && cm) {
          poolNode = poolNode.replace(hm[0] + ', ' + cm[0], cm[0] + ', ' + hm[0]);
        }
        // Build handler ptrs at rebuild time if handlers use OA field refs
        const fieldRefsMap = m._handlerFieldRefsMap || {};
        if (typeof globalThis.__SMITH_DEBUG_MAP_TEXT !== 'undefined') {
          ctx._debugLines.push('[MAP_HANDLER_DEBUG] map=' + mi + ' fieldRefsMap keys=' + JSON.stringify(Object.keys(fieldRefsMap)) + ' mapHandlers.length=' + mapHandlers.length);
          for (let _dhi = 0; _dhi < mapHandlers.length; _dhi++) {
            const _dmh = mapHandlers[_dhi];
            ctx._debugLines.push('[MAP_HANDLER_DEBUG]   handler[' + _dhi + '] name=' + _dmh.name + ' luaBody=' + (_dmh.luaBody || '').substring(0, 100) + ' fieldRefs=' + JSON.stringify(fieldRefsMap[_dhi] || []));
          }
        }
        for (let hi = 0; hi < mapHandlers.length; hi++) {
          const refs = fieldRefsMap[hi] || [];
          if (refs.length > 0) {
            const oaIdx = m.oa.oaIdx;
            const fmtParts = ['{d}'];
            const argParts = ['_i'];
            for (const f of refs) {
              if (f.type === 'string') {
                fmtParts.push("'{s}'");
                argParts.push(`_oa${oaIdx}_${f.name}[_i][0.._oa${oaIdx}_${f.name}_lens[_i]]`);
              } else {
                fmtParts.push('{d}');
                argParts.push(`_oa${oaIdx}_${f.name}[_i]`);
              }
            }
            const bufSize = 127;
            out += `        {\n`;
            out += `            const _n = std.fmt.bufPrint(_map_lua_bufs_${mi}_${hi}[_i][0..${bufSize}], "__mapPress_${mi}_${hi}(${fmtParts.join(',')})", .{${argParts.join(', ')}}) catch "";\n`;
            out += `            _map_lua_bufs_${mi}_${hi}[_i][_n.len] = 0;\n`;
            out += `            _map_lua_ptrs_${mi}_${hi}[_i] = @ptrCast(_map_lua_bufs_${mi}_${hi}[_i][0.._n.len :0]);\n`;
            out += `        }\n`;
          }
        }
        // Replace raw map index param (e.g. 'i') with Zig loop variable in pool node ternary conditions
        const poolIdxParam = m.indexParam || 'i';
        if (poolIdxParam !== '_i') {
          poolNode = poolNode.replace(new RegExp(`\\b${poolIdxParam}\\b`, 'g'), '@as(i64, @intCast(_i))');
        }
        // If inner node has display conditional and pool node doesn't, hoist display to pool
        // so hidden items don't occupy gap space in the parent container
        if (innerCount === 1 && !poolNode.includes('.display') && !poolNode.includes('.style')) {
          poolNode = poolNode.replace('.{', '.{ .style = .{},');
          out += `        _map_pool_${mi}[_i] = ${poolNode};\n`;
          out += `        _map_pool_${mi}[_i].style.display = _inner_${mi}[0].style.display;\n`;
        } else {
          out += `        _map_pool_${mi}[_i] = ${poolNode};\n`;
        }
      } else {
        // Single-node map template (no inner array) — wire dynamic text refs
        let tExpr = m.templateExpr;
        for (let dti = 0; dti < mapDynTexts.length; dti++) {
          const dt = mapDynTexts[dti];
          const ti = dt._mapTextIdx;
          tExpr = tExpr.replace(`"__mt${ti}__"`, `_map_texts_${mi}_${ti}[_i]`);
          tExpr = tExpr.replace('.text = ""', `.text = _map_texts_${mi}_${ti}[_i]`);
        }
        out += `        _map_pool_${mi}[_i] = ${tExpr};\n`;
      }

      // Deferred canvas attributes — dynamic gx/gy/d from map item fields
      if (m._deferredCanvasAttrs) {
        for (const da of m._deferredCanvasAttrs) {
          const oaIdx = m.oaIdx;
          const oaField = `_oa${oaIdx}_${da.oaField}`;
          if (da.type === 'string') {
            out += `        _map_pool_${mi}[_i].${da.zigField} = ${oaField}[_i][0..${oaField}_lens[_i]];\n`;
          } else {
            out += `        _map_pool_${mi}[_i].${da.zigField} = @floatFromInt(${oaField}[_i]);\n`;
          }
        }
      }
      out += `    }\n`;
      // Bind pool to parent array
      if (m.parentArr) {
        out += `    ${m.parentArr}[${m.childIdx}].children = _map_pool_${mi}[0.._map_count_${mi}];\n`;
      }
      out += `}\n\n`;
    }
  }

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
