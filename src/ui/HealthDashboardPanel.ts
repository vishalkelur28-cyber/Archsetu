import { DashboardData } from '../types';

function rows<T>(items: T[], tpl: (item: T, i: number) => string): string {
    return items.map(tpl).join('');
}

/** Builds the full HTML for the Codebase Health Dashboard webview. */
export function buildHealthDashboardHTML(data: DashboardData): string {
    const scoreColor = data.healthScore >= 70 ? '#4caf50'
        : data.healthScore >= 40             ? '#ff9800'
        :                                      '#f44336';

    const scoreLabel = data.healthScore >= 70 ? 'Healthy'
        : data.healthScore >= 40             ? 'Needs Attention'
        :                                      'Critical';

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>ArchSetu Health Dashboard</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: var(--vscode-editor-background, #1e1e1e);
    color: var(--vscode-editor-foreground, #d4d4d4);
    padding: 28px 32px; line-height: 1.5;
  }
  h1 { color: #569cd6; font-size: 1.5rem; margin-bottom: 4px; }
  .subtitle { color: #888; font-size: 0.875rem; margin-bottom: 28px; }
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 14px; margin-bottom: 32px;
  }
  .kpi {
    background: #252526; border: 1px solid #3c3c3c;
    border-radius: 8px; padding: 18px; text-align: center;
  }
  .kpi .val { font-size: 2rem; font-weight: 700; color: #4ec9b0; }
  .kpi .lbl { font-size: 0.8rem; color: #888; margin-top: 4px; }
  .kpi.score .val { font-size: 2.8rem; color: ${scoreColor}; }
  .kpi.score .badge { font-size: 0.72rem; font-weight: 700; color: ${scoreColor}; margin-top: 2px; }
  section { margin-bottom: 30px; }
  section h2 {
    font-size: 0.78rem; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.08em; color: #c586c0;
    border-bottom: 1px solid #3c3c3c; padding-bottom: 8px; margin-bottom: 14px;
  }
  table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
  th { text-align: left; color: #6a9955; font-weight: 400; padding: 5px 10px; border-bottom: 1px solid #3c3c3c; }
  td { padding: 7px 10px; border-bottom: 1px solid #2a2a2a; }
  tr:hover td { background: #2a2a2a; }
  .num { color: #888; width: 28px; }
  .accent { color: #ce9178; }
  .warn { color: #ff9800; font-size: 0.78rem; margin-left: 6px; }
  .ok   { color: #4caf50; font-size: 0.78rem; margin-left: 6px; }
  .note { color: #666; font-size: 0.78rem; margin-top: 8px; }
</style>
</head>
<body>
<h1>ArchSetu — Codebase Health Dashboard</h1>
<p class="subtitle">Static analysis · JavaScript / TypeScript</p>

<div class="kpi-grid">
  <div class="kpi score">
    <div class="val">${data.healthScore}</div>
    <div class="badge">${scoreLabel}</div>
    <div class="lbl">Health Score / 100</div>
  </div>
  <div class="kpi">
    <div class="val">${data.totalFiles}</div>
    <div class="lbl">JS / TS Files</div>
  </div>
  <div class="kpi">
    <div class="val">${data.totalFunctions.toLocaleString()}</div>
    <div class="lbl">Total Functions</div>
  </div>
  <div class="kpi">
    <div class="val">${data.totalLines.toLocaleString()}</div>
    <div class="lbl">Lines of Code</div>
  </div>
  <div class="kpi">
    <div class="val">${data.avgComplexity}</div>
    <div class="lbl">Avg Max Complexity</div>
  </div>
</div>

<section>
  <h2>Complexity Hotspots — Top 5 Most Complex Files</h2>
  <table>
    <tr><th class="num">#</th><th>File</th><th>Worst Function</th><th>Complexity</th></tr>
    ${rows(data.complexityHotspots, (f, i) => `
    <tr>
      <td class="num">${i + 1}</td>
      <td>${f.relPath}</td>
      <td class="accent">${f.mostComplexFn}()</td>
      <td>${f.maxComplexity}${f.maxComplexity > 10 ? '<span class="warn">⚠ High</span>' : f.maxComplexity > 5 ? '<span class="warn">~ Med</span>' : '<span class="ok">✓ Low</span>'}</td>
    </tr>`)}
  </table>
  <p class="note">Complexity 1–5 = easy to read · 6–10 = getting complex · 11+ = hard to maintain</p>
</section>

<section>
  <h2>Largest Files — Top 5 by Line Count</h2>
  <table>
    <tr><th class="num">#</th><th>File</th><th>Lines</th></tr>
    ${rows(data.largestFiles, (f, i) => `
    <tr>
      <td class="num">${i + 1}</td>
      <td>${f.relPath}</td>
      <td>${f.lineCount.toLocaleString()}${f.lineCount > 500 ? '<span class="warn">⚠ Large</span>' : ''}</td>
    </tr>`)}
  </table>
  <p class="note">Files over 500 lines are often doing too many things at once.</p>
</section>

<section>
  <h2>Highest Coupling — Top 5 Files by Import Count</h2>
  <table>
    <tr><th class="num">#</th><th>File</th><th>Imports</th></tr>
    ${rows(data.mostDependentFiles, (f, i) => `
    <tr>
      <td class="num">${i + 1}</td>
      <td>${f.relPath}</td>
      <td>${f.importCount}${f.importCount > 15 ? '<span class="warn">⚠ High coupling</span>' : ''}</td>
    </tr>`)}
  </table>
  <p class="note">High coupling makes refactoring harder and bugs harder to isolate.</p>
</section>
</body>
</html>`;
}
