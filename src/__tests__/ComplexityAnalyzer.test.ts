import {
    getComplexityScore,
    complexityLabel,
    countClasses,
    countImports,
} from '../analysis/ComplexityAnalyzer';

describe('getComplexityScore', () => {

    // ── Baseline ──────────────────────────────────────────────────────────────

    it('returns 1 for an empty function body', () => {
        expect(getComplexityScore([])).toBe(1);
    });

    it('returns 1 for a body with no branches', () => {
        expect(getComplexityScore(['const x = 1;', 'return x;'])).toBe(1);
    });

    // ── Control flow ──────────────────────────────────────────────────────────

    it('adds 1 for an if statement', () => {
        expect(getComplexityScore(['if (x) { return 1; }'])).toBe(2);
    });

    it('adds 1 per else-if but not for plain else', () => {
        const body = ['if (a) {}', 'else if (b) {}', 'else if (c) {}', 'else {}'];
        // 1 base + 1 if + 2 else-if = 4  (plain else contributes nothing)
        expect(getComplexityScore(body)).toBe(4);
    });

    it('adds 1 for a for loop', () => {
        expect(getComplexityScore(['for (let i = 0; i < 10; i++) {}'])).toBe(2);
    });

    it('adds 1 for a for-of loop', () => {
        expect(getComplexityScore(['for (const item of items) {}'])).toBe(2);
    });

    it('adds 1 for a while loop', () => {
        expect(getComplexityScore(['while (condition) {}'])).toBe(2);
    });

    it('adds 1 per case in a switch', () => {
        const body = ['switch (x) {', 'case 1: break;', 'case 2: break;', 'case 3: break;', '}'];
        // 1 base + 3 cases = 4
        expect(getComplexityScore(body)).toBe(4);
    });

    it('adds 1 for a catch block', () => {
        expect(getComplexityScore(['try {}', 'catch (e) {}'])).toBe(2);
    });

    // ── Logical operators ─────────────────────────────────────────────────────

    it('adds 1 per && operator', () => {
        // 1 base + 1 if + 2 && = 4
        expect(getComplexityScore(['if (a && b && c) {}'])).toBe(4);
    });

    it('adds 1 per || operator', () => {
        // 1 base + 1 if + 1 || = 3
        expect(getComplexityScore(['if (a || b) {}'])).toBe(3);
    });

    it('counts both && and || independently', () => {
        // 1 base + 1 if + 1 && + 1 || = 4
        expect(getComplexityScore(['if (a && b || c) {}'])).toBe(4);
    });

    // ── Ternary ───────────────────────────────────────────────────────────────

    it('adds 1 for a ternary expression', () => {
        expect(getComplexityScore(['const x = a ? 1 : 2;'])).toBe(2);
    });

    it('does NOT count optional chaining ?. as ternary', () => {
        expect(getComplexityScore(['const x = obj?.prop;'])).toBe(1);
    });

    it('does NOT count nullish coalescing ?? as ternary', () => {
        // /(?<!\?)\?(?![\.\?\:])/g  — negative lookbehind blocks the second ? of ??
        expect(getComplexityScore(['const x = a ?? b;'])).toBe(1);
    });

    it('does NOT count TypeScript type annotations with ? as ternary', () => {
        // e.g.  interface Foo { bar?: string }
        expect(getComplexityScore(['bar?: string;'])).toBe(1);
    });

    // ── Accumulation ─────────────────────────────────────────────────────────

    it('accumulates all branch types together', () => {
        const body = [
            'if (a) {',
            '  for (const x of arr) {',
            '    const y = b && c ? 1 : 2;',
            '  }',
            '}',
        ];
        // 1 base + 1 if + 1 for + 1 && + 1 ternary = 5
        expect(getComplexityScore(body)).toBe(5);
    });
});

describe('complexityLabel', () => {
    it('labels score 1 as Low', () => {
        expect(complexityLabel(1)).toContain('Low');
    });

    it('labels score 5 as Low', () => {
        expect(complexityLabel(5)).toContain('Low');
    });

    it('labels score 6 as Medium', () => {
        expect(complexityLabel(6)).toContain('Medium');
    });

    it('labels score 10 as Medium', () => {
        expect(complexityLabel(10)).toContain('Medium');
    });

    it('labels score 11 as High', () => {
        expect(complexityLabel(11)).toContain('High');
    });

    it('includes the score number in the label', () => {
        expect(complexityLabel(7)).toContain('7');
    });
});

describe('countClasses', () => {
    it('counts a plain class', () => {
        expect(countClasses(['class MyClass {'])).toBe(1);
    });

    it('counts an exported class', () => {
        expect(countClasses(['export class UserService {'])).toBe(1);
    });

    it('counts an exported abstract class', () => {
        expect(countClasses(['export abstract class BaseRepo {'])).toBe(1);
    });

    it('counts multiple classes', () => {
        const lines = ['class A {}', 'const x = 1;', 'class B {}', 'export class C {}'];
        expect(countClasses(lines)).toBe(3);
    });

    it('returns 0 when no classes are present', () => {
        expect(countClasses(['function foo() {}', 'const x = 1;'])).toBe(0);
    });
});

describe('countImports', () => {
    it('counts ES module imports', () => {
        const lines = ["import { foo } from './foo';", "import bar from 'bar';"];
        expect(countImports(lines)).toBe(2);
    });

    it('counts require calls', () => {
        expect(countImports(["const path = require('path');"])).toBe(1);
    });

    it('counts both import and require in the same file', () => {
        const lines = ["import fs from 'fs';", "const x = require('x');"];
        expect(countImports(lines)).toBe(2);
    });

    it('returns 0 when no imports are present', () => {
        expect(countImports(['const x = 1;', 'function foo() {}'])).toBe(0);
    });
});
