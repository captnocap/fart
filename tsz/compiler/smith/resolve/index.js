// ── Resolve Layer ────────────────────────────────────────────────
// Shared resolvers for all pattern files and consumer files.
// Import from here, not from individual files.
//
// Usage in Smith JS (QuickJS context — no ESM, use global assignment):
//   resolveIdentity(name, ctx)
//   resolveField(resolved, field, ctx)
//   resolveComparison(lhs, op, rhs, ctx)
//   zigBool(expr, ctx)
//   zigTernary(cond, trueVal, falseVal, context)
//   buildEval(jsExpr, ctx)
//   buildBoolEval(jsExpr, ctx)
//   buildFieldEval(jsExpr, field, ctx)
//   buildComparisonEval(jsExpr, op, rhs, ctx)
//   extractInner(evalStr)
//   isEval(expr)
//   allocBuf(ctx)
//   normalizeOp(op)
//   stripQuotes(s)
//
// These are loaded into the QuickJS global scope by the smith bundle.
// Pattern files and consumer files can call them directly.
