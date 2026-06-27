//@ts-check
'use strict';

const esbuild = require('esbuild');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

async function main() {
    const ctx = await esbuild.context({
        entryPoints: ['src/extension.ts'],
        bundle: true,
        format: 'cjs',
        minify: production,
        sourcemap: !production,
        sourcesContent: false,
        platform: 'node',
        outfile: 'out/extension.js',
        external: ['vscode'],
    });

    if (watch) {
        await ctx.watch();
        console.log('[esbuild] watching for changes...');
    } else {
        await ctx.rebuild();
        await ctx.dispose();
        console.log('[esbuild] build complete →', production ? 'production' : 'development');
    }
}

main().catch(err => {
    console.error('[esbuild] build failed:', err);
    process.exit(1);
});
