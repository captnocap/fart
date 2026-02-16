/**
 * aliases.mjs — Shared esbuild alias resolution for @ilovereact/* imports
 *
 * Auto-detects which packages exist in ilovereact/ and generates --alias flags.
 * Used by both build.mjs and dev.mjs to keep alias logic DRY.
 *
 * Monorepo awareness: When building inside the monorepo (e.g. storybook/),
 * aliases resolve to the source-of-truth packages/ instead of local copies.
 * This prevents duplicate module instances when source files also use relative
 * imports to packages/ (the classic dual-context bug).
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

export const ALIAS_MAP = {
  shared: '@ilovereact/core',
  native: '@ilovereact/native',
  router: '@ilovereact/router',
  storage: '@ilovereact/storage',
  components: '@ilovereact/components',
  audio: '@ilovereact/audio',
  server: '@ilovereact/server',
  ai: '@ilovereact/ai',
};

/**
 * Generate esbuild --alias flags for packages that exist in ilovereact/
 * @param {string} cwd - Project root directory
 * @returns {string[]} Array of --alias:@ilovereact/pkg=<path>/src flags
 */
export function getEsbuildAliases(cwd) {
  const flags = [];
  for (const [dir, alias] of Object.entries(ALIAS_MAP)) {
    // In a monorepo, prefer the source-of-truth packages/ over local copies.
    // This prevents duplicate module instances when source files also use
    // relative imports to packages/ (e.g. ../../packages/shared/src).
    const monorepoSrc = join(cwd, '..', 'packages', dir, 'src');
    if (existsSync(monorepoSrc)) {
      flags.push(`--alias:${alias}=../packages/${dir}/src`);
      continue;
    }

    // Standalone project: use the local copy synced by `ilovereact update`
    const pkg = join(cwd, 'ilovereact', dir, 'src');
    if (existsSync(pkg)) {
      flags.push(`--alias:${alias}=./ilovereact/${dir}/src`);
    }
  }
  return flags;
}
