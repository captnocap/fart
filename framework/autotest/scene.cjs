// Scene-graph model + incremental hashing for the autotest runner.
// A node is a plain object: { type, props, children, parent, __hash }.

'use strict';

const crypto = require('crypto');

function createNode(type, props) {
  return { type, props: props || {}, children: [], parent: null, __hash: null };
}

function createTextNode(text) {
  return { type: '#text', props: { text: String(text == null ? '' : text) }, children: [], parent: null, __hash: null };
}

function invalidate(node) {
  while (node) { node.__hash = null; node = node.parent; }
}

function appendChild(parent, child) {
  if (child.parent) removeChild(child.parent, child);
  child.parent = parent;
  parent.children.push(child);
  invalidate(parent);
}

function insertBefore(parent, child, beforeChild) {
  if (child.parent) removeChild(child.parent, child);
  const idx = parent.children.indexOf(beforeChild);
  child.parent = parent;
  if (idx < 0) parent.children.push(child);
  else parent.children.splice(idx, 0, child);
  invalidate(parent);
}

function removeChild(parent, child) {
  const idx = parent.children.indexOf(child);
  if (idx >= 0) parent.children.splice(idx, 1);
  child.parent = null;
  invalidate(parent);
}

function updateProps(node, nextProps) {
  node.props = nextProps || {};
  invalidate(node);
}

// ── canonicalize + hash ────────────────────────────────────────────
// Skip callbacks, refs, Symbols, and React-internal props. Sort keys.
const SKIP_PROPS = new Set(['children', 'ref', 'key']);

function canonProps(props) {
  const keys = Object.keys(props).filter((k) => !SKIP_PROPS.has(k)).sort();
  const out = {};
  for (const k of keys) {
    const v = props[k];
    if (typeof v === 'function') continue;
    if (typeof v === 'symbol') continue;
    if (typeof v === 'undefined') continue;
    out[k] = canonValue(v);
  }
  return out;
}

function canonValue(v) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(canonValue);
  const keys = Object.keys(v).sort();
  const o = {};
  for (const k of keys) {
    const val = v[k];
    if (typeof val === 'function' || typeof val === 'symbol' || typeof val === 'undefined') continue;
    o[k] = canonValue(val);
  }
  return o;
}

function hashNode(node) {
  if (node.__hash) return node.__hash;
  const h = crypto.createHash('sha256');
  h.update(String(node.type));
  h.update('');
  h.update(JSON.stringify(canonProps(node.props)));
  h.update('');
  for (const c of node.children) { h.update(hashNode(c)); }
  node.__hash = h.digest('hex');
  return node.__hash;
}

// ── traversal + lookup ─────────────────────────────────────────────

function walk(root, fn) {
  if (!root) return;
  if (fn(root) === false) return;
  for (const c of root.children) walk(c, fn);
}

function collectText(node) {
  const parts = [];
  walk(node, (n) => {
    if (n.type === '#text') parts.push(String(n.props.text || ''));
    const tl = n.props && (n.props.children);
    if (typeof tl === 'string' || typeof tl === 'number') parts.push(String(tl));
  });
  return parts.join(' ');
}

function nodeVisibleText(node) {
  return collectText(node).replace(/\s+/g, ' ').trim();
}

function countText(root, needle) {
  let n = 0;
  walk(root, (node) => {
    if (node.type === '#text' && String(node.props.text || '').includes(needle)) n++;
    const t = node.props && node.props.children;
    if ((typeof t === 'string' || typeof t === 'number') && String(t).includes(needle)) n++;
  });
  return n;
}

function findByText(root, needle) {
  // Find the smallest subtree whose visible text contains `needle`.
  // Strategy: among nodes that match, pick the one whose own direct text
  // content (text children + #text subtree leaves specific to it) matches,
  // else descend into the single matching child.
  function descend(node) {
    const here = nodeVisibleText(node);
    if (!here.includes(needle)) return null;
    let matchingChild = null;
    let matchCount = 0;
    for (const c of node.children) {
      if (nodeVisibleText(c).includes(needle)) { matchingChild = c; matchCount++; }
    }
    if (matchCount === 1 && matchingChild) return descend(matchingChild);
    // Either zero matching children (this is the tight match) or multiple
    // (the needle spans siblings — this node is still the tightest single owner).
    return node;
  }
  return descend(root);
}

function findPressableByText(root, needle) {
  // Walk up from the first text hit looking for a node with onPress/onClick.
  const hit = findByText(root, needle);
  let n = hit;
  while (n) {
    const p = n.props || {};
    if (typeof p.onPress === 'function' || typeof p.onClick === 'function') return n;
    n = n.parent;
  }
  return hit;
}

function findById(root, id) {
  let hit = null;
  walk(root, (n) => {
    if (hit) return false;
    const p = n.props || {};
    if (p['data-id'] === id || p.accessibilityId === id || p.id === id) { hit = n; return false; }
  });
  return hit;
}

module.exports = {
  createNode, createTextNode,
  appendChild, insertBefore, removeChild, updateProps, invalidate,
  hashNode, canonProps, canonValue,
  walk, collectText, nodeVisibleText, countText,
  findByText, findPressableByText, findById,
};
