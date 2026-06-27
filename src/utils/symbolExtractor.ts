import * as vscode from 'vscode';
import { SKIP_KEYWORDS } from '../parser/FunctionParser';

// =============================================================================
// Type-annotation word set
// =============================================================================

/**
 * TypeScript primitive types, generic-utility types, and type-level keywords
 * that commonly appear in return-type, parameter-type, and generic-constraint
 * positions.  When the cursor lands on one of these, it is not the symbol the
 * user intends to analyse — the enclosing declaration name is.
 *
 * Single-letter uppercase identifiers (T, K, V, E …) are also included because
 * they are almost universally generic type-parameter names, not callable symbols.
 */
export const TYPE_ANNOTATION_WORDS = new Set<string>([
    // Primitive types
    'boolean', 'string', 'number', 'bigint', 'symbol', 'object',
    'void', 'undefined', 'null', 'any', 'unknown', 'never',
    // Boolean literals
    'true', 'false',
    // Type-level keywords
    'readonly', 'keyof', 'typeof', 'infer', 'is', 'satisfies', 'asserts',
    // Built-in generic types
    'Promise', 'Array', 'ReadonlyArray', 'IterableIterator',
    'Partial', 'Required', 'Readonly', 'Record', 'Pick', 'Omit',
    'Exclude', 'Extract', 'NonNullable', 'ReturnType', 'InstanceType',
    'Parameters', 'ConstructorParameters', 'ThisType', 'Awaited',
    'Map', 'Set', 'WeakMap', 'WeakSet',
    // Common single-letter generic type parameters
    'T', 'K', 'V', 'E', 'R', 'S', 'U', 'A', 'B', 'C', 'P', 'Q', 'N', 'M',
]);

// =============================================================================
// Line-level declaration name extractor (pure function — fully testable)
// =============================================================================

/**
 * Parses `lineText` to find the primary symbol name declared on that line.
 * Handles:
 *   - Named functions:          [export] [default] [async] function NAME<T>(
 *   - Classes:                  [export] [abstract] class NAME
 *   - Arrow / expression fns:   [export] const|let|var NAME =
 *   - Interfaces:               [export] interface NAME
 *   - Type aliases:             [export] type NAME =
 *   - Class methods (modifiers):public|private|protected … NAME(
 *   - Overloaded signatures:    same as named functions
 *
 * Returns null when the line does not contain a recognisable declaration.
 */
export function extractDeclarationNameFromLine(lineText: string): string | null {
    const t = lineText.trimStart();

    // Named / async / exported function (also overload signatures)
    const fnMatch = /\bfunction\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/.exec(t);
    if (fnMatch) { return fnMatch[1]; }

    // Class (abstract or concrete)
    const classMatch = /\bclass\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/.exec(t);
    if (classMatch) { return classMatch[1]; }

    // Arrow function or expression function assigned to a const/let/var
    // e.g. `export const formatDate = (d: Date): string => …`
    const varMatch = /^(?:export\s+)?(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/.exec(t);
    if (varMatch) { return varMatch[1]; }

    // Interface
    const ifaceMatch = /\binterface\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/.exec(t);
    if (ifaceMatch) { return ifaceMatch[1]; }

    // Type alias
    const typeAliasMatch = /\btype\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/.exec(t);
    if (typeAliasMatch) { return typeAliasMatch[1]; }

    // Class method with one or more access/modifier keywords before the name
    // e.g. `public async processPayment(` or `protected static getInstance(`
    const methodMatch =
        /^(?:(?:public|private|protected|static|abstract|override|async|readonly|get|set)\s+)+([a-zA-Z_$][a-zA-Z0-9_$]*)/.exec(t);
    if (methodMatch) { return methodMatch[1]; }

    return null;
}

// =============================================================================
// Symbol validity check
// =============================================================================

/**
 * Returns true when `word` should NOT be used directly as the subject of an
 * analysis — i.e. it is a control-flow keyword (from SKIP_KEYWORDS), a
 * TypeScript primitive / utility type, or a common generic type parameter.
 */
export function isNotUserSymbol(word: string): boolean {
    return SKIP_KEYWORDS.has(word) || TYPE_ANNOTATION_WORDS.has(word);
}

// =============================================================================
// Main entry point (requires VS Code API — tested indirectly via mocks)
// =============================================================================

/**
 * Extracts the most meaningful symbol name from the cursor position in a
 * VS Code document.
 *
 * Algorithm:
 *  1. Get the word under the cursor via `getWordRangeAtPosition`.
 *  2. If the word is a real user-defined identifier (not a keyword or type
 *     annotation token), return it directly.
 *  3. If the word is a keyword / primitive type (cursor is on `boolean`,
 *     `Promise`, `async`, `export`, `T`, etc.), parse the current line with
 *     `extractDeclarationNameFromLine` and return the declaration name instead.
 *  4. Return null when no valid symbol can be determined.
 *
 * This ensures the simulator always receives the intended symbol
 * (`validateUser`) even when the cursor is parked on the return type
 * (`: boolean`), a generic parameter (`<T>`), or a modifier keyword.
 */
export function extractSymbolAtCursor(
    document: vscode.TextDocument,
    position: vscode.Position,
): string | null {
    const wordRange = document.getWordRangeAtPosition(position);
    if (!wordRange) { return null; }

    const word = document.getText(wordRange);
    if (!word) { return null; }

    // Fast path: cursor is already on a real user symbol
    if (!isNotUserSymbol(word)) { return word; }

    // Cursor is on a keyword or type-annotation token — recover the
    // declaration name from the same source line
    const lineText = document.lineAt(position.line).text;
    const declName = extractDeclarationNameFromLine(lineText);
    if (declName && !isNotUserSymbol(declName)) { return declName; }

    // Cannot recover a valid symbol from context
    return null;
}
