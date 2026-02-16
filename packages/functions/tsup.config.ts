import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['cjs'],
    outDir: 'lib',
    clean: true,
    noExternal: ['@xiri/shared'], // Critical: Bundles shared code
    target: 'node18',
    sourcemap: true,
    bundle: true,
    splitting: false,
});
