// Regression tests for symbol extraction in the Change Impact Simulator and
// Blast Radius Analyzer.
//
// ROOT CAUSE:
//   Both commands used VS Code's `getWordRangeAtPosition` and accepted
//   whatever token the cursor sat on — including return types (`boolean`),
//   parameter types (`number`, `User`), generic parameters (`T`), and
//   modifier keywords (`async`, `export`).
//
//   When the cursor was anywhere in `: boolean` on a function definition,
//   the symbol name sent to `analyzeChangeImpact` was `"boolean"` rather
//   than `"validateUser"`, producing an empty analysis for a built-in type.
//
// FIX:
//   `extractSymbolAtCursor` (symbolExtractor.ts) checks whether the word at
//   cursor is a type-annotation token or language keyword.  If so, it parses
//   the current line with `extractDeclarationNameFromLine` and returns the
//   declaration name instead.
//
//   `extractDeclarationNameFromLine` is a pure function — the tests below
//   target it directly.  `extractSymbolAtCursor` is tested through a thin
//   document mock.

import {
    extractDeclarationNameFromLine,
    extractSymbolAtCursor,
    isNotUserSymbol,
    TYPE_ANNOTATION_WORDS,
} from '../utils/symbolExtractor';
import { SKIP_KEYWORDS } from '../parser/FunctionParser';
import * as vscode from 'vscode';

// =============================================================================
// Helper: build a minimal TextDocument-like mock
// =============================================================================

function makeDoc(wordAtCursor: string, lineText: string): vscode.TextDocument {
    return {
        getWordRangeAtPosition: () =>
            ({ start: { line: 0, character: 0 }, end: { line: 0, character: wordAtCursor.length } }) as vscode.Range,
        getText: (_range?: vscode.Range) => wordAtCursor,
        lineAt: (_line: number | vscode.Position) => ({ text: lineText } as vscode.TextLine),
    } as unknown as vscode.TextDocument;
}

const POS = { line: 0, character: 0 } as unknown as vscode.Position;

// =============================================================================
// TYPE_ANNOTATION_WORDS — sanity checks
// =============================================================================

describe('TYPE_ANNOTATION_WORDS', () => {
    it('contains TypeScript primitive types', () => {
        for (const prim of ['boolean', 'string', 'number', 'void', 'any', 'unknown', 'never']) {
            expect(TYPE_ANNOTATION_WORDS.has(prim)).toBe(true);
        }
    });

    it('contains common generic utility types', () => {
        for (const t of ['Promise', 'Array', 'Partial', 'Required', 'Readonly', 'Record']) {
            expect(TYPE_ANNOTATION_WORDS.has(t)).toBe(true);
        }
    });

    it('contains common single-letter generic type parameters', () => {
        for (const t of ['T', 'K', 'V', 'E', 'R']) {
            expect(TYPE_ANNOTATION_WORDS.has(t)).toBe(true);
        }
    });

    it('does NOT contain common user-defined function names', () => {
        for (const n of ['validateUser', 'processPayment', 'getUser', 'formatDate']) {
            expect(TYPE_ANNOTATION_WORDS.has(n)).toBe(false);
        }
    });
});

// =============================================================================
// isNotUserSymbol
// =============================================================================

describe('isNotUserSymbol', () => {
    it('returns true for TypeScript primitive types', () => {
        expect(isNotUserSymbol('boolean')).toBe(true);
        expect(isNotUserSymbol('string')).toBe(true);
        expect(isNotUserSymbol('number')).toBe(true);
        expect(isNotUserSymbol('void')).toBe(true);
        expect(isNotUserSymbol('Promise')).toBe(true);
    });

    it('returns true for SKIP_KEYWORDS (control-flow keywords)', () => {
        for (const kw of ['if', 'for', 'while', 'return', 'function', 'class', 'export', 'import']) {
            expect(isNotUserSymbol(kw)).toBe(true);
        }
    });

    it('returns true for common generic type parameters (T, K, V …)', () => {
        expect(isNotUserSymbol('T')).toBe(true);
        expect(isNotUserSymbol('K')).toBe(true);
        expect(isNotUserSymbol('V')).toBe(true);
    });

    it('returns false for real user-defined identifiers', () => {
        for (const name of ['validateUser', 'PaymentService', 'formatDate', 'myVar', 'AuthService']) {
            expect(isNotUserSymbol(name)).toBe(false);
        }
    });
});

// =============================================================================
// extractDeclarationNameFromLine — the core of the fix
// =============================================================================

describe('extractDeclarationNameFromLine — functions with return types', () => {
    it('extracts name from: export function validateUser(user: User): boolean', () => {
        expect(extractDeclarationNameFromLine(
            'export function validateUser(user: User): boolean {'
        )).toBe('validateUser');
    });

    it('extracts name from: function calculateDiscount(price: number): number', () => {
        expect(extractDeclarationNameFromLine(
            'function calculateDiscount(price: number): number {'
        )).toBe('calculateDiscount');
    });

    it('extracts name from: export function getUser(id: number): User | undefined', () => {
        expect(extractDeclarationNameFromLine(
            'export function getUser(id: number): User | undefined {'
        )).toBe('getUser');
    });

    it('extracts name from function returning a union type', () => {
        expect(extractDeclarationNameFromLine(
            'function parse(s: string): number | null {'
        )).toBe('parse');
    });
});

describe('extractDeclarationNameFromLine — generic functions', () => {
    it('extracts name from: export function genericClone<T>(obj: T): T', () => {
        expect(extractDeclarationNameFromLine(
            'export function genericClone<T>(obj: T): T {'
        )).toBe('genericClone');
    });

    it('extracts name from multi-generic: function merge<T, U>(a: T, b: U): T & U', () => {
        expect(extractDeclarationNameFromLine(
            'function merge<T, U>(a: T, b: U): T & U {'
        )).toBe('merge');
    });

    it('extracts name from generic with constraint: function findMax<T extends number>(arr: T[]): T', () => {
        expect(extractDeclarationNameFromLine(
            'function findMax<T extends number>(arr: T[]): T {'
        )).toBe('findMax');
    });
});

describe('extractDeclarationNameFromLine — async functions', () => {
    it('extracts name from: export async function savePayment(amount: number): Promise<boolean>', () => {
        expect(extractDeclarationNameFromLine(
            'export async function savePayment(amount: number): Promise<boolean> {'
        )).toBe('savePayment');
    });

    it('extracts name from: async function fetchUser(id: string): Promise<User | null>', () => {
        expect(extractDeclarationNameFromLine(
            'async function fetchUser(id: string): Promise<User | null> {'
        )).toBe('fetchUser');
    });

    it('extracts name from: export default async function handler(req: Request): Promise<Response>', () => {
        expect(extractDeclarationNameFromLine(
            'export default async function handler(req: Request): Promise<Response> {'
        )).toBe('handler');
    });
});

describe('extractDeclarationNameFromLine — arrow functions', () => {
    it('extracts name from: export const formatDate = (d: Date): string =>', () => {
        expect(extractDeclarationNameFromLine(
            'export const formatDate = (d: Date): string => d.toISOString()'
        )).toBe('formatDate');
    });

    it('extracts name from: const calculateTax = (amount: number): number =>', () => {
        expect(extractDeclarationNameFromLine(
            'const calculateTax = (amount: number): number => amount * 0.2'
        )).toBe('calculateTax');
    });

    it('extracts name from async arrow: export const fetchData = async (url: string): Promise<Response> =>', () => {
        expect(extractDeclarationNameFromLine(
            'export const fetchData = async (url: string): Promise<Response> => fetch(url)'
        )).toBe('fetchData');
    });

    it('extracts name from typed arrow: export const deadArrow = () =>', () => {
        expect(extractDeclarationNameFromLine(
            'export const deadArrow = () => { return "dead"; }'
        )).toBe('deadArrow');
    });
});

describe('extractDeclarationNameFromLine — class methods', () => {
    it('extracts name from: public async processPayment(user: User): Promise<boolean>', () => {
        expect(extractDeclarationNameFromLine(
            '    public async processPayment(user: User, payment: Payment): Promise<boolean> {'
        )).toBe('processPayment');
    });

    it('extracts name from: private validateToken(token: string): boolean', () => {
        expect(extractDeclarationNameFromLine(
            '    private validateToken(token: string): boolean {'
        )).toBe('validateToken');
    });

    it('extracts name from: protected static getInstance(): AuthService', () => {
        expect(extractDeclarationNameFromLine(
            '    protected static getInstance(): AuthService {'
        )).toBe('getInstance');
    });

    it('extracts name from: public getUser(id: number): User | undefined', () => {
        expect(extractDeclarationNameFromLine(
            '    public getUser(id: number): User | undefined {'
        )).toBe('getUser');
    });

    it('extracts name from: static readonly create(): Config', () => {
        expect(extractDeclarationNameFromLine(
            '    static readonly create(): Config {'
        )).toBe('create');
    });
});

describe('extractDeclarationNameFromLine — overloaded signatures', () => {
    it('extracts name from first overload: function format(x: number): string', () => {
        expect(extractDeclarationNameFromLine(
            'function format(x: number): string;'
        )).toBe('format');
    });

    it('extracts name from second overload: function format(x: string): string', () => {
        expect(extractDeclarationNameFromLine(
            'function format(x: string): string;'
        )).toBe('format');
    });

    it('extracts name from implementation: function format(x: number | string): string', () => {
        expect(extractDeclarationNameFromLine(
            'function format(x: number | string): string {'
        )).toBe('format');
    });
});

describe('extractDeclarationNameFromLine — classes and interfaces', () => {
    it('extracts name from: export class PaymentService', () => {
        expect(extractDeclarationNameFromLine(
            'export class PaymentService {'
        )).toBe('PaymentService');
    });

    it('extracts name from: export abstract class BaseService', () => {
        expect(extractDeclarationNameFromLine(
            'export abstract class BaseService {'
        )).toBe('BaseService');
    });

    it('extracts name from: export interface UserRepository', () => {
        expect(extractDeclarationNameFromLine(
            'export interface UserRepository {'
        )).toBe('UserRepository');
    });

    it('extracts name from: export type UserId = string', () => {
        expect(extractDeclarationNameFromLine(
            'export type UserId = string;'
        )).toBe('UserId');
    });
});

describe('extractDeclarationNameFromLine — returns null for non-declarations', () => {
    it('returns null for an if statement', () => {
        expect(extractDeclarationNameFromLine(
            'if (!validateUser(token)) { throw new Error(); }'
        )).toBeNull();
    });

    it('returns null for an import statement', () => {
        // `import` keyword is not a declaration pattern we handle — returns null
        expect(extractDeclarationNameFromLine(
            "import { validateUser } from './auth';"
        )).toBeNull();
    });

    it('returns null for a blank line', () => {
        expect(extractDeclarationNameFromLine('')).toBeNull();
    });

    it('returns null for a return statement', () => {
        expect(extractDeclarationNameFromLine('    return validateUser(token);')).toBeNull();
    });

    it('correctly returns the variable name for: const ok = call() — it IS a declaration of ok', () => {
        // `const ok = validateUser(...)` declares `ok`, so the function returns 'ok'.
        // This is correct: if cursor is on `boolean` in `const ok: boolean = ...`,
        // the fallback correctly identifies that `ok` is the declared name.
        // (In practice, cursor on `validateUser` takes the fast path and returns
        //  `validateUser` directly, never reaching this function.)
        expect(extractDeclarationNameFromLine(
            'const ok = validateUser(req.body.email, req.body.password);'
        )).toBe('ok');
    });
});

// =============================================================================
// extractSymbolAtCursor — end-to-end via document mock
// =============================================================================

describe('extractSymbolAtCursor — cursor on the function name (fast path)', () => {
    it('returns the function name directly when cursor is on validateUser', () => {
        const doc = makeDoc('validateUser',
            'export function validateUser(user: User): boolean {');
        expect(extractSymbolAtCursor(doc, POS)).toBe('validateUser');
    });

    it('returns the class name directly when cursor is on PaymentService', () => {
        const doc = makeDoc('PaymentService', 'export class PaymentService {');
        expect(extractSymbolAtCursor(doc, POS)).toBe('PaymentService');
    });

    it('returns the arrow-function name when cursor is on formatDate', () => {
        const doc = makeDoc('formatDate',
            'export const formatDate = (d: Date): string => d.toISOString()');
        expect(extractSymbolAtCursor(doc, POS)).toBe('formatDate');
    });
});

describe('extractSymbolAtCursor — cursor on return type (the bug scenario)', () => {
    it('REGRESSION: cursor on boolean → returns validateUser', () => {
        const doc = makeDoc('boolean',
            'export function validateUser(user: User): boolean {');
        expect(extractSymbolAtCursor(doc, POS)).toBe('validateUser');
    });

    it('REGRESSION: cursor on Promise → returns savePayment', () => {
        const doc = makeDoc('Promise',
            'export async function savePayment(amount: number): Promise<boolean> {');
        expect(extractSymbolAtCursor(doc, POS)).toBe('savePayment');
    });

    it('REGRESSION: cursor on number (return type) → returns calculateDiscount', () => {
        const doc = makeDoc('number',
            'function calculateDiscount(price: number): number {');
        expect(extractSymbolAtCursor(doc, POS)).toBe('calculateDiscount');
    });

    it('REGRESSION: cursor on string (return type of arrow) → returns formatDate', () => {
        const doc = makeDoc('string',
            'export const formatDate = (d: Date): string => d.toISOString()');
        expect(extractSymbolAtCursor(doc, POS)).toBe('formatDate');
    });
});

describe('extractSymbolAtCursor — cursor on modifier keywords', () => {
    it('cursor on "async" keyword → recovers function name from line', () => {
        const doc = makeDoc('async',
            'export async function fetchUser(id: string): Promise<User> {');
        // 'async' is in SKIP_KEYWORDS → line fallback
        expect(extractSymbolAtCursor(doc, POS)).toBe('fetchUser');
    });

    it('cursor on "export" keyword → recovers function name from line', () => {
        const doc = makeDoc('export',
            'export function validateUser(user: User): boolean {');
        expect(extractSymbolAtCursor(doc, POS)).toBe('validateUser');
    });
});

describe('extractSymbolAtCursor — cursor on generic type parameters', () => {
    it('REGRESSION: cursor on T (generic param) → recovers genericClone from line', () => {
        const doc = makeDoc('T',
            'export function genericClone<T>(obj: T): T {');
        expect(extractSymbolAtCursor(doc, POS)).toBe('genericClone');
    });

    it('cursor on K (generic param in Map helper) → recovers function name', () => {
        const doc = makeDoc('K',
            'function getMapEntry<K, V>(map: Map<K, V>, key: K): V {');
        expect(extractSymbolAtCursor(doc, POS)).toBe('getMapEntry');
    });
});

describe('extractSymbolAtCursor — returns null when no valid symbol found', () => {
    it('returns null when getWordRangeAtPosition returns null (cursor on separator)', () => {
        const doc = {
            getWordRangeAtPosition: () => null,
            getText: () => '',
            lineAt: () => ({ text: 'const x = 1;' }),
        } as unknown as vscode.TextDocument;
        expect(extractSymbolAtCursor(doc, POS)).toBeNull();
    });

    it('returns null when line has no declaration and word is a keyword', () => {
        // Line is just `boolean` — no function declaration to fall back to
        const doc = makeDoc('boolean', '    boolean');
        expect(extractSymbolAtCursor(doc, POS)).toBeNull();
    });
});
