import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    resolve: {
        alias: {
            // Force vitest to resolve the shared package from source, not dist
            '@xiri-facility-solutions/shared': path.resolve(__dirname, 'src/index.ts'),
        },
    },
    test: {
        include: ['src/__tests__/**/*.test.ts'],
    },
});
