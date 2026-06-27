import * as vscode from 'vscode';
import * as path from 'path';
import { requireWorkspace } from '../utils/editorUtils';
import { getOutputChannel } from '../utils/outputChannel';
import { getAllWorkspaceFiles, readFileText, toDisplayPath } from '../utils/fileUtils';
import { EntryPoint } from '../types';

// =============================================================================
// Pattern helpers
// =============================================================================

function lineNum(text: string, index: number): number {
    return (text.substring(0, index).match(/\n/g) ?? []).length;
}

// =============================================================================
// True-entry-point detectors
// =============================================================================

/**
 * Returns entry points that represent actual application-start locations:
 * server listeners, process entry, React roots, Lambda handlers, CLI mains, etc.
 * Exports are intentionally NOT included here — they appear in a separate section.
 */
function detectTrueEntryPoints(
    text: string,
    lines: string[],
    relPath: string,
    allRelPaths: string[],
): EntryPoint[] {
    const eps: EntryPoint[] = [];

    function add(type: string, idx: number, name: string): void {
        eps.push({ type, name, fileName: relPath, line: lineNum(text, idx), lineText: (lines[lineNum(text, idx)] ?? '').trim() });
    }

    let m: RegExpExecArray | null;

    // ── HTTP routes (Express / Fastify / Hapi / Koa) ─────────────────────────
    const reRoutes = /(?:app|router|server)\.(get|post|put|patch|delete|use|all)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
    reRoutes.lastIndex = 0;
    while ((m = reRoutes.exec(text)) !== null) {
        add(`HTTP ${m[1].toUpperCase()}`, m.index, m[2]);
    }

    // ── Server start (app.listen / server.listen / createServer / createApp) ─
    const reListen = /(?:app|server|httpServer|httpsServer|fastify)\s*\.\s*listen\s*\(/g;
    reListen.lastIndex = 0;
    while ((m = reListen.exec(text)) !== null) {
        add('Server Start', m.index, 'listen()');
    }

    const reCreateServer = /(?:http|https|net)\.createServer\s*\(/g;
    reCreateServer.lastIndex = 0;
    while ((m = reCreateServer.exec(text)) !== null) {
        add('Server Start', m.index, 'createServer()');
    }

    // ── main() function call / definition ────────────────────────────────────
    const reMainDef = /^(?:export\s+)?(?:async\s+)?function\s+main\s*\(/gm;
    reMainDef.lastIndex = 0;
    while ((m = reMainDef.exec(text)) !== null) {
        add('Main', m.index, 'main()');
    }

    // Standalone main() invocation (e.g. `main()` or `main().catch(...)`)
    const reMainCall = /^main\s*\(\s*\)/gm;
    reMainCall.lastIndex = 0;
    while ((m = reMainCall.exec(text)) !== null) {
        add('Main', m.index, 'main() call');
    }

    // ── IIFEs ────────────────────────────────────────────────────────────────
    const reIIFE = /\(\s*(?:async\s+)?\(\s*\)\s*=>/g;
    reIIFE.lastIndex = 0;
    while ((m = reIIFE.exec(text)) !== null) {
        add('IIFE', m.index, '(self-executing arrow)');
    }
    const reIIFEfn = /\(\s*(?:async\s+)?function\s*\(\s*\)\s*\{/g;
    reIIFEfn.lastIndex = 0;
    while ((m = reIIFEfn.exec(text)) !== null) {
        add('IIFE', m.index, '(self-executing function)');
    }

    // ── Event listeners ──────────────────────────────────────────────────────
    const reEvents = /(?:addEventListener|process\.on|emitter\.on|\.on)\s*\(\s*['"`]([^'"`]+)['"`]/g;
    reEvents.lastIndex = 0;
    while ((m = reEvents.exec(text)) !== null) {
        add('Event', m.index, m[1]);
    }

    // ── React roots (ReactDOM.render / createRoot) ───────────────────────────
    const reReact = /(?:ReactDOM\.render|createRoot\s*\()/g;
    reReact.lastIndex = 0;
    while ((m = reReact.exec(text)) !== null) {
        add('React Root', m.index, m[0].includes('createRoot') ? 'createRoot()' : 'ReactDOM.render()');
    }

    // ── AWS Lambda handlers (exports.handler = …) ────────────────────────────
    const reLambda = /exports\s*\.\s*handler\s*=/g;
    reLambda.lastIndex = 0;
    while ((m = reLambda.exec(text)) !== null) {
        add('Lambda Handler', m.index, 'exports.handler');
    }
    // Named Lambda: export const handler = async (event, ctx) => …
    const reLambdaTs = /^export\s+(?:const|async\s+function)\s+handler\b/gm;
    reLambdaTs.lastIndex = 0;
    while ((m = reLambdaTs.exec(text)) !== null) {
        add('Lambda Handler', m.index, 'handler');
    }

    // ── Next.js: export default page components ──────────────────────────────
    const normalised = relPath.replace(/\\/g, '/');
    const isNextPage  = /(?:^|\/)pages\/[^/]+\.(tsx?|jsx?)$/.test(normalised);
    const isNextAppDir = /(?:^|\/)app\/.*\/(page|layout|loading|error|route)\.(tsx?|jsx?)$/.test(normalised);
    if (isNextPage || isNextAppDir) {
        const reNextDefault = /^export\s+default\s+/gm;
        reNextDefault.lastIndex = 0;
        while ((m = reNextDefault.exec(text)) !== null) {
            add('Next.js Page', m.index, path.basename(relPath));
        }
    }

    // ── CLI / process entry: process.argv, commander, yargs ─────────────────
    const reCli = /(?:process\.argv|\.command\s*\(|\.parse\s*\(process\.argv|yargs\s*\()/g;
    reCli.lastIndex = 0;
    while ((m = reCli.exec(text)) !== null) {
        add('CLI Entry', m.index, m[0].trim().split('(')[0]);
    }

    // ── package.json main / bin detection ────────────────────────────────────
    // If this file matches the "main" or "bin" field in package.json, tag it.
    // We detect this heuristically: the file is named index.{js,ts} or matches a
    // common entry-file convention, AND it lives at the root of the workspace.
    const isRootIndexOrMain =
        /^(?:src\/)?(?:index|main|app|server|cli)\.(ts|js|tsx|jsx)$/.test(normalised);
    if (isRootIndexOrMain && !eps.some(e => e.type === 'Main')) {
        // Only add if no other "Main" signal found — avoids false positives
        const hasTopLevelCode = /^(?!\/\/|import|export|const|let|var|type|interface|\/\*)/m.test(text);
        if (hasTopLevelCode) {
            // Heuristic: file has executable top-level code → likely the entry file
            eps.push({
                type: 'Package Entry',
                name: relPath,
                fileName: relPath,
                line: 0,
                lineText: (lines[0] ?? '').trim(),
            });
        }
    }

    // Deduplicate: same type+name+line from same file
    const seen = new Set<string>();
    return eps.filter(ep => {
        const k = `${ep.type}|${ep.name}|${ep.line}`;
        if (seen.has(k)) { return false; }
        seen.add(k);
        return true;
    });
}

// =============================================================================
// Export surface (not true entry points, but useful reference)
// =============================================================================

function detectExports(
    text: string,
    lines: string[],
    relPath: string,
): EntryPoint[] {
    const eps: EntryPoint[] = [];
    let m: RegExpExecArray | null;

    const reExports =
        /^(?:export\s+(?:default\s+)?(?:async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)|export\s+(?:const|let)\s+([a-zA-Z_$][a-zA-Z0-9_$]*))/gm;
    reExports.lastIndex = 0;
    while ((m = reExports.exec(text)) !== null) {
        const ln = (text.substring(0, m.index).match(/\n/g) ?? []).length;
        eps.push({
            type: 'Export',
            name: m[1] ?? m[2] ?? 'unknown',
            fileName: relPath,
            line: ln,
            lineText: (lines[ln] ?? '').trim(),
        });
    }

    return eps;
}

// =============================================================================
// Command
// =============================================================================

export async function detectEntryPoints(): Promise<void> {
    if (!requireWorkspace()) { return; }

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'ArchSetu: Detecting entry points…',
            cancellable: false,
        },
        async () => {
            const allFiles  = await getAllWorkspaceFiles();
            if (allFiles.length === 0) {
                void vscode.window.showWarningMessage('ArchSetu: No JS/TS files found in workspace.');
                return;
            }

            const allRelPaths = allFiles.map(u => toDisplayPath(u.fsPath));

            const trueEntries: EntryPoint[] = [];
            const exportEntries: EntryPoint[] = [];

            for (const uri of allFiles) {
                const text = readFileText(uri.fsPath);
                if (!text) { continue; }

                const lines   = text.split('\n');
                const relPath = toDisplayPath(uri.fsPath);

                trueEntries.push(...detectTrueEntryPoints(text, lines, relPath, allRelPaths));
                exportEntries.push(...detectExports(text, lines, relPath));
            }

            const ch = getOutputChannel();
            ch.clear();
            ch.appendLine('╔═══════════════════════════════════════════════════╗');
            ch.appendLine('║        ArchSetu — Entry Point Detection          ║');
            ch.appendLine('╚═══════════════════════════════════════════════════╝');
            ch.appendLine('');

            // ── TRUE ENTRY POINTS ──────────────────────────────────────────────
            ch.appendLine('  TRUE ENTRY POINTS  (where the application actually starts)');
            ch.appendLine('  ' + '─'.repeat(52));

            if (trueEntries.length === 0) {
                ch.appendLine('  None detected.');
                ch.appendLine('  Common frameworks (Express, React, Next.js, Lambda, CLI) were checked.');
                ch.appendLine('  If your framework is not listed, ArchSetu may not yet support it.');
            } else {
                const groups = new Map<string, EntryPoint[]>();
                for (const ep of trueEntries) {
                    const list = groups.get(ep.type) ?? [];
                    list.push(ep);
                    groups.set(ep.type, list);
                }

                for (const [type, eps] of groups) {
                    ch.appendLine(`  ── ${type} ${'─'.repeat(Math.max(0, 44 - type.length))}`);
                    for (const ep of eps) {
                        ch.appendLine(`  ${ep.name.padEnd(32)}  ${ep.fileName}  :  line ${ep.line + 1}`);
                    }
                    ch.appendLine('');
                }
            }

            // ── EXPORT SURFACE ─────────────────────────────────────────────────
            ch.appendLine('  EXPORTS  (public API surface — not necessarily entry points)');
            ch.appendLine('  ' + '─'.repeat(52));

            if (exportEntries.length === 0) {
                ch.appendLine('  No exported functions or constants found.');
            } else {
                const byFile = new Map<string, EntryPoint[]>();
                for (const ep of exportEntries) {
                    const list = byFile.get(ep.fileName) ?? [];
                    list.push(ep);
                    byFile.set(ep.fileName, list);
                }
                for (const [file, eps] of byFile) {
                    ch.appendLine(`  📁 ${file}`);
                    for (const ep of eps) {
                        ch.appendLine(`       ${ep.name}()   line ${ep.line + 1}`);
                    }
                }
                ch.appendLine('');
            }

            ch.appendLine('─'.repeat(54));
            ch.appendLine(`  True entry points : ${trueEntries.length}`);
            ch.appendLine(`  Exported symbols   : ${exportEntries.length}`);
            ch.appendLine('═══════════════════════════════════════════════════════');
            ch.show(true);
        }
    );
}
