import * as vscode from 'vscode';
import { requireWorkspace } from '../utils/editorUtils';
import { getAllWorkspaceFiles, readFileText, toDisplayPath } from '../utils/fileUtils';
import { detectFunctions } from '../parser/FunctionParser';
import { getComplexityScore, countImports } from '../analysis/ComplexityAnalyzer';
import { buildHealthDashboardHTML } from '../ui/HealthDashboardPanel';
import { FileStats } from '../types';

export async function codebaseHealthDashboard(): Promise<void> {
    if (!requireWorkspace()) { return; }

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'ArchSetu: Analyzing codebase health…',
            cancellable: false,
        },
        async () => {
            const allFiles = await getAllWorkspaceFiles();
            if (allFiles.length === 0) {
                void vscode.window.showWarningMessage('ArchSetu: No JS/TS files found in workspace.');
                return;
            }

            const fileStats: FileStats[]  = [];
            let totalFunctions = 0;
            let totalLines     = 0;

            for (const uri of allFiles) {
                const text = readFileText(uri.fsPath);
                if (!text) { continue; }

                const lines = text.split('\n');
                const fns   = detectFunctions(text, lines);

                let maxComplexity  = 0;
                let mostComplexFn  = '(none)';
                for (const fn of fns) {
                    const score = getComplexityScore(lines.slice(fn.line, fn.endLine + 1));
                    if (score > maxComplexity) { maxComplexity = score; mostComplexFn = fn.name; }
                }

                fileStats.push({
                    relPath: toDisplayPath(uri.fsPath),
                    lineCount: lines.length,
                    functionCount: fns.length,
                    maxComplexity,
                    mostComplexFn,
                    importCount: countImports(lines),
                });

                totalFunctions += fns.length;
                totalLines     += lines.length;
            }

            const complexityHotspots = [...fileStats]
                .sort((a, b) => b.maxComplexity - a.maxComplexity)
                .slice(0, 5);

            const largestFiles = [...fileStats]
                .sort((a, b) => b.lineCount - a.lineCount)
                .slice(0, 5);

            const mostDependentFiles = [...fileStats]
                .sort((a, b) => b.importCount - a.importCount)
                .slice(0, 5);

            const avgComplexity = fileStats.length > 0
                ? fileStats.reduce((sum, f) => sum + f.maxComplexity, 0) / fileStats.length
                : 0;

            const healthScore = Math.max(0, Math.min(100, Math.round(100 - avgComplexity * 4)));

            const panel = vscode.window.createWebviewPanel(
                'archsetuHealth',
                'ArchSetu — Health Dashboard',
                vscode.ViewColumn.Two,
                { enableScripts: false }
            );

            panel.webview.html = buildHealthDashboardHTML({
                totalFiles: allFiles.length,
                totalFunctions,
                totalLines,
                healthScore,
                avgComplexity: Math.round(avgComplexity * 10) / 10,
                complexityHotspots,
                largestFiles,
                mostDependentFiles,
            });
        }
    );
}
