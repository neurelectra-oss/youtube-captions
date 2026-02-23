import { build } from 'esbuild';
import { cp, mkdir, writeFile } from 'node:fs/promises';

const shared = {
    entryPoints: ['src/index.js'],
    bundle: true,
    platform: 'node',
    target: 'node18',
    external: ['axios'],
    sourcemap: true,
};

await mkdir('dist/esm', { recursive: true });
await mkdir('dist/cjs', { recursive: true });

await build({ ...shared, format: 'esm', outdir: 'dist/esm' });
await build({ ...shared, format: 'cjs', outfile: 'dist/cjs/index.js' });

// Mark the CJS output directory as CommonJS so Node.js treats .js files as CJS
await writeFile('dist/cjs/package.json', JSON.stringify({ type: 'commonjs' }, null, 2));

// Copy TypeScript declarations to dist root
await cp('src/types.d.ts', 'dist/types.d.ts');

console.log('Build complete: dist/esm/index.js, dist/cjs/index.js, dist/types.d.ts');
