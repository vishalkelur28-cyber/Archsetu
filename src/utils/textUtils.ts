import * as vscode from 'vscode';

/** Reads a VS Code document and normalises all line endings to \n. */
export function normalizeText(document: vscode.TextDocument): { text: string; lines: string[] } {
    const text = document.getText().replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    return { text, lines: text.split('\n') };
}

/** Makes a plain string safe to embed inside a RegExp. */
export function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
