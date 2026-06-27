import * as vscode from 'vscode';
import { FunctionInfo } from '../types';
import { detectFunctions } from '../parser/FunctionParser';
import { getComplexityScore } from '../analysis/ComplexityAnalyzer';
import { normalizeText } from '../utils/textUtils';

let _statusBar: vscode.StatusBarItem | undefined;
let _cache: { version: number; uri: string; functions: FunctionInfo[] } | undefined;

function getCachedFunctions(document: vscode.TextDocument): FunctionInfo[] {
    if (
        _cache &&
        _cache.uri     === document.uri.toString() &&
        _cache.version === document.version
    ) {
        return _cache.functions;
    }
    const { text, lines } = normalizeText(document);
    const functions = detectFunctions(text, lines);
    _cache = { version: document.version, uri: document.uri.toString(), functions };
    return functions;
}

export function updateStatusBar(editor: vscode.TextEditor | undefined): void {
    if (!_statusBar) { return; }

    if (!editor || !/\.(js|ts|jsx|tsx)$/.test(editor.document.fileName)) {
        _statusBar.hide();
        return;
    }

    const functions = getCachedFunctions(editor.document);
    const { lines } = normalizeText(editor.document);

    if (functions.length === 0) { _statusBar.hide(); return; }

    const cursorLine = editor.selection.active.line;
    let currentFn: FunctionInfo | undefined;

    for (const fn of functions) {
        if (fn.line <= cursorLine && cursorLine <= fn.endLine) {
            if (!currentFn || fn.line > currentFn.line) { currentFn = fn; }
        }
    }

    if (!currentFn) {
        _statusBar.text = '$(symbol-misc) ArchSetu';
        _statusBar.backgroundColor = undefined;
        _statusBar.show();
        return;
    }

    const score  = getComplexityScore(lines.slice(currentFn.line, currentFn.endLine + 1));
    const fnName = currentFn.name;

    if (score <= 5) {
        _statusBar.text = `$(symbol-function) ${fnName}  ⚡ ${score} Low`;
        _statusBar.backgroundColor = undefined;
    } else if (score <= 10) {
        _statusBar.text = `$(symbol-function) ${fnName}  ⚡ ${score} Med`;
        _statusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
        _statusBar.text = `$(symbol-function) ${fnName}  ⚡ ${score} HIGH`;
        _statusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    }

    _statusBar.show();
}

/** Creates the status bar item and wires up cursor/editor events. */
export function createStatusBar(context: vscode.ExtensionContext): void {
    _statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    _statusBar.tooltip = 'ArchSetu — Complexity of the function your cursor is in.\nClick to list all functions.';
    _statusBar.command = 'archsetu.listFunctions';
    context.subscriptions.push(_statusBar);

    context.subscriptions.push(
        vscode.window.onDidChangeTextEditorSelection(e => updateStatusBar(e.textEditor))
    );
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(editor => updateStatusBar(editor))
    );

    updateStatusBar(vscode.window.activeTextEditor);
}

/** Frees all status bar resources. Called on extension deactivation. */
export function disposeStatusBar(): void {
    _statusBar?.dispose();
    _statusBar = undefined;
    _cache     = undefined;
}
