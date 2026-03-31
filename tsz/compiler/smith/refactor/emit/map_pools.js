// Emit map-pool declarations and shared metadata for rebuild passes

function buildMapEmitOrder(ctx) {
  const mapOrder = [];
  for (let mi = 0; mi < ctx.maps.length; mi++) {
    if (!ctx.maps[mi].isNested && !ctx.maps[mi].isInline) mapOrder.push(mi);
  }
  for (let mi = 0; mi < ctx.maps.length; mi++) {
    if (ctx.maps[mi].isInline) mapOrder.push(mi);
  }
  for (let mi = 0; mi < ctx.maps.length; mi++) {
    if (ctx.maps[mi].isNested) mapOrder.push(mi);
  }
  return mapOrder;
}

function ensureMapHandlerFieldRefs(ctx) {
  for (let mapIdx = 0; mapIdx < ctx.maps.length; mapIdx++) {
    const map = ctx.maps[mapIdx];
    if (map._handlerFieldRefsMap) continue;
    const mapHandlers = ctx.handlers.filter(function(handler) {
      return handler.inMap && handler.mapIdx === mapIdx;
    });
    for (let hi = 0; hi < mapHandlers.length; hi++) {
      const handler = mapHandlers[hi];
      if (!handler.luaBody || map.isNested) continue;
      const objectArray = map.oa;
      const itemParam = map.itemParam;
      const fieldRefs = [];
      if (objectArray) {
        for (const field of objectArray.fields) {
          if (field.type === 'nested_array') continue;
          if (new RegExp(`\\b${itemParam}\\.${field.name}\\b`).test(handler.luaBody)) fieldRefs.push(field);
        }
      }
      if (!map._handlerFieldRefsMap) map._handlerFieldRefsMap = {};
      map._handlerFieldRefsMap[hi] = fieldRefs;
      map._handlerFieldRefs = fieldRefs;
    }
  }
}

function countTopLevelNodeDeclEntries(decl) {
  if (!decl) return 0;
  const content = decl.replace(/var \w+ = \[_\]Node\{ /, '').replace(/ \};.*$/, '');
  let depth = 0;
  let count = content.length > 0 ? 1 : 0;
  for (let ci = 0; ci < content.length; ci++) {
    if (content[ci] === '{') depth++;
    if (content[ci] === '}') depth--;
    if (content[ci] === ',' && depth === 0) count++;
  }
  return count;
}

function emitMapPoolDeclarations(ctx, promotedToPerItem) {
  const mapMeta = [];
  const mapOrder = buildMapEmitOrder(ctx);
  if (ctx.maps.length === 0) return { out: '', mapMeta: mapMeta, mapOrder: mapOrder };

  let out = `\n// ── Map pools ───────────────────────────────────────────────────\n`;
  const emittedMapArrays = new Set();
  const hasFlatMaps = ctx.maps.some(function(map) {
    return !map.isNested && !map.isInline;
  });

  if (hasFlatMaps) {
    out += `var _pool_arena: std.heap.ArenaAllocator = std.heap.ArenaAllocator.init(std.heap.page_allocator);\n`;
  }

  ensureMapHandlerFieldRefs(ctx);

  for (const mi of mapOrder) {
    const map = ctx.maps[mi];
    if (map.isNested) {
      const parentMap = ctx.maps.find(function(parent) {
        return parent.oaIdx === map.parentOaIdx && !parent.isNested;
      });
      const parentMi = parentMap ? ctx.maps.indexOf(parentMap) : 0;
      map._parentMi = parentMi;
      out += `const MAX_MAP_${mi}: usize = 64;\n`;
      out += `const MAX_FLAT_${mi}: usize = 4096;\n`;
      const parentPoolSize = parentMap && !parentMap.isNested ? 128 : 64;
      out += `const MAX_NESTED_OUTER_${mi}: usize = ${parentPoolSize};\n`;
      out += `var _map_pool_${mi}: [MAX_NESTED_OUTER_${mi}][MAX_MAP_${mi}]Node = undefined;\n`;
      out += `var _map_count_${mi}: [MAX_NESTED_OUTER_${mi}]usize = undefined;\n`;
    } else if (map.isInline) {
      const parentMi = ctx.maps.indexOf(map.parentMap);
      map._parentMi = parentMi;
      out += `const MAX_MAP_${mi}: usize = 16;\n`;
      out += `const MAX_INLINE_OUTER_${mi}: usize = 8;\n`;
      out += `var _map_pool_${mi}: [MAX_INLINE_OUTER_${mi}][MAX_MAP_${mi}]Node = undefined;\n`;
      out += `var _map_count_${mi}: [MAX_INLINE_OUTER_${mi}]usize = undefined;\n`;
    } else {
      out += `const MAX_MAP_${mi}: usize = 4096;\n`;
      out += `var _map_pool_${mi}: []Node = undefined;\n`;
      out += `var _map_count_${mi}: usize = 0;\n`;
    }

    const mapPerItemDecls = [];
    if (map.mapArrayDecls && map.mapArrayDecls.length > 0) {
      const declMap = {};
      for (const decl of map.mapArrayDecls) {
        const match = decl.match(/^var (_arr_\d+)/);
        if (match) declMap[match[1]] = decl;
      }

      const needsPerItem = new Set();
      for (const promotedName of promotedToPerItem) {
        if (declMap[promotedName]) needsPerItem.add(promotedName);
      }
      const pendingMapDynTexts = ctx.dynTexts.filter(function(dt) {
        return dt.inMap && dt.mapIdx === mi;
      });
      for (const entry of Object.entries(declMap)) {
        const name = entry[0];
        const decl = entry[1];
        if (decl.includes('[_i]') || decl.includes('_i)') || decl.includes('(_i')) {
          needsPerItem.add(name);
        }
        if (pendingMapDynTexts.length > 0 && (decl.includes('.text = ""') || /__mt\d+__/.test(decl))) {
          needsPerItem.add(name);
        }
      }

      const mapArrayNames = new Set(Object.keys(declMap));
      const staticOnlyNames = new Set();
      for (const decl of ctx.arrayDecls) {
        const match = decl.match(/^var (_arr_\d+)/);
        if (match && !mapArrayNames.has(match[1])) staticOnlyNames.add(match[1]);
      }

      for (const entry of Object.entries(declMap)) {
        const name = entry[0];
        if (staticOnlyNames.has(name)) continue;
        for (const otherEntry of Object.entries(declMap)) {
          const otherName = otherEntry[0];
          const otherDecl = otherEntry[1];
          if (otherName === name) continue;
          if (otherDecl.includes(`&${name}`)) {
            needsPerItem.add(name);
            break;
          }
        }
      }

      let changed = true;
      while (changed) {
        changed = false;
        for (const entry of Object.entries(declMap)) {
          const name = entry[0];
          const decl = entry[1];
          if (needsPerItem.has(name) || staticOnlyNames.has(name)) continue;
          for (const perItemName of needsPerItem) {
            if (decl.includes(`&${perItemName}`)) {
              needsPerItem.add(name);
              changed = true;
              break;
            }
          }
        }
      }

      for (const entry of Object.entries(declMap)) {
        const arrName = entry[0];
        const decl = entry[1];
        if (ctx.arrayDecls.some(function(arrayDecl) { return arrayDecl.startsWith(`var ${arrName}`); }) && !needsPerItem.has(arrName)) continue;
        if (emittedMapArrays.has(arrName)) continue;
        emittedMapArrays.add(arrName);
        const innerMatch = map.templateExpr ? map.templateExpr.match(/\.children = &(_arr_\d+)/) : null;
        if (innerMatch && arrName === innerMatch[1]) continue;
        if (needsPerItem.has(arrName)) {
          const elemCount = countTopLevelNodeDeclEntries(decl);
          mapPerItemDecls.push({ name: arrName, decl: decl, elemCount: elemCount });
          if (map.isInline) {
            out += `var _map_${arrName}_${mi}: [MAX_INLINE_OUTER_${mi}][MAX_MAP_${mi}][${elemCount}]Node = undefined;\n`;
          } else if (map.isNested) {
            out += `var _map_${arrName}_${mi}: [MAX_MAP_${mi}][${elemCount}]Node = undefined;\n`;
          }
        } else {
          out += decl + '\n';
        }
      }
    }
    map._mapPerItemDecls = mapPerItemDecls;

    const innerMatch = map.templateExpr.match(/\.children = &_arr_(\d+)/);
    const innerArr = innerMatch ? `_arr_${innerMatch[1]}` : null;
    let innerCount = 0;
    if (innerArr) {
      const innerDecl = (map.mapArrayDecls || []).find(function(decl) {
        return decl.startsWith(`var ${innerArr}`);
      }) || ctx.arrayDecls.find(function(decl) {
        return decl.startsWith(`var ${innerArr}`);
      });
      if (innerDecl) innerCount = countTopLevelNodeDeclEntries(innerDecl);
    }

    if (innerCount > 0) {
      if (map.isInline) {
        out += `var _map_inner_${mi}: [MAX_INLINE_OUTER_${mi}][MAX_MAP_${mi}][${innerCount}]Node = undefined;\n`;
      } else if (map.isNested) {
        out += `var _map_inner_${mi}: [MAX_FLAT_${mi}][${innerCount}]Node = undefined;\n`;
      }
    }

    const mapDynTexts = ctx.dynTexts.filter(function(dt) {
      return dt.inMap && dt.mapIdx === mi;
    });
    const texSizeConst = map.isNested ? `MAX_FLAT_${mi}` : map.isInline ? null : `MAX_MAP_${mi}`;
    const declaredBufIds = new Set();
    for (const dt of mapDynTexts) {
      dt._mapTextIdx = dt.bufId;
      if (declaredBufIds.has(dt.bufId)) continue;
      declaredBufIds.add(dt.bufId);
      if (map.isInline) {
        out += `var _map_text_bufs_${mi}_${dt.bufId}: [MAX_INLINE_OUTER_${mi}][MAX_MAP_${mi}][256]u8 = undefined;\n`;
        out += `var _map_texts_${mi}_${dt.bufId}: [MAX_INLINE_OUTER_${mi}][MAX_MAP_${mi}][]const u8 = undefined;\n`;
      } else {
        out += `var _map_text_bufs_${mi}_${dt.bufId}: [${texSizeConst}][256]u8 = undefined;\n`;
        out += `var _map_texts_${mi}_${dt.bufId}: [${texSizeConst}][]const u8 = undefined;\n`;
      }
    }

    const mapHandlers = ctx.handlers.filter(function(handler) {
      return handler.inMap && handler.mapIdx === mi;
    });
    if (mapHandlers.length > 0) {
      const luaSizeConst = map.isNested ? `MAX_FLAT_${mi}` : `MAX_MAP_${mi}`;
      for (let hi = 0; hi < mapHandlers.length; hi++) {
        const refsMap = map._handlerFieldRefsMap || {};
        const hasFieldRefs = refsMap[hi] && refsMap[hi].length > 0;
        const bufSize = hasFieldRefs ? 128 : 48;
        if (map.isInline) {
          out += `var _map_lua_bufs_${mi}_${hi}: [MAX_INLINE_OUTER_${mi}][MAX_MAP_${mi}][${bufSize}]u8 = undefined;\n`;
          out += `var _map_lua_ptrs_${mi}_${hi}: [MAX_INLINE_OUTER_${mi}][MAX_MAP_${mi}]?[*:0]const u8 = undefined;\n`;
        } else {
          out += `var _map_lua_bufs_${mi}_${hi}: [${luaSizeConst}][${bufSize}]u8 = undefined;\n`;
          out += `var _map_lua_ptrs_${mi}_${hi}: [${luaSizeConst}]?[*:0]const u8 = .{null} ** ${luaSizeConst};\n`;
        }
        if (!map.isNested && !map.isInline && !hasFieldRefs) {
          out += `fn _initMapLuaPtrs${mi}_${hi}() void {\n`;
          out += `    for (0..${luaSizeConst}) |_i| {\n`;
          out += `        const n = std.fmt.bufPrint(_map_lua_bufs_${mi}_${hi}[_i][0..${bufSize - 1}], "__mapPress_${mi}_${hi}({d})", .{_i}) catch continue;\n`;
          out += `        _map_lua_bufs_${mi}_${hi}[_i][n.len] = 0;\n`;
          out += `        _map_lua_ptrs_${mi}_${hi}[_i] = @ptrCast(_map_lua_bufs_${mi}_${hi}[_i][0..n.len :0]);\n`;
          out += `    }\n`;
          out += `}\n`;
        }
      }
    }

    mapMeta[mi] = {
      mapPerItemDecls: mapPerItemDecls,
      innerCount: innerCount,
      innerArr: innerArr,
      mapDynTexts: mapDynTexts,
      mapHandlers: mapHandlers,
    };
    map._mapPerItemDecls = mapPerItemDecls;
  }

  return { out: out, mapMeta: mapMeta, mapOrder: mapOrder };
}

function appendOrphanedMapArrays(out, ctx) {
  const declared = new Set();
  const declMatches = out.matchAll(/^var (_arr_\d+)/gm);
  for (const match of declMatches) declared.add(match[1]);

  const poolMatches = out.matchAll(/var _map_(_arr_\d+)_\d+/g);
  for (const match of poolMatches) declared.add(match[1]);

  const refMatches = out.matchAll(/&(_arr_\d+)\b/g);
  const missing = new Set();
  for (const match of refMatches) {
    if (!declared.has(match[1])) missing.add(match[1]);
  }

  if (missing.size > 0) {
    const allDecls = [].concat(ctx.arrayDecls);
    for (const map of ctx.maps) {
      if (map.mapArrayDecls) allDecls.push.apply(allDecls, map.mapArrayDecls);
      if (map._mapPerItemDecls) {
        for (const perItemDecl of map._mapPerItemDecls) allDecls.push(perItemDecl.decl);
      }
    }
    for (const decl of allDecls) {
      const match = decl.match(/^var (_arr_\d+)/);
      if (match && missing.has(match[1])) {
        out += decl + '\n';
        missing.delete(match[1]);
      }
    }
    for (const name of missing) {
      out += `var ${name} = [_]Node{ .{} }; // orphan stub\n`;
    }
  }

  const allRefs = [];
  for (const match of out.matchAll(/(?:&|\b)(_arr_\d+)\b/g)) allRefs.push(match[1]);
  const allDecls = new Set();
  for (const match of out.matchAll(/^var (_arr_\d+)/gm)) allDecls.add(match[1]);
  const stubs = [];
  for (const ref of allRefs) {
    if (!allDecls.has(ref)) {
      stubs.push(`var ${ref} = [_]Node{ .{} };\n`);
      allDecls.add(ref);
    }
  }
  if (stubs.length > 0) {
    const insertPoint = out.indexOf('var _root =');
    if (insertPoint >= 0) {
      out = out.slice(0, insertPoint) + stubs.join('') + out.slice(insertPoint);
    }
  }

  return out;
}
