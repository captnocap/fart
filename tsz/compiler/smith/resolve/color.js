// resolve/color.js — Color parsing utilities
// Extracted as-is from soup.js:1211, soup.js:1248

function soupStyleColorToRgb(raw) {
  if (!raw) return null;
  if (raw.charAt(0) === '#') return soupHexRgb(raw);
  var key = raw.toLowerCase();
  if (typeof namedColors !== 'undefined' && namedColors[key]) {
    var c = namedColors[key];
    return c[0] + ', ' + c[1] + ', ' + c[2];
  }
  if (key === 'blue') return '59, 130, 246';
  if (key === 'red') return '220, 38, 38';
  if (key === 'black') return '0, 0, 0';
  if (key === 'white') return '255, 255, 255';
  return null;
}

function soupHexRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
  if (hex.length !== 6) return null;
  return parseInt(hex.slice(0,2),16)+', '+parseInt(hex.slice(2,4),16)+', '+parseInt(hex.slice(4,6),16);
}
