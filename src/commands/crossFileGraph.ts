import * as vscode from 'vscode';
import { requireWorkspace } from '../utils/editorUtils';
import { getOutputChannel } from '../utils/outputChannel';
import { getAllWorkspaceFiles, readFileText, toDisplayPath } from '../utils/fileUtils';
import { escapeRegex } from '../utils/textUtils';
import { detectFunctions } from '../parser/FunctionParser';
import { CallSite } from '../types';

export async function crossFileCallGraph(): Promise<void> {
    if (!requireWorkspace()) { return; }

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'ArchSetu: Building cross-file call graph…',
            cancellable: false,
        },
        async () => {
            const allFiles = await getAllWorkspaceFiles();
            if (allFiles.length === 0) {
                void vscode.window.showWarningMessage('ArchSetu: No JS/TS files found in workspace.');
                return;
            }

            // Step 1: parse every file
            const fileToFunctions = new Map<string, ReturnType<typeof detectFunctions>>();
            for (const uri of allFiles) {
                const text = readFileText(uri.fsPath);
                if (!text) { continue; }
                const lines = text.split('\n');
                const fns = detectFunctions(text, lines);
                if (fns.length > 0) { fileToFunctions.set(uri.fsPath, fns); }
            }

            // Step 2: for each definition, find external call sites
            const ch = getOutputChannel();
            ch.clear();
            ch.appendLine('╔═══════════════════════════════════════════════════╗');
            ch.appendLine('║       ArchSetu — Cross-File Call Graph            ║');
            ch.appendLine('║  Shows every file that calls each of your funcs  ║');
            ch.appendLine('╚═══════════════════════════════════════════════════╝');
            ch.appendLine('');

            let totalConnections  = 0;
            let filesWithConn     = 0;

            for (const [defFilePath, fns] of fileToFunctions) {
                const defDisplayName = toDisplayPath(defFilePath);
                const outgoingCalls  = new Map<string, CallSite[]>();

                for (const fn of fns) {
                    const sites: CallSite[] = [];
                    const pattern = new RegExp(`\\b${escapeRegex(fn.name)}\\s*\\(`, 'g');

                    for (const uri of allFiles) {
                        if (uri.fsPath === defFilePath) { continue; }
                        const callerText = readFileText(uri.fsPath);
                        if (!callerText) { continue; }
                        const callerLines = callerText.split('\n');
                        pattern.lastIndex = 0;

                        let match: RegExpExecArray | null;
                        while ((match = pattern.exec(callerText)) !== null) {
                            const lineNum = (callerText.substring(0, match.index).match(/\n/g) ?? []).length;
                            sites.push({
                                filePath: uri.fsPath,
                                fileName: toDisplayPath(uri.fsPath),
                                line: lineNum,
                                lineText: (callerLines[lineNum] ?? '').trim(),
                            });
                        }
                    }

                    if (sites.length > 0) {
                        outgoingCalls.set(fn.name, sites);
                        totalConnections += sites.length;
                    }
                }

                if (outgoingCalls.size === 0) { continue; }

                filesWithConn++;
                ch.appendLine(`📁  ${defDisplayName}`);
                ch.appendLine('─'.repeat(52));

                for (const [fnName, sites] of outgoingCalls) {
                    ch.appendLine(`  ${fnName}()`);
                    for (const site of sites) {
                        ch.appendLine(`    → ${site.fileName}  :  line ${site.line + 1}`);
                        ch.appendLine(`      ${site.lineText}`);
                    }
                    ch.appendLine('');
                }
                ch.appendLine('');
            }

            if (filesWithConn === 0) {
                ch.appendLine('  No cross-file function calls detected.');
            }

            ch.appendLine('═══════════════════════════════════════════════════════');
            ch.appendLine(`  Files scanned             : ${allFiles.length}`);
            ch.appendLine(`  Files with connections    : ${filesWithConn}`);
            ch.appendLine(`  Total cross-file calls    : ${totalConnections}`);
            ch.appendLine('═══════════════════════════════════════════════════════');
            ch.show(true);
        }
    );
}
