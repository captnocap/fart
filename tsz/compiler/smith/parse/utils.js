// ── Shared parse utilities ────────────────────────────────────────

function resolveTag(name) {
  return htmlTags[name] || name;
}

function readTagToken(c) {
  let tag = c.text();
  c.advance();
  if (tag === '3' && c.kind() === TK.identifier && c.text() === 'D') {
    tag = '3D';
    c.advance();
  }
  return tag;
}

function readQualifiedClosingTag(c) {
  let closingTag = '?';
  if (c.kind() === TK.identifier) {
    closingTag = readTagToken(c);
  } else if (c.kind() === TK.number && c.text() === '3') {
    const maybe3d = readTagToken(c);
    if (maybe3d === '3D') closingTag = maybe3d;
  }

  let closingFull = closingTag;
  if (c.kind() === TK.dot) {
    c.advance();
    if (c.kind() === TK.identifier) {
      closingFull += '.' + c.text();
      c.advance();
    }
  }
  return closingFull;
}

// lastTokenOffset, skipBraces, offsetToLine — moved to parse/cursor.js
