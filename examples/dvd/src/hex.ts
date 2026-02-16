// Convert r,g,b (0-255) + alpha (0-1) to #rrggbbaa hex string.
// The Lua painter only parses hex colors, not CSS rgba() strings.
export function rgba(r: number, g: number, b: number, a: number): string {
  const hex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}${hex(a * 255)}`;
}
