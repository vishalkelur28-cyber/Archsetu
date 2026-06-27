/**
 * Cyclomatic complexity scoring.
 * Every decision point (if, for, while, &&, ||, ternary) adds one branch.
 *
 * Score guide:
 *   1–5   Simple — easy to understand and test.
 *   6–10  Moderate — consider adding comments.
 *   11+   High — good candidate to split into smaller functions.
 */
export function getComplexityScore(bodyLines: string[]): number {
    const body = bodyLines.join('\n');
    const controlFlow = (body.match(/\b(if|else\s+if|for|while|do\s*\{|case\s+|catch\s*\()\b/g) ?? []).length;
    const logicalOps  = (body.match(/(\&\&|\|\|)/g) ?? []).length;
    const ternary     = (body.match(/(?<!\?)\?(?![\.\?\:])/g) ?? []).length;
    return 1 + controlFlow + logicalOps + ternary;
}

/** Human-readable label for a complexity score. */
export function complexityLabel(score: number): string {
    if (score <= 5)  { return `${score}  (Low — easy to read)`; }
    if (score <= 10) { return `${score}  (Medium — some complexity)`; }
    return `${score}  (High — consider splitting this function)`;
}

/** Counts class definitions in a file's lines. */
export function countClasses(lines: readonly string[]): number {
    const re = /^\s*(?:export\s+)?(?:abstract\s+)?class\s+[a-zA-Z_$]/;
    return lines.filter(l => re.test(l)).length;
}

/** Counts import/require statements in a file's lines. */
export function countImports(lines: readonly string[]): number {
    return lines.filter(l =>
        /^\s*import\s+/.test(l) || /\brequire\s*\(/.test(l)
    ).length;
}
