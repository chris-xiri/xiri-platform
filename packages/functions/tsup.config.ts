import { defineConfig } from 'tsup';
import path from 'path';
import { cpSync, mkdirSync } from 'fs';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['cjs'],
    outDir: 'lib',
    clean: true,
    noExternal: ['@xiri/shared'],
    target: 'node18',
    sourcemap: true,
    bundle: true,
    splitting: false,
    onSuccess: async () => {
        // Copy non-JS assets (PDF templates, images) that tsup can't bundle
        const src = path.resolve(__dirname, '..', 'shared', 'src', 'templates');
        const dest = path.resolve(__dirname, 'lib', 'templates');
        mkdirSync(dest, { recursive: true });
        cpSync(src, dest, { recursive: true });
        console.log('[post-build] Copied templates/ → lib/templates/');
    },
    esbuildPlugins: [
        {
            name: 'resolve-shared-subpaths',
            setup(build) {
                // Resolve @xiri/shared/src/* to the actual source directory
                build.onResolve({ filter: /^@xiri\/shared\/src\// }, (args) => {
                    const subpath = args.path.replace('@xiri/shared/src/', '');
                    return {
                        path: path.resolve(__dirname, '..', 'shared', 'src', subpath + '.ts'),
                    };
                });
            },
        },
    ],
});
