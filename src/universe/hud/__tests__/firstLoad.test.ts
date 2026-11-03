import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The HUD is in the first-load bundle and is what a visitor sees before, or
 * without, WebGL. A single stray import, however indirect, would pull three.js
 * into that bundle, and nothing else would flag it: the page would still work.
 * So this walks the real import graph from the HUD's entry point.
 */

const HUD_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_ROOT = resolve(HUD_DIR, '../..');

const STATIC_IMPORT =
  /^\s*(?:import\s+(type\s+)?(?:[^'"]*from\s+)?|export\s+(type\s+)?(?:\*|\{[^}]*\})\s+from\s+)['"]([^'"]+)['"]/gm;

function resolveModule(specifier: string, importer: string): string | null {
  const base = specifier.startsWith('@/')
    ? join(SOURCE_ROOT, specifier.slice(2))
    : specifier.startsWith('.')
      ? resolve(dirname(importer), specifier)
      : null;
  if (!base) return null;

  for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      /* Try the next extension. */
    }
  }
  return null;
}

/** Bare package names reachable by runtime imports from `entry`. Type imports vanish at build. */
function reachablePackages(entry: string): Set<string> {
  const seen = new Set<string>();
  const packages = new Set<string>();
  const pending = [entry];

  for (let file = pending.pop(); file; file = pending.pop()) {
    if (seen.has(file)) continue;
    seen.add(file);

    for (const match of readFileSync(file, 'utf8').matchAll(STATIC_IMPORT)) {
      const [, typeImport, typeExport, specifier] = match;
      if (typeImport || typeExport || !specifier) continue;
      const local = resolveModule(specifier, file);
      if (local) pending.push(local);
      else if (!specifier.startsWith('.') && !specifier.startsWith('@/')) packages.add(specifier);
    }
  }
  return packages;
}

describe('the first-load HUD', () => {
  const entries = [
    join(HUD_DIR, 'UniverseHud.tsx'),
    ...readdirSync(HUD_DIR)
      .filter((name) => /\.tsx?$/.test(name))
      .map((name) => join(HUD_DIR, name)),
  ];

  it('reaches no 3D package through any chain of imports', () => {
    const packages = new Set(entries.flatMap((entry) => [...reachablePackages(entry)]));
    const banned = [...packages].filter(
      (name) => name === 'three' || name.startsWith('three/') || name.startsWith('@react-three/'),
    );
    expect(banned).toEqual([]);
  });

  it('does not add framer-motion to the bundle', () => {
    const packages = new Set(entries.flatMap((entry) => [...reachablePackages(entry)]));
    expect(packages.has('framer-motion')).toBe(false);
  });

  it('imports nothing from the scene', () => {
    for (const name of readdirSync(HUD_DIR).filter((entry) => /\.tsx?$/.test(entry))) {
      expect(readFileSync(join(HUD_DIR, name), 'utf8')).not.toMatch(/from '[^']*scene\//);
    }
  });
});
