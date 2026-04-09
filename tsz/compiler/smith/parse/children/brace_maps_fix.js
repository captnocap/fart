      // Parse JSX body into a node structure for emit_atoms/maps_lua to convert
      // Substitution of param names (_item→_nitem, etc) happens in _nodeToLua
      var _nmBodyNode = null;
      if (c.kind() === TK.lt || c.kind() === TK.lparen) {
        if (c.kind() === TK.lparen) c.advance(); // skip ( wrapping JSX
        // Temporarily set nested map context for parsing
        var _savedCtxMap = ctx.currentMap;
        ctx.currentMap = { itemParam: _nmParam, indexParam: _nmIdxParam, isNested: true };
        // Parse the JSX element using the standard element parser
        _nmBodyNode = _parseJsxForLuaMapBody(c);
        ctx.currentMap = _savedCtxMap;
        if (c.kind() === TK.rparen) c.advance(); // close ( wrapper
      }
