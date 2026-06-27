import { CallSite } from '../types';
import { getAllWorkspaceFiles, readFileText, toDisplayPath } from '../utils/fileUtils';
import { escapeRegex } from '../utils/textUtils';

// =============================================================================
// Declaration guard
// =============================================================================

/**
 * Returns true when `lineText` is a declaration context — a line that defines
 * a symbol rather than calling it.  Matched lines are excluded from call-site
 * results so that function declarations, arrow-function assignments, class
 * method signatures, import statements, and type-level constructs are never
 * reported as call sites.
 *
 * Cases handled:
 *   - Named function declarations:   [export] [default] [async] function NAME(
 *   - Arrow / expression functions:  [export] const|let|var NAME = / NAME:
 *   - Class method with modifiers:   public|private|protected|static|abstract …
 *   - Type-level keywords:           type | interface | class | declare | enum
 *   - Import statements:             import …
 *   - Export type/class/interface:   export type|interface|class|abstract …
 */
export function isDeclarationLine(lineText: string, symbolName: string): boolean {
    const t = lineText.trimStart();

    // Named function declaration
    if (/^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+/.test(t)) return true;

    // Arrow / expression function where THIS symbol is the variable being declared
    // e.g. `const validateUser = …` but NOT `const ok = validateUser(…)`
    if (new RegExp(`^(?:export\\s+)?(?:const|let|var)\\s+${escapeRegex(symbolName)}\\s*[=:]`).test(t)) return true;

    // Class method or property with access / modifier keywords
    if (/^(?:public|private|protected|static|abstract|override|readonly|get|set)\s/.test(t)) return true;

    // Type-level declarations (class, interface, type alias, enum, declare)
    if (/^(?:type|interface|class|abstract\s+class|declare|enum)\s/.test(t)) return true;

    // Import statement (import { foo } from …)
    if (/^import\s/.test(t)) return true;

    // Export of a type-level construct (not `export const foo = call()`)
    if (/^export\s+(?:type|interface|class|abstract|enum|default\s+class|declare)\b/.test(t)) return true;

    return false;
}

// =============================================================================
// Call-site finder
// =============================================================================

/**
 * Searches every JS/TS file in the workspace for call sites of the named symbol.
 * A call site is a line containing `symbolName(` that is NOT a function/method
 * declaration, import, export, or type-level construct.
 *
 * @param symbolName       The function/method name to search for.
 * @param excludePath      Optional absolute path to skip (typically the defining file).
 */
export async function findCallSites(
    symbolName: string,
    excludePath?: string
): Promise<CallSite[]> {
    const allFiles = await getAllWorkspaceFiles();
    const pattern  = new RegExp(`\\b${escapeRegex(symbolName)}\\s*\\(`, 'g');
    const sites: CallSite[] = [];

    for (const uri of allFiles) {
        if (excludePath && uri.fsPath === excludePath) { continue; }

        const text = readFileText(uri.fsPath);
        if (!text) { continue; }

        const lines = text.split('\n');
        pattern.lastIndex = 0;

        let match: RegExpExecArray | null;
        while ((match = pattern.exec(text)) !== null) {
            const lineNum  = (text.substring(0, match.index).match(/\n/g) ?? []).length;
            const lineText = (lines[lineNum] ?? '').trim();

            // Skip declarations — only executable invocations are call sites
            if (isDeclarationLine(lineText, symbolName)) { continue; }

            sites.push({
                filePath: uri.fsPath,
                fileName: toDisplayPath(uri.fsPath),
                line:     lineNum,
                lineText,
            });
        }
    }

    return sites;
}
