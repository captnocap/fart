// `scripts/autotest` thin Node entry point. Dispatches subcommands.

'use strict';

const fs = require('fs');
const path = require('path');
const React = require('react');

const { parse } = require('./parser.cjs');
const { mount } = require('./harness.cjs');
const { run, AutotestError } = require('./runner.cjs');

function resolveEntry(ast, testFilePath) {
  const entry = ast.directives.entry;
  if (!entry) throw new Error(`missing @entry directive in ${testFilePath}`);
  const abs = path.resolve(path.dirname(testFilePath), String(entry));
  // Try the literal path first, then common extensions. Node's require does
  // not auto-resolve .cjs/.mjs — we add them explicitly.
  const candidates = [abs, abs + '.cjs', abs + '.js', path.join(abs, 'index.cjs'), path.join(abs, 'index.js')];
  for (const c of candidates) {
    if (fs.existsSync(c)) return require(c);
  }
  throw new Error(`@entry ${entry}: none of ${candidates.join(', ')} exist`);
}

function runFile(testFilePath, opts) {
  const src = fs.readFileSync(testFilePath, 'utf8');
  const ast = parse(src);
  const entry = resolveEntry(ast, testFilePath);
  const component = entry.default || entry.component || entry;
  const props = (entry.props) || {};

  const harness = mount(React.createElement(component, props));
  const snapshotFile = testFilePath.replace(/\.autotest$/, '.autotest.snap');
  let report;
  try {
    const stats = run(ast, harness, { snapshotFile });
    report = { file: testFilePath, ok: true, stats };
  } catch (e) {
    if (e instanceof AutotestError) {
      report = { file: testFilePath, ok: false, error: e.message, trail: e.trail, stats: e.stats };
    } else {
      report = { file: testFilePath, ok: false, error: e.stack || String(e) };
    }
  } finally {
    harness.unmount();
  }
  return report;
}

function fmt(report) {
  const tag = report.ok ? 'PASS' : 'FAIL';
  const s = report.stats || {};
  const summary = `${tag}  ${report.file}  ops=${s.ops || 0} asserts=${s.asserts || 0} hashes=${s.hashes || 0} ${s.durationMs || 0}ms`;
  if (report.ok) return summary;
  const lines = [summary, '  ' + report.error];
  if (report.trail && report.trail.length) {
    const tail = report.trail.slice(-5);
    lines.push('  last ops:');
    for (const t of tail) lines.push(`    line ${t.line} ${t.op.verb} ${JSON.stringify(t.op.args || [])} → ${t.hash.slice(0, 12)}`);
  }
  return lines.join('\n');
}

function expandTargets(target) {
  const stat = fs.statSync(target);
  if (stat.isFile()) return [target];
  const out = [];
  function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      const s = fs.statSync(p);
      if (s.isDirectory()) walk(p);
      else if (p.endsWith('.autotest')) out.push(p);
    }
  }
  walk(target);
  return out.sort();
}

function cmdRun(args) {
  const target = args[0];
  if (!target) die('usage: autotest run <file-or-dir>');
  const files = expandTargets(target);
  let failed = 0;
  for (const f of files) {
    const r = runFile(f);
    console.log(fmt(r));
    if (!r.ok) failed++;
  }
  process.exit(failed ? 1 : 0);
}

function cmdStress(args) {
  const target = args[0];
  const iters = Number((args.find((a) => a.startsWith('--iters=')) || '--iters=10').split('=')[1]) || 10;
  if (!target) die('usage: autotest stress <file> [--iters=N]');
  const files = expandTargets(target);
  let failed = 0;
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    const ast = parse(src);
    const entry = resolveEntry(ast, f);
    const component = entry.default || entry.component || entry;
    const props = entry.props || {};
    const harness = mount(React.createElement(component, props));
    let lastHash = null;
    let err = null;
    let totalOps = 0;
    const t0 = Date.now();
    try {
      for (let i = 0; i < iters; i++) {
        const stats = run(ast, harness, {});
        totalOps += stats.ops;
        if (lastHash && stats.finalHash !== lastHash) {
          throw new AutotestError(`stress drift at iter ${i}: hash changed ${lastHash.slice(0,12)} → ${stats.finalHash.slice(0,12)}`, { line: 0, verb: 'stress', args: [] });
        }
        lastHash = stats.finalHash;
      }
    } catch (e) {
      err = e;
    } finally {
      harness.unmount();
    }
    const dur = Date.now() - t0;
    if (err) {
      console.log(`FAIL  ${f}  stress iters=${iters} totalOps=${totalOps} ${dur}ms — ${err.message}`);
      failed++;
    } else {
      console.log(`PASS  ${f}  stress iters=${iters} totalOps=${totalOps} ${dur}ms finalHash=${lastHash.slice(0,12)}`);
    }
  }
  process.exit(failed ? 1 : 0);
}

function cmdList(args) {
  const target = args[0] || 'cart';
  if (!fs.existsSync(target)) die(`no such directory: ${target}`);
  const files = expandTargets(target);
  for (const f of files) console.log(f);
}

function die(msg) { console.error(msg); process.exit(2); }

function main() {
  const [, , cmd, ...rest] = process.argv;
  switch (cmd) {
    case 'run': return cmdRun(rest);
    case 'stress': return cmdStress(rest);
    case 'list': return cmdList(rest);
    default:
      die('usage: autotest <run|stress|list> ...');
  }
}

main();
