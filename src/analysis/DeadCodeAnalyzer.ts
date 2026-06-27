import * as path from 'path';
import { WorkspaceFunctionInfo } from '../types';
import { escapeRegex } from '../utils/textUtils';

/** Minimal shape we need from vscode.Uri — lets unit tests pass plain objects. */
interface UriLike { fsPath: string; }

/**
 * Removes JS/JSX files from `files` whenever a corresponding TS/TSX file exists
 * at the same path (same directory, same base name, different extension).
 *
 * Problem: when a workspace has both `foo.ts` and `foo.js` (TypeScript compiled
 * in-place without an outDir), the dead-code scanner concatenates both files into
 * `allText`. Every named function definition then appears twice — once in the TS
 * source (`export function deadFunctionOne()`) and once in the compiled JS
 * (`function deadFunctionOne()`). That gives 2 matches for the `\bname\s*\(`
 * pattern, clearing the `< 2` dead-code threshold and producing a false negative.
 *
 * Arrow/generic functions are NOT affected: arrow definitions never produce
 * `name(` and generic TS definitions like `function clone<T>(` don't match the
 * pattern either, so they stay at ≤ 1 match and remain correctly dead.
 */
export function preferTsOverJs(files: UriLike[]): UriLike[] {
    const tsBasePaths = new Set<string>();
    for (const f of files) {
        const ext = path.extname(f.fsPath).toLowerCase();
        if (ext === '.ts' || ext === '.tsx') {
            tsBasePaths.add(f.fsPath.slice(0, f.fsPath.length - ext.length));
        }
    }

    return files.filter(f => {
        const ext = path.extname(f.fsPath).toLowerCase();
        if (ext === '.js' || ext === '.jsx') {
            const base = f.fsPath.slice(0, f.fsPath.length - ext.length);
            return !tsBasePaths.has(base);
        }
        return true;
    });
}

export interface ClassifyResult {
    dead: WorkspaceFunctionInfo[];
    live: WorkspaceFunctionInfo[];
}

/**
 * Classifies each function definition as dead or live by searching `allText`
 * for the pattern `\bname\s*(`.
 *
 * Threshold logic:
 * - Named function declarations (`function foo(`) include their own name in
 *   the definition line, so 1 match = definition only = dead; 2+ = alive.
 * - Arrow / expression functions (`const foo = () =>`) do NOT produce a
 *   `foo(` match in their definition, so 0 matches = dead; 1+ = alive.
 *   Both cases use threshold < 2 because arrows start at 0 while named start
 *   at 1 — the threshold correctly separates dead from alive in both cases
 *   as long as the corpus is TypeScript-only (no compiled JS doubling).
 */
export function classifyFunctions(
    allDefinitions: WorkspaceFunctionInfo[],
    allText: string,
): ClassifyResult {
    const dead: WorkspaceFunctionInfo[] = [];
    const live: WorkspaceFunctionInfo[] = [];

    for (const def of allDefinitions) {
        const pattern = new RegExp(`\\b${escapeRegex(def.name)}\\s*\\(`, 'g');
        const matches = allText.match(pattern) ?? [];
        if (matches.length < 2) { dead.push(def); }
        else                    { live.push(def); }
    }

    return { dead, live };
}
