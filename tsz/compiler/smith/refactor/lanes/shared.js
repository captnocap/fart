function finishParsedLane(nodeExpr, file, opts) {
  opts = opts || {};

  var pf = preflight(ctx);
  if (opts.logPreflight) {
    LOG_EMIT('L092', { lane: pf.lane, summary: Object.keys(pf.intents).filter(function(k) { return pf.intents[k]; }).join(',') });
    for (var wi = 0; wi < pf.warnings.length; wi++) LOG_EMIT('L091', { id: 'WARN', msg: pf.warnings[wi] });
    for (var ei = 0; ei < pf.errors.length; ei++) LOG_EMIT('L090', { id: 'FATAL', msg: pf.errors[ei] });
  }
  if (opts.debugPreflight && globalThis.__SMITH_DEBUG) {
    for (var i = 0; i < pf.warnings.length; i++) print('[preflight] WARN: ' + pf.warnings[i]);
    for (var j = 0; j < pf.errors.length; j++) print('[preflight] FATAL: ' + pf.errors[j]);
    print('[preflight] lane=' + pf.lane + ' ok=' + pf.ok);
  }
  if (!pf.ok) {
    return stampIntegrity(preflightErrorZig(pf, file));
  }

  ctx._preflight = pf;

  var zigOut = emitOutput(nodeExpr, file);
  if (opts.logEmit) {
    LOG_EMIT('L003', { bytes: zigOut.length });
    LOG_EMIT('L004', { file: file });
  }
  if (typeof zigOut === 'string' && zigOut.indexOf('__SPLIT_OUTPUT__') === 0) {
    return zigOut;
  }
  return stampIntegrity(zigOut);
}
