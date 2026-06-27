import * as vscode from 'vscode';
import * as path from 'path';
import { ChangeImpactResult, ImportedBy, RiskLevel } from '../types';
import { getAllWorkspaceFiles, readFileText, toDisplayPath } from '../utils/fileUtils';
import { escapeRegex } from '../utils/textUtils';
import { getComplexityScore } from '../analysis/ComplexityAnalyzer';
import { findCallSites } from '../analysis/CallSiteAnalyzer';
import { astCache, AstCacheDiagnostics, formatDiagnostics } from '../analysis/AstCache';
import { getOutputChannel } from '../utils/outputChannel';

// =============================================================================
// Import Analysis
// =============================================================================

/**
 * Returns the module specifiers imported by a file.
 * e.g.  import { foo } from './bar'  →  './bar'
 */
function extractImportedModules(text: string): string[] {
    const imports: string[] = [];
    const re = /(?:import\s+[^;]+from\s+['"`]([^'"`]+)['"`]|require\s*\(\s*['"`]([^'"`]+)['"`]\s*\))/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
        imports.push(m[1] ?? m[2] ?? '');
    }
    return imports;
}

/**
 * Finds every file in the workspace that imports from `sourceFilePath`.
 * Uses the source file's basename (without extension) as the match key, which
 * handles relative imports without requiring full path resolution.
 */
async function findImporters(
    sourceFilePath: string,
    allFiles: vscode.Uri[]
): Promise<ImportedBy[]> {
    const sourceBase = path.basename(sourceFilePath).replace(/\.(ts|tsx|js|jsx)$/, '');
    // Escape the name and require it to be preceded by / or ' or " to avoid
    // accidentally matching longer names (e.g. "AuthService" matching "OldAuthService").
    const importRe = new RegExp(
        `(?:import\\s+[^;]+from\\s+['"\`][^'"\`]*[\\/]${escapeRegex(sourceBase)}['"\`]` +
        `|require\\s*\\(\\s*['"\`][^'"\`]*[\\/]${escapeRegex(sourceBase)}['"\`]\\s*\\))`,
        'g'
    );

    const importers: ImportedBy[] = [];

    for (const uri of allFiles) {
        if (uri.fsPath === sourceFilePath) { continue; }
        const text = readFileText(uri.fsPath);
        if (!text) { continue; }

        importRe.lastIndex = 0;
        const m = importRe.exec(text);
        if (!m) { continue; }

        const lineNum = (text.substring(0, m.index).match(/\n/g) ?? []).length;
        importers.push({
            filePath: uri.fsPath,
            fileName: toDisplayPath(uri.fsPath),
            line: lineNum,
            importStatement: (text.split('\n')[lineNum] ?? '').trim(),
        });
    }

    return importers;
}

// =============================================================================
// Export Check
// =============================================================================

function isSymbolExported(symbolName: string, text: string): boolean {
    const patterns = [
        new RegExp(`export\\s+(?:default\\s+)?(?:async\\s+)?function\\s+${escapeRegex(symbolName)}\\b`),
        new RegExp(`export\\s+(?:const|let|var)\\s+${escapeRegex(symbolName)}\\b`),
        new RegExp(`export\\s+(?:abstract\\s+)?class\\s+${escapeRegex(symbolName)}\\b`),
        new RegExp(`exports\\.${escapeRegex(symbolName)}\\s*=`),
        new RegExp(`module\\.exports\\.${escapeRegex(symbolName)}\\s*=`),
    ];
    return patterns.some(p => p.test(text));
}

// =============================================================================
// Risk Scoring
// =============================================================================

interface RiskParams {
    callSiteCount:         number;
    fileCount:             number;
    importedByCount:       number;
    hasApiRoutes:          boolean;
    hasFrontendComponents: boolean;
    complexity:            number;
    hasCircularDeps:       boolean;
    isExported:            boolean;
    hasTestFile:           boolean;
}

function calculateRiskScore(p: RiskParams): number {
    let score = 0;

    // How many places call this symbol (0–25)
    if      (p.callSiteCount > 20) { score += 25; }
    else if (p.callSiteCount > 10) { score += 18; }
    else if (p.callSiteCount > 5)  { score += 12; }
    else if (p.callSiteCount > 1)  { score +=  6; }

    // How many files are affected (0–20)
    if      (p.fileCount > 10) { score += 20; }
    else if (p.fileCount > 5)  { score += 15; }
    else if (p.fileCount > 2)  { score += 10; }
    else if (p.fileCount > 0)  { score +=  5; }

    // Import coupling — how many modules depend on the source file (0–15)
    if      (p.importedByCount > 5) { score += 15; }
    else if (p.importedByCount > 2) { score += 10; }
    else if (p.importedByCount > 0) { score +=  5; }

    // API exposure — touches live routes (0–10)
    if (p.hasApiRoutes) { score += 10; }

    // Frontend usage — renders in React/JSX components (0–8)
    if (p.hasFrontendComponents) { score += 8; }

    // Code complexity (0–10)
    if      (p.complexity > 15) { score += 10; }
    else if (p.complexity > 10) { score +=  7; }
    else if (p.complexity > 5)  { score +=  3; }

    // Circular dependency found (0–12)
    if (p.hasCircularDeps) { score += 12; }

    // Part of the public API (0–5)
    if (p.isExported) { score += 5; }

    // No test coverage (0–5)
    if (!p.hasTestFile) { score += 5; }

    return Math.min(100, Math.max(0, score));
}

function toRiskLevel(score: number): RiskLevel {
    if (score >= 76) { return 'CRITICAL'; }
    if (score >= 51) { return 'HIGH'; }
    if (score >= 26) { return 'MEDIUM'; }
    return 'LOW';
}

// =============================================================================
// Test Recommendation
// =============================================================================

async function findTestFiles(basenames: string[]): Promise<string[]> {
    const testUris = await vscode.workspace.findFiles(
        '**/*.{test,spec}.{ts,js,tsx,jsx}',
        '**/node_modules/**'
    );

    const existing = new Map<string, string>();
    for (const uri of testUris) {
        const stem = path.basename(uri.fsPath).replace(/\.(test|spec)\.(ts|js|tsx|jsx)$/, '');
        existing.set(stem, toDisplayPath(uri.fsPath));
    }

    const results: string[] = [];
    for (const base of basenames) {
        if (existing.has(base)) {
            results.push(existing.get(base)!);
        } else {
            results.push(`${base}.test.ts  (create this file)`);
        }
    }
    return results;
}

// =============================================================================
// Main Analyzer
// =============================================================================

/**
 * Performs a full Change Impact analysis for the given symbol in the given file.
 * All analysis is static — no AI, no network calls.
 *
 * The AST cache is used to look up parsed function definitions.  If the
 * requested document is absent from the cache (e.g. a newly opened file that
 * was never indexed), the cache parses it lazily rather than failing.
 * Diagnostics are written to the ArchSetu output channel for debugging.
 */
export async function analyzeChangeImpact(
    symbolName: string,
    sourceFilePath: string
): Promise<ChangeImpactResult> {
    const allFiles   = await getAllWorkspaceFiles();

    // Read source text — returns '' safely if the file cannot be read
    const sourceText  = readFileText(sourceFilePath) ?? '';
    const sourceLines = sourceText.split('\n');

    // Complexity of the target symbol via the AST cache (lazy-parse on miss)
    const diag: AstCacheDiagnostics = {
        cacheSize: 0, requestedPath: '', normalisedKey: '',
        cachedKeys: [], cacheHit: false, parsedLazily: false, functionCount: 0,
    };
    const sourceFns = astCache.getWithDiagnostics(sourceFilePath, diag);

    // Emit AST-cache diagnostics to the output channel for debugging
    const ch = getOutputChannel();
    for (const line of formatDiagnostics(diag)) { ch.appendLine(line); }

    const symbolFn   = sourceFns.find(f => f.name === symbolName);
    const complexity = symbolFn
        ? getComplexityScore(sourceLines.slice(symbolFn.line, symbolFn.endLine + 1))
        : 1;

    // Is it exported from its file?
    const isExported = isSymbolExported(symbolName, sourceText);

    // All call sites in the workspace (excluding the definition file itself)
    const callSites      = await findCallSites(symbolName, sourceFilePath);
    const uniqueFiles    = new Set(callSites.map(cs => cs.filePath));

    // Files that import the source file
    const importedBy = await findImporters(sourceFilePath, allFiles);

    // Collect all affected file paths for route / component detection
    const affectedPaths = new Set<string>([
        ...callSites.map(cs => cs.filePath),
        ...importedBy.map(ib => ib.filePath),
    ]);

    const apiRoutes:          string[] = [];
    const frontendComponents: string[] = [];
    const routeRe = /(?:app|router|server)\.(get|post|put|patch|delete|use|all)\s*\(\s*['"`]([^'"`]+)['"`]/gi;

    for (const fp of affectedPaths) {
        const t = readFileText(fp);

        routeRe.lastIndex = 0;
        let rm: RegExpExecArray | null;
        while ((rm = routeRe.exec(t)) !== null) {
            const route = `${rm[1].toUpperCase()} ${rm[2]}`;
            if (!apiRoutes.includes(route)) { apiRoutes.push(route); }
        }

        if (/\.(tsx|jsx)$/.test(fp)) {
            const name = path.basename(fp);
            if (!frontendComponents.includes(name)) { frontendComponents.push(name); }
        }
    }

    // Circular dependency check (direct A→B→A cycles only)
    const sourceBase  = path.basename(sourceFilePath).replace(/\.(ts|tsx|js|jsx)$/, '');
    const sourceImports = extractImportedModules(sourceText);
    const circularDeps: string[] = [];

    for (const ib of importedBy) {
        const importerBase    = path.basename(ib.filePath).replace(/\.(ts|tsx|js|jsx)$/, '');
        const importerImports = extractImportedModules(readFileText(ib.filePath));
        // If the source file ALSO imports from the importer → direct cycle
        if (
            sourceImports.some(imp => imp.includes(importerBase)) &&
            importerImports.some(imp => imp.includes(sourceBase))
        ) {
            circularDeps.push(ib.fileName);
        }
    }

    // Test file recommendations
    const testBasenames = [
        path.basename(sourceFilePath).replace(/\.(ts|tsx|js|jsx)$/, ''),
        ...callSites
            .map(cs => path.basename(cs.filePath).replace(/\.(ts|tsx|js|jsx)$/, ''))
            .filter((v, i, arr) => arr.indexOf(v) === i),
    ].slice(0, 6);

    const recommendedTests = await findTestFiles(testBasenames);

    const hasTestFile = recommendedTests.some(t => !t.includes('(create'));

    const riskScore = calculateRiskScore({
        callSiteCount:         callSites.length,
        fileCount:             uniqueFiles.size,
        importedByCount:       importedBy.length,
        hasApiRoutes:          apiRoutes.length > 0,
        hasFrontendComponents: frontendComponents.length > 0,
        complexity,
        hasCircularDeps:       circularDeps.length > 0,
        isExported,
        hasTestFile,
    });

    return {
        symbolName,
        symbolFile:           toDisplayPath(sourceFilePath),
        calledByCount:        callSites.length,
        usedInFilesCount:     uniqueFiles.size,
        importedByModules:    importedBy.slice(0, 20),
        apiRoutes:            apiRoutes.slice(0, 10),
        frontendComponents:   frontendComponents.slice(0, 10),
        riskScore,
        riskLevel:            toRiskLevel(riskScore),
        recommendedTests:     recommendedTests.slice(0, 8),
        circularDependencies: circularDeps,
        isExported,
        complexity,
        callSites:            callSites.slice(0, 50),
    };
}
