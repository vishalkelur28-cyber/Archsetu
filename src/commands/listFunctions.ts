import { getActiveEditor } from '../utils/editorUtils';
import { getOutputChannel } from '../utils/outputChannel';
import { normalizeText } from '../utils/textUtils';
import { detectFunctions } from '../parser/FunctionParser';
import { getComplexityScore } from '../analysis/ComplexityAnalyzer';

export async function listFunctions(): Promise<void> {
    const editor = getActiveEditor();
    if (!editor) { return; }

    const { text, lines } = normalizeText(editor.document);
    const functions = detectFunctions(text, lines);

    const ch = getOutputChannel();
    ch.clear();
    ch.appendLine('╔═══════════════════════════════════════════════╗');
    ch.appendLine('║          ArchSetu — Function List             ║');
    ch.appendLine('╚═══════════════════════════════════════════════╝');
    ch.appendLine('');
    ch.appendLine('  #    Name                            Line    Length   Complexity');
    ch.appendLine('  ' + '─'.repeat(65));

    if (functions.length === 0) {
        ch.appendLine('  No functions detected in this file.');
    } else {
        for (const [i, fn] of functions.entries()) {
            const num        = String(i + 1).padStart(3);
            const name       = fn.name.padEnd(32);
            const line       = String(fn.line + 1).padStart(4);
            const length     = String(fn.endLine - fn.line + 1).padStart(4) + ' lines';
            const score      = getComplexityScore(lines.slice(fn.line, fn.endLine + 1));
            const complexity = score <= 5 ? `${score} Low` : score <= 10 ? `${score} Med` : `${score} HIGH`;
            ch.appendLine(`  ${num}  ${name}  ${line}   ${length}   ${complexity}`);
        }
    }

    ch.appendLine('');
    ch.appendLine(`  Total: ${functions.length} function(s)`);
    ch.appendLine('═══════════════════════════════════════════════════');
    ch.show(true);
}
