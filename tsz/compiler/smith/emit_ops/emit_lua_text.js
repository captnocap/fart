// Atom 23: Lua text content emission — emitLuaTextContent
// Extracted from emit/lua_maps.js lines 141-206

function _emitLuaQuoted(value) {
  return '"' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

function _readLuaGlyphAttrValue(c, itemParam) {
  if (c.kind() === TK.string) {
    var value = c.text().slice(1, -1);
    c.advance();
    return _emitLuaQuoted(value);
  }
  if (c.kind() === TK.number) {
    var n = c.text();
    c.advance();
    return n;
  }
  if (c.kind() === TK.identifier) {
    var ident = c.text();
    c.advance();
    return _jsExprToLua(ident, itemParam);
  }
  if (c.kind() === TK.lbrace) {
    c.advance();
    var parts = [];
    var depth = 0;
    while (c.pos < c.count && !(c.kind() === TK.rbrace && depth === 0)) {
      if (c.kind() === TK.lbrace) depth++;
      if (c.kind() === TK.rbrace) depth--;
      parts.push(c.text());
      c.advance();
    }
    if (c.kind() === TK.rbrace) c.advance();
    return _jsExprToLua(parts.join(' '), itemParam);
  }
  var fallback = c.text();
  c.advance();
  return _emitLuaQuoted(fallback);
}

function _emitLuaInlineGlyph(c, itemParam) {
  if (c.kind() !== TK.lt || c.pos + 1 >= c.count || c.textAt(c.pos + 1) !== 'Glyph') return null;

  c.advance(); // <
  c.advance(); // Glyph

  var glyph = {
    d: '""',
    fill: _emitLuaQuoted('#ffffff'),
    stroke: 'nil',
    stroke_width: '0',
    scale: '1.0',
    fill_effect: 'nil',
  };

  while (c.pos < c.count && c.kind() !== TK.gt && c.kind() !== TK.slash_gt) {
    if (c.kind() === TK.identifier) {
      var attrName = c.text();
      c.advance();
      if (c.kind() === TK.equals) {
        c.advance();
        var attrValue = _readLuaGlyphAttrValue(c, itemParam);
        if (attrName === 'd') glyph.d = attrValue;
        else if (attrName === 'fill') glyph.fill = attrValue;
        else if (attrName === 'stroke') glyph.stroke = attrValue;
        else if (attrName === 'strokeWidth') glyph.stroke_width = attrValue;
        else if (attrName === 'scale') glyph.scale = attrValue;
        else if (attrName === 'fillEffect') glyph.fill_effect = attrValue;
      }
    } else {
      c.advance();
    }
  }

  if (c.kind() === TK.slash_gt) {
    c.advance();
  } else if (c.kind() === TK.gt) {
    c.advance();
    while (c.pos < c.count) {
      if (c.kind() === TK.lt_slash) {
        c.advance();
        if (c.kind() === TK.identifier) c.advance();
        if (c.kind() === TK.gt) c.advance();
        break;
      }
      c.advance();
    }
  }

  var fields = ['d = ' + glyph.d, 'fill = ' + glyph.fill];
  if (glyph.stroke !== 'nil') fields.push('stroke = ' + glyph.stroke);
  if (glyph.fill_effect !== 'nil') fields.push('fill_effect = ' + glyph.fill_effect);
  fields.push('stroke_width = ' + glyph.stroke_width);
  fields.push('scale = ' + glyph.scale);
  return '{ ' + fields.join(', ') + ' }';
}

function emitLuaTextContent(c, itemParam) {
  // Collect text content until closing tag.
  // Handles: plain text, {item.field}, {`template ${item.field}`}, <Glyph />
  var parts = [];
  var inlineGlyphExprs = [];
  var _tcLastPos = -1;
  while (c.pos < c.count) {
    if (c.pos === _tcLastPos) { c.advance(); continue; }
    _tcLastPos = c.pos;
    if (c.kind() === TK.lt_slash) break; // closing tag

    if (c.kind() === TK.lt && c.pos + 1 < c.count && c.textAt(c.pos + 1) === 'Glyph') {
      var glyphExpr = _emitLuaInlineGlyph(c, itemParam);
      if (glyphExpr) {
        parts.push('string.char(1)');
        inlineGlyphExprs.push(glyphExpr);
        continue;
      }
    }

    if (c.kind() === TK.lt) break;

    if (c.kind() === TK.lbrace) {
      c.advance();
      if (c.kind() === TK.template_literal) {
        var raw = c.text().slice(1, -1);
        // Convert template literal to Lua concatenation
        var luaParts = [];
        var i = 0;
        while (i < raw.length) {
          if (raw[i] === '$' && i + 1 < raw.length && raw[i + 1] === '{') {
            var j = i + 2;
            var depth = 1;
            while (j < raw.length && depth > 0) {
              if (raw[j] === '{') depth++;
              if (raw[j] === '}') depth--;
              j++;
            }
            var expr = raw.slice(i + 2, j - 1).trim();
            expr = expr.replace(new RegExp('\\b' + itemParam + '\\b', 'g'), '_item');
            luaParts.push('tostring(' + expr + ')');
            i = j;
          } else {
            var start = i;
            while (i < raw.length && !(raw[i] === '$' && i + 1 < raw.length && raw[i + 1] === '{')) i++;
            var literal = raw.slice(start, i).replace(/"/g, '\\"');
            if (literal.length > 0) luaParts.push('"' + literal + '"');
          }
        }
        parts.push(luaParts.join(' .. '));
        c.advance();
      } else {
        // Brace expression: {item.field}
        var exprParts = [];
        var depth = 0;
        while (c.pos < c.count && !(c.kind() === TK.rbrace && depth === 0)) {
          if (c.kind() === TK.lbrace) depth++;
          if (c.kind() === TK.rbrace) depth--;
          exprParts.push(c.text());
          c.advance();
        }
        var expr = exprParts.join(' ');
        expr = expr.replace(new RegExp('\\b' + itemParam + '\\b', 'g'), '_item');
        parts.push('tostring(' + expr + ')');
      }
      if (c.kind() === TK.rbrace) c.advance();
    } else if (c.kind() === TK.string) {
      parts.push('"' + c.text().slice(1, -1) + '"');
      c.advance();
    } else if (c.kind() === TK.identifier || c.kind() === TK.number) {
      parts.push('"' + c.text() + '"');
      c.advance();
    } else {
      c.advance();
    }
  }

  return {
    textExpr: parts.length === 0 ? '""' : parts.join(' .. '),
    inlineGlyphExprs: inlineGlyphExprs,
  };
}
