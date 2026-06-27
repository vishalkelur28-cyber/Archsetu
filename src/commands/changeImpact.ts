import * as vscode from 'vscode';
import { getActiveEditor } from '../utils/editorUtils';
import { analyzeChangeImpact } from '../analysis/ChangeImpactAnalyzer';
import { buildChangeImpactHTML } from '../ui/ChangeImpactPanel';
import { extractSymbolAtCursor } from '../utils/symbolExtractor';

export async function changeImpactSimulator(): Promise<void> {
    const editor = getActiveEditor();
    if (!editor) { return; }

    if (!vscode.workspace.workspaceFolders?.length) {
        void vscode.window.showWarningMessage(
            'ArchSetu: Please open a folder or workspace first.'
        );
        return;
    }

    const symbolName = extractSymbolAtCursor(editor.document, editor.selection.active);
    if (!symbolName) {
        void vscode.window.showWarningMessage(
            'ArchSetu: Place your cursor on a function, class, or symbol name, then run Change Impact Simulator.'
        );
        return;
    }

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title:    `ArchSetu: Simulating change impact for "${symbolName}"…`,
            cancellable: false,
        },
        async () => {
            const result = await analyzeChangeImpact(
                symbolName,
                editor.document.uri.fsPath
            );

            const panel = vscode.window.createWebviewPanel(
                'archsetuChangeImpact',
                `Impact: ${symbolName}`,
                vscode.ViewColumn.Two,
                { enableScripts: false }
            );

            panel.webview.html = buildChangeImpactHTML(result);
        }
    );
}
