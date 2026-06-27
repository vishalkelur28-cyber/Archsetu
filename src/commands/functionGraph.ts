import { getActiveEditor } from '../utils/editorUtils';
import { getOutputChannel } from '../utils/outputChannel';
import { normalizeText } from '../utils/textUtils';
import { escapeRegex } from '../utils/textUtils';
import { detectFunctions } from '../parser/FunctionParser';

export async function functionGraph(): Promise<void> {
    const editor = getActiveEditor();
    if (!editor) { return; }

    const { text, lines } = normalizeText(editor.document);
    const functions = detectFunctions(text, lines);

    const ch = getOutputChannel();
    ch.clear();
    ch.appendLine('╔═══════════════════════════════════════════════╗');
    ch.appendLine('║     ArchSetu — Function Call Graph            ║');
    ch.appendLine('║     (within this file only)                   ║');
    ch.appendLine('╚═══════════════════════════════════════════════╝');

    if (functions.length === 0) {
        ch.appendLine('');
        ch.appendLine('  No functions detected in this file.');
        ch.appendLine('═══════════════════════════════════════════════════');
        ch.show(true);
        return;
    }

    const nameSet = new Set(functions.map(f => f.name));
    ch.appendLine('');

    for (const fn of functions) {
        const body  = lines.slice(fn.line + 1, fn.endLine + 1).join('\n');
        const calls: string[] = [];

        for (const name of nameSet) {
            if (name === fn.name) { continue; }
            if (new RegExp(`\\b${escapeRegex(name)}\\s*\\(`, 'g').test(body)) {
                calls.push(name);
            }
        }

        ch.appendLine(`  ${fn.name}()  —  line ${fn.line + 1}`);

        if (calls.length > 0) {
            calls.forEach((callee, idx) => {
                const connector = idx === calls.length - 1 ? '  └──' : '  ├──';
                ch.appendLine(`${connector} ${callee}()`);
            });
        } else {
            ch.appendLine('  └── (does not call any other function in this file)');
        }

        ch.appendLine('');
    }

    ch.appendLine('═══════════════════════════════════════════════════');
    ch.show(true);
}
