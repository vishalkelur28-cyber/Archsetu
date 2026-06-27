import * as vscode from 'vscode';
import { getActiveEditor } from '../utils/editorUtils';
import { getOutputChannel } from '../utils/outputChannel';
import { findCallSites } from '../analysis/CallSiteAnalyzer';
import { CallSite } from '../types';
import { extractSymbolAtCursor } from '../utils/symbolExtractor';

export async function blastRadiusAnalysis(): Promise<void> {
    const editor = getActiveEditor();
    if (!editor) { return; }

    const targetName = extractSymbolAtCursor(editor.document, editor.selection.active);
    if (!targetName) {
        void vscode.window.showWarningMessage(
            'ArchSetu: Place your cursor on a function name, then run Blast Radius.'
        );
        return;
    }

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: `ArchSetu: Calculating blast radius for "${targetName}"…`,
            cancellable: false,
        },
        async () => {
            const callSites = await findCallSites(targetName);

            const byFile = new Map<string, CallSite[]>();
            for (const site of callSites) {
                const list = byFile.get(site.fileName) ?? [];
                list.push(site);
                byFile.set(site.fileName, list);
            }

            const ch = getOutputChannel();
            ch.clear();
            ch.appendLine('╔═══════════════════════════════════════════════════╗');
            ch.appendLine('║         ArchSetu — Blast Radius Analysis         ║');
            ch.appendLine('║  Everything that depends on this function        ║');
            ch.appendLine('╚═══════════════════════════════════════════════════╝');
            ch.appendLine('');
            ch.appendLine(`  Function        :  ${targetName}()`);
            ch.appendLine(`  Affected files  :  ${byFile.size}`);
            ch.appendLine(`  Total call sites:  ${callSites.length}`);
            ch.appendLine('');

            if (callSites.length === 0) {
                ch.appendLine('  This function has zero call sites in the project.');
                ch.appendLine('  It may be safe to delete, or it could be called dynamically.');
            } else {
                ch.appendLine('  All of the following will need attention if you change this function:');
                ch.appendLine('');
                for (const [fileName, sites] of byFile) {
                    ch.appendLine(`  📁 ${fileName}  (${sites.length} call site(s))`);
                    for (const site of sites) {
                        ch.appendLine(`      line ${String(site.line + 1).padStart(4)} :  ${site.lineText}`);
                    }
                    ch.appendLine('');
                }
            }

            ch.appendLine('═══════════════════════════════════════════════════════');
            ch.show(true);
        }
    );
}
