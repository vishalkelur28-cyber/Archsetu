import * as vscode from 'vscode';

/**
 * Returns the currently active text editor.
 * Shows a warning and returns undefined if no editor is open.
 */
export function getActiveEditor(): vscode.TextEditor | undefined {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        void vscode.window.showWarningMessage(
            'ArchSetu: No active editor found. Please open a file first.'
        );
        return undefined;
    }
    return editor;
}

/**
 * Returns true if at least one workspace folder is open.
 * Shows a warning and returns false otherwise.
 */
export function requireWorkspace(): boolean {
    if (!vscode.workspace.workspaceFolders?.length) {
        void vscode.window.showWarningMessage(
            'ArchSetu: Please open a folder or workspace first.'
        );
        return false;
    }
    return true;
}
