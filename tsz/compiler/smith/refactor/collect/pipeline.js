// ── Collection pipeline ──────────────────────────────────────────

function collectCompilerInputs(c) {
  collectScript(c);
  collectComponents(c);
  collectState(c);
  collectConstArrays(c);
  collectClassifiers();
  collectVariantNames();
}

function collectVariantNames() {
  for (var clsKey in ctx.classifiers) {
    var def = ctx.classifiers[clsKey];
    if (def.variants) {
      for (var vn of Object.keys(def.variants)) {
        if (ctx.variantNames.indexOf(vn) === -1) ctx.variantNames.push(vn);
      }
    }
  }
}
