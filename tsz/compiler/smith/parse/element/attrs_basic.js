// ── JSX basic attr helpers ───────────────────────────────────────

function tryParseBasicElementAttr(c, attr, rawTag, nodeFields, currentState) {
  let ascriptScript = currentState.ascriptScript;
  let ascriptOnResult = currentState.ascriptOnResult;

  if (rawTag === 'ascript' && attr === 'run') {
    if (c.kind() === TK.string) {
      ascriptScript = c.text().slice(1, -1);
      c.advance();
    } else if (c.kind() === TK.lbrace) {
      c.advance();
      if (c.kind() === TK.string) {
        ascriptScript = c.text().slice(1, -1);
        c.advance();
      }
      if (c.kind() === TK.rbrace) c.advance();
    }
    return { ascriptScript, ascriptOnResult };
  }

  if (rawTag === 'ascript' && attr === 'onResult') {
    if (c.kind() === TK.lbrace) {
      c.advance();
      if (c.kind() === TK.identifier) {
        ascriptOnResult = c.text();
        c.advance();
      }
      if (c.kind() === TK.rbrace) c.advance();
    } else if (c.kind() === TK.identifier) {
      ascriptOnResult = c.text();
      c.advance();
    }
    return { ascriptScript, ascriptOnResult };
  }

  if (attr === 'fontSize') {
    parseFontSizeAttr(c, nodeFields);
    return { ascriptScript, ascriptOnResult };
  }

  if (attr === 'textEffect') {
    if (c.kind() === TK.string) {
      nodeFields.push(`.text_effect = "${c.text().slice(1, -1)}"`);
      c.advance();
    }
    return { ascriptScript, ascriptOnResult };
  }

  if (attr === 'name' && rawTag === 'Effect') {
    if (c.kind() === TK.string) {
      nodeFields.push(`.effect_name = "${c.text().slice(1, -1)}"`);
      c.advance();
    }
    return { ascriptScript, ascriptOnResult };
  }

  if (attr === 'background' && rawTag === 'Effect') {
    nodeFields.push('.effect_background = true');
    // Skip the value if present (background={true} or just background)
    if (c.kind() === TK.lbrace) { c.advance(); if (c.kind() !== TK.rbrace) c.advance(); if (c.kind() === TK.rbrace) c.advance(); }
    return { ascriptScript, ascriptOnResult };
  }

  if (attr === 'value' && (rawTag === 'TextInput' || rawTag === 'TextArea')) {
    if (c.kind() === TK.lbrace) {
      c.advance();
      var _valParts = [];
      while (c.kind() !== TK.rbrace && c.kind() !== TK.eof) {
        var _pa = peekPropsAccess(c);
        if (_pa) {
          skipPropsAccess(c, _pa);
          _valParts.push(typeof _pa.value === 'string' ? _pa.value : String(_pa.value));
          continue;
        }
        if (c.kind() === TK.identifier && isGetter(c.text())) {
          // Store both Zig and raw getter name — build_node.js will resolve for Lua
          _valParts.push(slotGet(c.text()));
        } else if (c.kind() === TK.identifier && ctx.renderLocals && ctx.renderLocals[c.text()] !== undefined) {
          var _renderName = c.text();
          var _renderVal = ctx.renderLocals[_renderName];
          if (isEval(_renderVal)) {
            var _renderRaw = ctx._renderLocalRaw && ctx._renderLocalRaw[_renderName];
            var _renderJs = extractRuntimeJsExpr(_renderVal, _renderRaw, _renderName);
            _valParts.push(_renderJs ? buildEval(_renderJs, ctx) : _renderVal);
          } else {
            _valParts.push(_renderVal);
          }
        } else {
          _valParts.push(c.text());
        }
        c.advance();
      }
      if (c.kind() === TK.rbrace) c.advance();
      var _valExpr = _valParts.join('');
      nodeFields.push('.text = ' + _valExpr);
    }
    return { ascriptScript, ascriptOnResult };
  }

  if (attr === 'multiline' && (rawTag === 'TextInput' || rawTag === 'TextArea')) {
    nodeFields.push('.multiline = true');
    if (c.kind() === TK.lbrace) { c.advance(); if (c.kind() !== TK.rbrace) c.advance(); if (c.kind() === TK.rbrace) c.advance(); }
    return { ascriptScript, ascriptOnResult };
  }

  if (attr === 'placeholder' && (rawTag === 'TextInput' || rawTag === 'TextArea')) {
    if (c.kind() === TK.string) {
      nodeFields.push(`.placeholder = "${c.text().slice(1, -1)}"`);
      c.advance();
    } else if (c.kind() === TK.lbrace) {
      skipBraces(c);
    }
    return { ascriptScript, ascriptOnResult };
  }

  return null;
}

function parseFontSizeAttr(c, nodeFields) {
  if (c.kind() === TK.lbrace) {
    c.advance();
    let fontSizeValue = null;
    if (c.kind() === TK.number) {
      fontSizeValue = parseFloat(c.text());
      c.advance();
    } else if (
      c.kind() === TK.identifier &&
      ctx.propStack &&
      ctx.propStack[c.text()] !== undefined &&
      /^\d+(\.\d+)?$/.test(ctx.propStack[c.text()])
    ) {
      fontSizeValue = parseFloat(ctx.propStack[c.text()]);
      c.advance();
    }

    if (fontSizeValue !== null) {
      if (c.kind() === TK.star && c.pos + 1 < c.count) {
        c.advance();
        if (c.kind() === TK.number) {
          fontSizeValue = Math.floor(fontSizeValue * parseFloat(c.text()));
          c.advance();
        }
      } else if (c.kind() === TK.slash && c.pos + 1 < c.count) {
        c.advance();
        if (c.kind() === TK.number) {
          fontSizeValue = Math.floor(fontSizeValue / parseFloat(c.text()));
          c.advance();
        }
      }
      nodeFields.push(`.font_size = ${fontSizeValue}`);
    }

    while (c.kind() !== TK.rbrace && c.kind() !== TK.eof) c.advance();
    if (c.kind() === TK.rbrace) c.advance();
    return;
  }

  if (c.kind() === TK.number) {
    nodeFields.push(`.font_size = ${c.text()}`);
    c.advance();
  } else if (c.kind() === TK.string) {
    nodeFields.push(`.font_size = ${c.text().slice(1, -1)}`);
    c.advance();
  }
}
