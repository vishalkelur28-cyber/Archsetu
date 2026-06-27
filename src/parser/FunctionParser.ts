import { FunctionInfo } from '../types';

// JS/TS keywords that resemble identifiers but are never function names.
// Without this filter, patterns like "for (" or "if (" would register as functions.
export const SKIP_KEYWORDS = new Set<string>([
    'if', 'else', 'for', 'while', 'switch', 'try', 'catch', 'finally',
    'return', 'super', 'new', 'delete', 'typeof', 'void', 'instanceof',
    'in', 'of', 'do', 'throw', 'case', 'import', 'export', 'class',
    'function',  // keyword prefix — the parser captures the NAME after it, not 'function' itself
    'extends', 'implements', 'interface', 'enum', 'namespace', 'module',
    'declare', 'abstract', 'override', 'from', 'as', 'type', 'keyof',
    'await', 'yield', 'this', 'static', 'get', 'set', 'async', 'let',
    'const', 'var', 'debugger', 'with', 'default', 'constructor',
]);

/**
 * Finds the line number of the closing brace of a function starting at `startLine`.
 * Ignores braces inside strings and comments.
 */
export function findFunctionEnd(lines: readonly string[], startLine: number): number {
    let braceCount = 0;
    let foundFirstBrace = false;
    let inString = false;
    let stringChar = '';
    let inBlockComment = false;

    for (let i = startLine; i < lines.length; i++) {
        const line = lines[i];

        for (let j = 0; j < line.length; j++) {
            const ch = line[j];
            const next = j + 1 < line.length ? line[j + 1] : '';

            if (inBlockComment) {
                if (ch === '*' && next === '/') { inBlockComment = false; j++; }
                continue;
            }

            if (inString) {
                if (ch === '\\') { j++; }
                else if (ch === stringChar) { inString = false; }
                continue;
            }

            if (ch === '/' && next === '/') { break; }
            if (ch === '/' && next === '*') { inBlockComment = true; j++; continue; }

            if (ch === '"' || ch === "'" || ch === '`') {
                inString = true;
                stringChar = ch;
                continue;
            }

            if (ch === '{') {
                braceCount++;
                foundFirstBrace = true;
            } else if (ch === '}') {
                braceCount--;
                if (foundFirstBrace && braceCount === 0) { return i; }
            }
        }

        // Single/double-quoted strings cannot span lines; template literals can.
        if (inString && stringChar !== '`') { inString = false; }
    }

    return lines.length - 1;
}

/**
 * Detects all function definitions in the given source text.
 * Handles:
 *   1. Named declarations:   function myFunc() {}
 *   2. Arrow functions:      const myFunc = () => {}
 *   3. Function expressions: const myFunc = function() {}
 *   4. Class methods:        public myMethod() {}
 */
export function detectFunctions(text: string, lines: readonly string[]): FunctionInfo[] {
    const results: FunctionInfo[] = [];
    const seen = new Set<string>();

    function register(name: string, matchIndex: number): void {
        if (SKIP_KEYWORDS.has(name)) { return; }
        const before = text.substring(0, matchIndex);
        const lineNum = (before.match(/\n/g) ?? []).length;
        const key = `${lineNum}:${name}`;
        if (seen.has(key)) { return; }
        seen.add(key);
        const lineText = lines[lineNum] ?? '';
        const charIdx = lineText.indexOf(name);
        results.push({
            name,
            line: lineNum,
            character: charIdx >= 0 ? charIdx : 0,
            endLine: findFunctionEnd(lines, lineNum),
        });
    }

    let m: RegExpExecArray | null;

    // Named function declarations: [export] [default] [async] function NAME
    const reFuncDecl =
        /^[ \t]*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*[<(]/gm;
    reFuncDecl.lastIndex = 0;
    while ((m = reFuncDecl.exec(text)) !== null) { register(m[1], m.index); }

    // Arrow functions: [export] const|let|var NAME = [async] (...) =>
    const reArrow =
        /^[ \t]*(?:export\s+)?(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)[^=\n]*=\s*(?:async\s+)?(?:\([^)\n]*\)|[a-zA-Z_$][a-zA-Z0-9_$]*)\s*=>/gm;
    reArrow.lastIndex = 0;
    while ((m = reArrow.exec(text)) !== null) { register(m[1], m.index); }

    // Function expressions: [export] const|let|var NAME = [async] function
    const reFuncExpr =
        /^[ \t]*(?:export\s+)?(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)[^=\n]*=\s*(?:async\s+)?function\b/gm;
    reFuncExpr.lastIndex = 0;
    while ((m = reFuncExpr.exec(text)) !== null) { register(m[1], m.index); }

    // Class methods (always indented): [modifiers] NAME(...) {
    const reMethod =
        /^[ \t]+(?:(?:public|private|protected|static|async|override|abstract|readonly|get|set)\s+)*([a-zA-Z_$][a-zA-Z0-9_$]*)(?:<[^>]*>)?\s*\(.*\)\s*(?::[^{]*)?\{[ \t]*$/gm;
    reMethod.lastIndex = 0;
    while ((m = reMethod.exec(text)) !== null) { register(m[1], m.index); }

    results.sort((a, b) => a.line - b.line);
    return results;
}
