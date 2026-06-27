import * as vscode from 'vscode';
import { getActiveEditor } from '../utils/editorUtils';
import { normalizeText } from '../utils/textUtils';
import { detectFunctions } from '../parser/FunctionParser';

const ICON = '$(symbol-function) ';

export async function showFunctions(): Promise<void> {
    const editor = getActiveEditor();
    if (!editor) { return; }

    const { text, lines } = normalizeText(editor.document);
    const functions = detectFunctions(text, lines);

    if (functions.length === 0) {
        void vscode.window.showInformationMessage('ArchSetu: No functions found in this file.');
        return;
    }

    const items: vscode.QuickPickItem[] = functions.map(fn => ({
        label: `${ICON}${fn.name}`,
        description: `line ${fn.line + 1}`,
        detail: (lines[fn.line] ?? '').trim(),
    }));

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Type to search. Select a function to jump to it.',
        matchOnDescription: true,
        matchOnDetail: true,
    });

    if (!selected) { return; }

    const fnName = selected.label.replace(ICON, '');
    const fn = functions.find(f => f.name === fnName);
    if (!fn) { return; }

    const pos = new vscode.Position(fn.line, fn.character);
    editor.selection = new vscode.Selection(pos, pos);
    editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
}
