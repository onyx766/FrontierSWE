// Minimal flat config. `eslint-config-next` is installed and can be layered in
// once you decide which of its rule sets you want enforced in CI.
export default [
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', 'out/**'],
  },
];
