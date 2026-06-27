import * as vscode from 'vscode';
import { requireWorkspace } from '../utils/editorUtils';
import { getOutputChannel } from '../utils/outputChannel';
import { getAllWorkspaceFiles, readFileText, toDisplayPath } from '../utils/fileUtils';
import { detectFunctions } from '../parser/FunctionParser';
import { WorkspaceFunctionInfo } from '../types';
import { preferTsOverJs, classifyFunctions } from '../analysis/DeadCodeAnalyzer';

export async function findDeadCode(): Promise<void> {
    if (!requireWorkspace()) { return; }

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'ArchSetu: Scanning for dead code…',
            cancellable: false,
        },
        async () => {
            // Exclude compiled JS when a TypeScript counterpart exists in the same
            // directory — otherwise both foo.ts and foo.js are scanned, which
            // doubles the definition-line match for every named function and produces
            // false negatives (functions that are truly dead appear alive).
            const allFiles = preferTsOverJs(await getAllWorkspaceFiles());
            if (allFiles.length === 0) {
                void vscode.window.showWarningMessage('ArchSetu: No JS/TS files found in workspace.');
                return;
            }

            // Step 1: collect every function definition
            const allDefinitions: WorkspaceFunctionInfo[] = [];
            for (const uri of allFiles) {
                const text = readFileText(uri.fsPath);
                if (!text) { continue; }
                const lines = text.split('\n');
                for (const fn of detectFunctions(text, lines)) {
                    allDefinitions.push({
                        ...fn,
                        filePath: uri.fsPath,
                        fileName: toDisplayPath(uri.fsPath),
                    });
                }
            }

            // Step 2: build one concatenated search corpus (each file separated by a newline)
            const allText = allFiles
                .map(u => readFileText(u.fsPath))
                .filter(Boolean)
                .join('\n');

            const { dead, live } = classifyFunctions(allDefinitions, allText);

            const ch = getOutputChannel();
            ch.clear();
            ch.appendLine('╔═══════════════════════════════════════════════════╗');
            ch.appendLine('║          ArchSetu — Dead Code Finder             ║');
            ch.appendLine('║  Functions defined but never called anywhere     ║');
            ch.appendLine('╚═══════════════════════════════════════════════════╝');
            ch.appendLine('');

            if (dead.length === 0) {
                ch.appendLine('  All clear! No dead functions detected.');
                ch.appendLine('  Every function in your project is called at least once.');
            } else {
                ch.appendLine(`  Found ${dead.length} potentially dead function(s):`);
                ch.appendLine('');

                const byFile = new Map<string, WorkspaceFunctionInfo[]>();
                for (const d of dead) {
                    const list = byFile.get(d.fileName) ?? [];
                    list.push(d);
                    byFile.set(d.fileName, list);
                }

                for (const [fileName, fns] of byFile) {
                    ch.appendLine(`  📁 ${fileName}`);
                    for (const fn of fns) {
                        ch.appendLine(`       ⚠  ${fn.name}()   —   line ${fn.line + 1}`);
                    }
                    ch.appendLine('');
                }
            }

            ch.appendLine('─'.repeat(52));
            ch.appendLine(`  Total functions found    : ${allDefinitions.length}`);
            ch.appendLine(`  Live (called somewhere)  : ${live.length}`);
            ch.appendLine(`  Dead (never called)      : ${dead.length}`);
            ch.appendLine('');
            ch.appendLine('  IMPORTANT: Review before deleting anything.');
            ch.appendLine('  Functions called via string names, eval(), or dynamic');
            ch.appendLine('  imports will appear dead but are actually alive.');
            ch.appendLine('═══════════════════════════════════════════════════════');
            ch.show(true);
        }
    );
}
