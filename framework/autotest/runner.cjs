// .autotest runner. Consumes parsed AST + a harness/scene, executes
// verbs, reports pass/fail. Incremental subtree hashing keeps per-op
// cost at O(mutation) so 10k+ ops stay fast.

'use strict';

const fs = require('fs');
const path = require('path');
const scene = require('./scene.cjs');

class AutotestError extends Error {
  constructor(msg, stmt) { super(msg); this.stmt = stmt; }
}

function run(ast, harness, opts = {}) {
  const root = harness.root;
  const dispatch = harness.dispatch;
  const snapshots = new Map();
  const snapFilePath = opts.snapshotFile || null;
  if (snapFilePath && fs.existsSync(snapFilePath)) {
    const raw = JSON.parse(fs.readFileSync(snapFilePath, 'utf8'));
    for (const [k, v] of Object.entries(raw)) snapshots.set(k, v);
  }
  const stats = { ops: 0, asserts: 0, started: Date.now(), hashes: 0 };
  const trail = []; // last N { op, hash } — for failure forensics
  const maxTrail = 50;

  function record(op) {
    const h = scene.hashNode(root);
    stats.hashes++;
    trail.push({ op, hash: h, line: op.line });
    if (trail.length > maxTrail) trail.shift();
  }

  function execStmts(stmts, ctx) {
    for (const stmt of stmts) execStmt(stmt, ctx);
  }

  function execStmt(stmt, ctx) {
    stats.ops++;
    if (stmt.kind === 'block') {
      if (stmt.verb === 'repeat') {
        const n = Number(stmt.args[0]) || 0;
        for (let i = 0; i < n; i++) execStmts(stmt.body, Object.assign({}, ctx, { i }));
      } else if (stmt.verb === 'group') {
        execStmts(stmt.body, ctx);
      } else if (stmt.verb === 'with') {
        // User-settings override stubbed: no wiring yet. Execute body as-is.
        execStmts(stmt.body, ctx);
      } else {
        throw new AutotestError(`unknown block verb: ${stmt.verb}`, stmt);
      }
      return;
    }

    const args = stmt.args.map((a) => interp(a, ctx));

    switch (stmt.verb) {
      case 'expect': {
        stats.asserts++;
        if (!scene.findByText(root, String(args[0]))) fail(stmt, `expected text not found: "${args[0]}"`);
        break;
      }
      case 'expect_not': {
        stats.asserts++;
        if (scene.findByText(root, String(args[0]))) fail(stmt, `expected text should be absent: "${args[0]}"`);
        break;
      }
      case 'expect_count': {
        stats.asserts++;
        const want = Number(args[1]);
        const got = scene.countText(root, String(args[0]));
        if (got !== want) fail(stmt, `count "${args[0]}" expected ${want}, got ${got}`);
        break;
      }
      case 'expect_visible': {
        stats.asserts++;
        const n = scene.findById(root, String(args[0]));
        if (!n || (n.props && n.props.__hidden)) fail(stmt, `expected visible: ${args[0]}`);
        break;
      }
      case 'expect_hidden': {
        stats.asserts++;
        const n = scene.findById(root, String(args[0]));
        if (n && !(n.props && n.props.__hidden)) fail(stmt, `expected hidden: ${args[0]}`);
        break;
      }
      case 'expect_hash': {
        stats.asserts++;
        const got = scene.hashNode(root);
        if (got !== args[0]) fail(stmt, `scene hash mismatch: expected ${args[0]} got ${got}`);
        break;
      }
      case 'snapshot_hash': {
        snapshots.set(String(args[0]), scene.hashNode(root));
        break;
      }
      case 'diff_hash': {
        stats.asserts++;
        const want = snapshots.get(String(args[0]));
        const got = scene.hashNode(root);
        if (!want) snapshots.set(String(args[0]), got);
        else if (want !== got) fail(stmt, `snapshot "${args[0]}" drifted: want ${want.slice(0,12)}… got ${got.slice(0,12)}…`);
        break;
      }
      case 'click':      doClick(stmt, args, 'onPress'); break;
      case 'double_click': doClick(stmt, args, 'onPress'); doClick(stmt, args, 'onPress'); break;
      case 'right_click': doClick(stmt, args, 'onContextMenu'); break;
      case 'long_press': doClick(stmt, args, 'onLongPress'); break;
      case 'hover':      doTarget(stmt, args, 'onHover', {}); break;
      case 'press': {
        const key = String(args[0] || '');
        let target = ctx.focus;
        if (!target) {
          // No focus set — find the first node in the tree with an onKeyDown handler.
          scene.walk(root, (node) => {
            if (target) return false;
            if (node.props && typeof node.props.onKeyDown === 'function') { target = node; return false; }
          });
        }
        if (!target) fail(stmt, `press: no onKeyDown handler found`);
        dispatch(target, 'onKeyDown', { key });
        dispatch(target, 'onKeyUp', { key });
        break;
      }
      case 'type': {
        const text = String(args[0] || '');
        const n = ctx.focus;
        if (!n) fail(stmt, `type: no focused input`);
        const handler = n.props && (n.props.onChangeText || n.props.onInput);
        if (!handler) fail(stmt, `type: focused node has no onChangeText`);
        const prev = (n.props && n.props.value) || '';
        handler(prev + text);
        break;
      }
      case 'scroll': {
        const target = scene.findByText(root, String(args[0])) || root;
        dispatch(target, 'onScroll', { dx: Number(args[1]) || 0, dy: Number(args[2]) || 0 });
        break;
      }
      case 'tick': {
        const ms = Number(args[0]) || 0;
        // Flush microtasks + advance fake clock (clock is trivial here —
        // the harness doesn't install timers; ms is just forensic metadata).
        ctx.virtualClock = (ctx.virtualClock || 0) + ms;
        break;
      }
      case 'set_size': {
        // No-op without a layout engine in Node; recorded in trail.
        break;
      }
      case 'focus': {
        const n = scene.findByText(root, String(args[0]));
        if (!n) fail(stmt, `focus: no target for "${args[0]}"`);
        ctx.focus = n;
        dispatch(n, 'onFocus', {});
        break;
      }
      case 'wait_for': {
        const text = String(args[0]);
        if (!scene.findByText(root, text)) fail(stmt, `wait_for timeout: "${text}"`);
        break;
      }
      default:
        throw new AutotestError(`unknown verb: ${stmt.verb}`, stmt);
    }

    record(stmt);
  }

  function doClick(stmt, args, handlerName) {
    const target = scene.findPressableByText(root, String(args[0]));
    if (!target) fail(stmt, `${stmt.verb}: no target "${args[0]}"`);
    if (!dispatch(target, handlerName, {})) {
      // Fall back to onPress if specific handler missing.
      if (handlerName !== 'onPress' && !dispatch(target, 'onPress', {})) {
        fail(stmt, `${stmt.verb}: no handler on "${args[0]}"`);
      }
    }
  }

  function doTarget(stmt, args, handlerName, payload) {
    const target = scene.findByText(root, String(args[0]));
    if (!target) fail(stmt, `${stmt.verb}: no target "${args[0]}"`);
    dispatch(target, handlerName, payload);
  }

  function fail(stmt, msg) {
    const err = new AutotestError(`[line ${stmt.line}] ${stmt.verb}: ${msg}`, stmt);
    err.trail = trail.slice();
    err.stats = Object.assign({}, stats, { durationMs: Date.now() - stats.started });
    throw err;
  }

  function interp(arg, ctx) {
    if (typeof arg !== 'string') return arg;
    return arg.replace(/\$\{(\w+)\}/g, (_, name) => {
      if (Object.prototype.hasOwnProperty.call(ctx, name)) return String(ctx[name]);
      return '';
    });
  }

  const ctx = { focus: null, i: 0, virtualClock: 0 };
  execStmts(ast.body, ctx);

  if (snapFilePath) {
    const obj = {};
    for (const [k, v] of snapshots) obj[k] = v;
    fs.mkdirSync(path.dirname(snapFilePath), { recursive: true });
    fs.writeFileSync(snapFilePath, JSON.stringify(obj, null, 2) + '\n');
  }

  stats.durationMs = Date.now() - stats.started;
  stats.finalHash = scene.hashNode(root);
  return stats;
}

module.exports = { run, AutotestError };
