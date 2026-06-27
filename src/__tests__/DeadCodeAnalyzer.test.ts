// Regression tests for the dead-code false-negative bug.
//
// ROOT CAUSE:
//   getAllWorkspaceFiles() finds all *.{js,ts,jsx,tsx} in the workspace.
//   When a project has BOTH a TypeScript source file AND compiled JavaScript
//   output (e.g. paymentService.ts + paymentService.js, or files under out/
//   dist/ build/), the dead-code scanner concatenates both files into allText.
//
//   A named function like `deadFunctionOne` then appears TWICE in allText:
//     1. TypeScript source:  export function deadFunctionOne() {
//     2. Compiled JS output: function deadFunctionOne() {
//   Both match `\bdeadFunctionOne\s*(` → 2 matches → clears the `< 2` dead-code
//   threshold → function reported as LIVE even though it has zero callers.
//
// WHY genericClone<T> AND deadArrow ARE UNAFFECTED:
//   - genericClone<T>: TypeScript definition `function genericClone<T>(` does NOT
//     match `\bgenericClone\s*(` because `<T>` sits between name and `(`.
//     Compiled JS has `function genericClone(` → only 1 match total → dead.
//   - deadArrow: arrow definition `const deadArrow = () =>` never produces
//     `deadArrow(` in TS or JS → 0 matches in any corpus → dead.
//
// FIX:
//   1. getAllWorkspaceFiles() now excludes out/, dist/, build/, .next/, coverage/.
//   2. preferTsOverJs() removes JS/JSX files whenever a TS/TSX file with the
//      same base path exists (handles in-place compilation with no outDir).

import { preferTsOverJs, classifyFunctions } from '../analysis/DeadCodeAnalyzer';
import { WorkspaceFunctionInfo } from '../types';

// =============================================================================
// Helpers
// =============================================================================

function uri(fsPath: string): { fsPath: string } { return { fsPath }; }

function def(name: string): WorkspaceFunctionInfo {
    return { name, line: 0, character: 0, endLine: 0, filePath: '/src/file.ts', fileName: 'file.ts' };
}

// =============================================================================
// preferTsOverJs
// =============================================================================

describe('preferTsOverJs — removes compiled JS when TS counterpart exists', () => {
    it('keeps only .ts when both foo.ts and foo.js exist at the same path', () => {
        const files = [
            uri('/src/paymentService.ts'),
            uri('/src/paymentService.js'),   // compiled output alongside source
        ];
        const result = preferTsOverJs(files).map(f => f.fsPath);
        expect(result).toEqual(['/src/paymentService.ts']);
        expect(result).not.toContain('/src/paymentService.js');
    });

    it('keeps .js when no corresponding .ts exists (pure-JS project)', () => {
        const files = [
            uri('/src/utils.js'),
            uri('/src/index.js'),
        ];
        const result = preferTsOverJs(files).map(f => f.fsPath);
        expect(result).toEqual(['/src/utils.js', '/src/index.js']);
    });

    it('handles .jsx / .tsx pairs the same way', () => {
        const files = [
            uri('/src/Login.tsx'),
            uri('/src/Login.jsx'),
        ];
        const result = preferTsOverJs(files).map(f => f.fsPath);
        expect(result).toEqual(['/src/Login.tsx']);
    });

    it('keeps .ts files unconditionally', () => {
        const files = [
            uri('/src/auth.ts'),
            uri('/src/routes.ts'),
        ];
        const result = preferTsOverJs(files);
        expect(result).toHaveLength(2);
    });

    it('does NOT remove JS in a different directory (handled by glob exclusion)', () => {
        // out/paymentService.js has a DIFFERENT base path from src/paymentService.ts
        const files = [
            uri('/src/paymentService.ts'),
            uri('/out/paymentService.js'),  // different dir — glob exclusion owns this
        ];
        const result = preferTsOverJs(files).map(f => f.fsPath);
        // Both remain — caller should also set the glob exclude for out/**
        expect(result).toContain('/src/paymentService.ts');
        expect(result).toContain('/out/paymentService.js');
    });

    it('handles a mixed workspace with some TS-JS pairs and some JS-only files', () => {
        const files = [
            uri('/src/app.ts'),
            uri('/src/app.js'),         // companion → remove
            uri('/src/legacy.js'),      // no .ts → keep
            uri('/src/helpers.ts'),     // no companion .js → keep
        ];
        const result = preferTsOverJs(files).map(f => f.fsPath);
        expect(result).toContain('/src/app.ts');
        expect(result).not.toContain('/src/app.js');
        expect(result).toContain('/src/legacy.js');
        expect(result).toContain('/src/helpers.ts');
    });
});

// =============================================================================
// classifyFunctions — core dead-code threshold logic
// =============================================================================

describe('classifyFunctions — named function with zero callers is dead', () => {
    it('deadFunctionOne: definition gives 1 match → correctly dead', () => {
        const tsCorpus = [
            'export function deadFunctionOne() {',
            '    console.log("Nobody calls me");',
            '}',
        ].join('\n');

        const { dead, live } = classifyFunctions([def('deadFunctionOne')], tsCorpus);
        expect(dead.map(d => d.name)).toContain('deadFunctionOne');
        expect(live.map(d => d.name)).not.toContain('deadFunctionOne');
    });

    it('deadFunctionTwo: definition gives 1 match → correctly dead', () => {
        const tsCorpus = [
            'export function deadFunctionTwo() {',
            '    return Math.random();',
            '}',
        ].join('\n');

        const { dead, live } = classifyFunctions([def('deadFunctionTwo')], tsCorpus);
        expect(dead.map(d => d.name)).toContain('deadFunctionTwo');
        expect(live.map(d => d.name)).not.toContain('deadFunctionTwo');
    });

    it('named function with 1 caller: definition + call = 2 matches → correctly alive', () => {
        const corpus = [
            'export function processPayment(amount) { return amount; }',
            'const ok = processPayment(100);',
        ].join('\n');

        const { dead, live } = classifyFunctions([def('processPayment')], corpus);
        expect(live.map(d => d.name)).toContain('processPayment');
        expect(dead.map(d => d.name)).not.toContain('processPayment');
    });
});

// =============================================================================
// The bug scenario: compiled JS in allText doubles the match count
// =============================================================================

describe('classifyFunctions — compiled JS in corpus causes false negative', () => {
    const tsSource = [
        'export function deadFunctionOne() {',
        '    console.log("Nobody calls me");',
        '}',
    ].join('\n');

    // Simulates what compiled JavaScript looks like after tsc strips types
    const compiledJs = [
        '"use strict";',
        'Object.defineProperty(exports, "__esModule", { value: true });',
        'function deadFunctionOne() {',
        '    console.log("Nobody calls me");',
        '}',
        'exports.deadFunctionOne = deadFunctionOne;',
    ].join('\n');

    it('REGRESSION: TS source alone → 1 match → correctly dead', () => {
        const pattern = /\bdeadFunctionOne\s*\(/g;
        const matches = tsSource.match(pattern) ?? [];
        expect(matches.length).toBe(1);     // definition line only
        expect(matches.length < 2).toBe(true); // correctly dead
    });

    it('REGRESSION: TS + compiled JS corpus → 2 matches → FALSE NEGATIVE (the bug)', () => {
        const combinedCorpus = [tsSource, compiledJs].join('\n');
        const pattern = /\bdeadFunctionOne\s*\(/g;
        const matches = combinedCorpus.match(pattern) ?? [];
        // Both files contribute one match each — this is the bug
        expect(matches.length).toBe(2);
        expect(matches.length < 2).toBe(false); // incorrectly alive without the fix
    });

    it('FIX: classifyFunctions with TS-only corpus returns deadFunctionOne as dead', () => {
        const { dead } = classifyFunctions([def('deadFunctionOne')], tsSource);
        expect(dead.map(d => d.name)).toContain('deadFunctionOne');
    });

    it('FIX: classifyFunctions with TS+JS corpus returns deadFunctionOne as live (bug scenario)', () => {
        // This test documents that classifyFunctions alone cannot fix the bug — the
        // corpus must be pre-filtered by preferTsOverJs() or the glob exclusion.
        const combined = [tsSource, compiledJs].join('\n');
        const { live } = classifyFunctions([def('deadFunctionOne')], combined);
        expect(live.map(d => d.name)).toContain('deadFunctionOne'); // bug present in corpus
    });
});

// =============================================================================
// genericClone and deadArrow are unaffected by compiled JS
// =============================================================================

describe('classifyFunctions — genericClone and deadArrow remain correctly dead', () => {
    it('genericClone<T>: TS definition has <T> before ( → 0 TS matches; compiled JS adds 1 → total 1 → dead', () => {
        const tsSource   = 'export function genericClone<T>(obj: T): T { return JSON.parse(JSON.stringify(obj)); }';
        const compiledJs = 'function genericClone(obj) { return JSON.parse(JSON.stringify(obj)); }';

        // TypeScript generic definition does NOT match \bgenericClone\s*\(
        const tsPattern = /\bgenericClone\s*\(/g;
        expect((tsSource.match(tsPattern) ?? []).length).toBe(0);

        // Compiled JS loses the generic and DOES match
        expect((compiledJs.match(/\bgenericClone\s*\(/g) ?? []).length).toBe(1);

        // Even in a combined corpus: 1 total match → threshold < 2 → dead ✓
        const combined = [tsSource, compiledJs].join('\n');
        const { dead } = classifyFunctions([def('genericClone')], combined);
        expect(dead.map(d => d.name)).toContain('genericClone');
    });

    it('deadArrow: arrow definition never produces deadArrow( → 0 matches in any corpus → dead', () => {
        const tsSource   = 'export const deadArrow = () => { return "dead"; };';
        const compiledJs = 'const deadArrow = () => { return "dead"; };';

        const pattern = /\bdeadArrow\s*\(/g;
        expect((tsSource.match(pattern)   ?? []).length).toBe(0);
        expect((compiledJs.match(pattern) ?? []).length).toBe(0);

        const combined = [tsSource, compiledJs].join('\n');
        const { dead } = classifyFunctions([def('deadArrow')], combined);
        expect(dead.map(d => d.name)).toContain('deadArrow');
    });

    it('contrast: deadFunctionOne IS affected by compiled JS while genericClone is not', () => {
        const tsSources = [
            'export function deadFunctionOne() { console.log("x"); }',
            'export function genericClone<T>(obj: T): T { return obj; }',
        ].join('\n');
        const compiledJs = [
            'function deadFunctionOne() { console.log("x"); }',
            'function genericClone(obj) { return obj; }',
        ].join('\n');

        const combined = [tsSources, compiledJs].join('\n');

        const dfOnePattern = /\bdeadFunctionOne\s*\(/g;
        const gcPattern    = /\bgenericClone\s*\(/g;

        const dfOneMatches = (combined.match(dfOnePattern) ?? []).length;
        const gcMatches    = (combined.match(gcPattern)    ?? []).length;

        // deadFunctionOne: 2 matches (TS definition + compiled JS definition) → false negative
        expect(dfOneMatches).toBe(2);
        // genericClone: 1 match (only compiled JS, TS has <T>) → stays correctly dead
        expect(gcMatches).toBe(1);
    });
});

// =============================================================================
// End-to-end: preferTsOverJs eliminates the false negative
// =============================================================================

describe('preferTsOverJs + classifyFunctions — full pipeline', () => {
    it('eliminates false negative when TS and compiled JS are in the same directory', () => {
        const tsPath = '/project/src/paymentService.ts';
        const jsPath = '/project/src/paymentService.js'; // compiled in-place

        // Step 1: simulate what getAllWorkspaceFiles() returns before the fix
        const rawFiles = [uri(tsPath), uri(jsPath)];

        // Step 2: apply preferTsOverJs (the fix)
        const filteredFiles = preferTsOverJs(rawFiles);
        expect(filteredFiles.map(f => f.fsPath)).toEqual([tsPath]);
        expect(filteredFiles).toHaveLength(1); // JS dropped

        // Step 3: build corpus from filtered files only
        const tsSource = 'export function deadFunctionOne() { console.log("x"); }';
        const allText  = tsSource; // only TS file in corpus

        const { dead } = classifyFunctions([def('deadFunctionOne')], allText);
        expect(dead.map(d => d.name)).toContain('deadFunctionOne'); // correctly dead ✓
    });
});
