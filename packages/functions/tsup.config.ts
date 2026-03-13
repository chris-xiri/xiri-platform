import { defineConfig } from 'tsup';
import path from 'path';

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
