import * as path from 'path';
import { getActiveEditor } from '../utils/editorUtils';
import { getOutputChannel } from '../utils/outputChannel';
import { normalizeText } from '../utils/textUtils';
import { detectFunctions } from '../parser/FunctionParser';
import { getComplexityScore, complexityLabel, countClasses, countImports } from '../analysis/ComplexityAnalyzer';

export async function explainFile(): Promise<void> {
    const editor = getActiveEditor();
    if (!editor) { return; }

    const { text, lines } = normalizeText(editor.document);
    const fileName = path.basename(editor.document.fileName);
    const functions = detectFunctions(text, lines);
    const classes  = countClasses(lines);
    const imports  = countImports(lines);

    let mostComplexName  = 'none';
    let mostComplexScore = 0;
    for (const fn of functions) {
        const score = getComplexityScore(lines.slice(fn.line, fn.endLine + 1));
        if (score > mostComplexScore) { mostComplexScore = score; mostComplexName = fn.name; }
    }

    const ch = getOutputChannel();
    ch.clear();
    ch.appendLine('╔═══════════════════════════════════════════════╗');
    ch.appendLine('║           ArchSetu — File Analysis            ║');
    ch.appendLine('╚═══════════════════════════════════════════════╝');
    ch.appendLine('');
    ch.appendLine(`  File          :  ${fileName}`);
    ch.appendLine(`  Total Lines   :  ${lines.length}`);
    ch.appendLine(`  Functions     :  ${functions.length}`);
    ch.appendLine(`  Classes       :  ${classes}`);
    ch.appendLine(`  Imports       :  ${imports}`);
    if (functions.length > 0) {
        ch.appendLine(`  Most Complex  :  ${mostComplexName}()  — score ${complexityLabel(mostComplexScore)}`);
    }
    ch.appendLine('');
    ch.appendLine('═══════════════════════════════════════════════════');
    ch.show(true);
}
