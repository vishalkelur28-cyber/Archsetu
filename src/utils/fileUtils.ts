import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/** Returns all JS/TS source files in the workspace, excluding node_modules, .d.ts files,
 *  and common build-output directories (out/, dist/, build/, .next/, coverage/).
 *  Build directories must be excluded because compiled JS files double-count every named
 *  function definition, causing dead-code false negatives. */
export async function getAllWorkspaceFiles(): Promise<vscode.Uri[]> {
    return vscode.workspace.findFiles(
        '**/*.{js,ts,jsx,tsx}',
        '{**/node_modules/**,**/*.d.ts,**/out/**,**/dist/**,**/build/**,**/.next/**,**/coverage/**}'
    );
}

/**
 * Reads a file from disk and normalises line endings to \n.
 * Returns an empty string if the file cannot be read.
 */
export function readFileText(filePath: string): string {
    try {
        return fs.readFileSync(filePath, 'utf8')
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n');
    } catch {
        return '';
    }
}

/** Returns the workspace-relative forward-slash path for display in the UI. */
export function toDisplayPath(absPath: string): string {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
    return path.relative(root, absPath).replace(/\\/g, '/');
}
