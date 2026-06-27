import { ChangeImpactResult, RiskLevel } from '../types';

const RISK_COLORS: Record<RiskLevel, string> = {
    LOW:      '#4caf50',
    MEDIUM:   '#ff9800',
    HIGH:     '#f97316',
    CRITICAL: '#f44336',
};

const RISK_BG: Record<RiskLevel, string> = {
    LOW:      'rgba(76,175,80,0.12)',
    MEDIUM:   'rgba(255,152,0,0.12)',
    HIGH:     'rgba(249,115,22,0.12)',
    CRITICAL: 'rgba(244,67,54,0.12)',
};

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function section(title: string, count: number, content: string): string {
    const badge = count > 0 ? `<span class="badge">${count}</span>` : '';
    return `
<details ${count > 0 ? 'open' : ''}>
  <summary>${esc(title)}${badge}</summary>
  <div class="section-body">${content}</div>
</details>`;
}

function pill(text: string, color: string): string {
    return `<span class="pill" style="background:${color}22;color:${color};border-color:${color}44">${esc(text)}</span>`;
}

/** Builds the complete Change Impact Simulator webview HTML. */
export function buildChangeImpactHTML(r: ChangeImpactResult): string {
    const rc     = RISK_COLORS[r.riskLevel];
    const rbg    = RISK_BG[r.riskLevel];
    const pct    = r.riskScore;

    // ── KPI cards ────────────────────────────────────────────────────────────
    const kpis = [
        { val: r.calledByCount,    lbl: 'Call Sites',         icon: '⬡' },
        { val: r.usedInFilesCount, lbl: 'Files Affected',     icon: '📁' },
        { val: r.importedByModules.length, lbl: 'Modules Import', icon: '📦' },
        { val: r.apiRoutes.length, lbl: 'API Routes',          icon: '🔗' },
        { val: r.frontendComponents.length, lbl: 'UI Components', icon: '🖼' },
    ].map(k => `
      <div class="kpi">
        <div class="kpi-icon">${k.icon}</div>
        <div class="kpi-val">${k.val}</div>
        <div class="kpi-lbl">${esc(k.lbl)}</div>
      </div>`).join('');

    // ── Detail sections ───────────────────────────────────────────────────────
    const routesContent = r.apiRoutes.length > 0
        ? r.apiRoutes.map(rt => `<div class="list-item route">${esc(rt)}</div>`).join('')
        : '<p class="empty">No API routes detected</p>';

    const componentsContent = r.frontendComponents.length > 0
        ? r.frontendComponents.map(c => `<div class="list-item component">${esc(c)}</div>`).join('')
        : '<p class="empty">No frontend components detected</p>';

    const importersContent = r.importedByModules.length > 0
        ? r.importedByModules.map(ib => `
          <div class="list-item importer">
            <span class="item-file">${esc(ib.fileName)}</span>
            <span class="item-line">line ${ib.line + 1}</span>
            <div class="item-code">${esc(ib.importStatement)}</div>
          </div>`).join('')
        : '<p class="empty">No direct module importers detected</p>';

    const testsContent = r.recommendedTests.length > 0
        ? r.recommendedTests.map((t, i) => {
            const isCreate = t.includes('(create');
            const label    = isCreate ? t.replace(' (create this file)', '') : t;
            const hint     = isCreate ? ' <span class="create-hint">create this file</span>' : '';
            return `<div class="list-item test ${isCreate ? 'missing' : 'exists'}">
              <span class="test-num">${i + 1}</span>
              ${esc(label)}${hint}
            </div>`;
          }).join('')
        : '<p class="empty">No test files found — create tests for safety</p>';

    const circularContent = r.circularDependencies.length > 0
        ? `<div class="circular-warning">
            <span class="warn-icon">⚠</span>
            <div>
              <strong>Circular imports detected!</strong>
              <div style="margin-top:6px">${r.circularDependencies.map(d => `<div class="list-item">${esc(d)}</div>`).join('')}</div>
            </div>
          </div>`
        : '<p class="empty ok-text">✓ No circular dependencies detected</p>';

    const callSitesContent = r.callSites.length > 0
        ? r.callSites.map(cs => `
          <div class="list-item callsite">
            <span class="item-file">${esc(cs.fileName)}</span>
            <span class="item-line">line ${cs.line + 1}</span>
            <div class="item-code">${esc(cs.lineText)}</div>
          </div>`).join('') +
          (r.calledByCount > 50 ? `<p class="empty" style="margin-top:8px">… and ${r.calledByCount - 50} more call sites</p>` : '')
        : '<p class="empty">No external call sites found</p>';

    const exportBadge = r.isExported ? pill('exported', '#569cd6') : '';
    const complexityBadge = r.complexity > 10
        ? pill(`complexity ${r.complexity} HIGH`, '#f44336')
        : r.complexity > 5
            ? pill(`complexity ${r.complexity} Med`, '#ff9800')
            : pill(`complexity ${r.complexity} Low`, '#4caf50');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Change Impact — ${esc(r.symbolName)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
    background: var(--vscode-editor-background, #1e1e1e);
    color: var(--vscode-editor-foreground, #d4d4d4);
    font-size: 13px;
    line-height: 1.55;
    padding: 0;
  }

  /* ── Header ── */
  .header {
    background: var(--vscode-sideBar-background, #252526);
    border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border, #3c3c3c);
    padding: 20px 24px;
    display: flex;
    align-items: flex-start;
    gap: 16px;
  }
  .header-icon {
    font-size: 2rem;
    line-height: 1;
    margin-top: 2px;
    flex-shrink: 0;
  }
  .header-main { flex: 1; min-width: 0; }
  .header-eyebrow {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #888;
    margin-bottom: 4px;
  }
  .symbol-name {
    font-size: 1.5rem;
    font-weight: 700;
    color: #4ec9b0;
    font-family: var(--vscode-editor-font-family, 'Cascadia Code', 'Consolas', monospace);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .symbol-file {
    font-size: 0.78rem;
    color: #888;
    margin-top: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .badges { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
  .pill {
    font-size: 0.7rem;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 20px;
    border: 1px solid;
    letter-spacing: 0.03em;
  }
  .risk-badge {
    flex-shrink: 0;
    align-self: flex-start;
    padding: 4px 14px;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    background: ${rbg};
    color: ${rc};
    border: 1px solid ${rc}44;
  }

  /* ── KPIs ── */
  .kpi-strip {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    border-bottom: 1px solid #3c3c3c;
  }
  @media (max-width: 600px) {
    .kpi-strip { grid-template-columns: repeat(3, 1fr); }
  }
  .kpi {
    padding: 16px 12px;
    text-align: center;
    border-right: 1px solid #3c3c3c;
  }
  .kpi:last-child { border-right: none; }
  .kpi-icon { font-size: 1.1rem; margin-bottom: 4px; }
  .kpi-val  { font-size: 1.8rem; font-weight: 700; color: #4ec9b0; line-height: 1; }
  .kpi-lbl  { font-size: 0.7rem; color: #888; margin-top: 4px; }

  /* ── Risk bar ── */
  .risk-section {
    padding: 20px 24px;
    border-bottom: 1px solid #3c3c3c;
  }
  .risk-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }
  .risk-title {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #888;
    font-weight: 600;
  }
  .risk-value {
    font-size: 1.1rem;
    font-weight: 700;
    color: ${rc};
  }
  .risk-bar-track {
    height: 8px;
    background: #2a2a2a;
    border-radius: 4px;
    overflow: hidden;
  }
  .risk-bar-fill {
    height: 100%;
    width: ${pct}%;
    background: linear-gradient(90deg, ${rc}99, ${rc});
    border-radius: 4px;
    transition: width 0.6s ease;
  }
  .risk-labels {
    display: flex;
    justify-content: space-between;
    font-size: 0.65rem;
    color: #555;
    margin-top: 4px;
  }

  /* ── Detail Sections ── */
  .details { padding: 0 24px 24px; }

  details {
    border: 1px solid #3c3c3c;
    border-radius: 6px;
    margin-top: 12px;
    overflow: hidden;
  }
  details[open] { border-color: #4c4c4c; }

  summary {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    cursor: pointer;
    font-size: 0.78rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #c586c0;
    background: #252526;
    user-select: none;
    list-style: none;
  }
  summary::-webkit-details-marker { display: none; }
  summary::before {
    content: '▶';
    font-size: 0.6rem;
    transition: transform 0.2s;
    color: #666;
  }
  details[open] summary::before { transform: rotate(90deg); }
  details[open] summary { border-bottom: 1px solid #3c3c3c; }

  .badge {
    margin-left: auto;
    background: #3c3c3c;
    color: #aaa;
    font-size: 0.65rem;
    padding: 1px 7px;
    border-radius: 10px;
    font-weight: 700;
  }

  .section-body { padding: 12px 14px; background: #1e1e1e; }

  /* ── List Items ── */
  .list-item {
    padding: 7px 10px;
    border-radius: 4px;
    margin-bottom: 4px;
    background: #252526;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 8px;
    font-size: 0.82rem;
  }
  .list-item:last-child { margin-bottom: 0; }
  .list-item.route     { border-left: 3px solid #569cd6; }
  .list-item.component { border-left: 3px solid #c586c0; }
  .list-item.importer  { border-left: 3px solid #4ec9b0; flex-direction: column; gap: 2px; }
  .list-item.callsite  { border-left: 3px solid #888; flex-direction: column; gap: 2px; }
  .list-item.test.exists  { border-left: 3px solid #4caf50; }
  .list-item.test.missing { border-left: 3px solid #555; color: #666; }
  .item-file  { color: #ce9178; font-weight: 500; font-size: 0.8rem; }
  .item-line  { color: #888; font-size: 0.72rem; margin-left: auto; }
  .item-code  { font-family: var(--vscode-editor-font-family, 'Cascadia Code', 'Consolas', monospace); font-size: 0.78rem; color: #888; white-space: pre-wrap; word-break: break-all; }
  .test-num   { color: #888; font-size: 0.7rem; min-width: 18px; }
  .create-hint { color: #555; font-size: 0.7rem; font-style: italic; margin-left: 4px; }

  .circular-warning {
    display: flex;
    gap: 12px;
    padding: 12px;
    background: rgba(244,67,54,0.08);
    border: 1px solid rgba(244,67,54,0.3);
    border-radius: 6px;
  }
  .warn-icon { font-size: 1.2rem; flex-shrink: 0; }

  .empty     { color: #555; font-size: 0.8rem; padding: 4px 0; }
  .ok-text   { color: #4caf50; }
</style>
</head>
<body>

<!-- ── Header ── -->
<div class="header">
  <div class="header-icon">⚡</div>
  <div class="header-main">
    <div class="header-eyebrow">Change Impact Simulator</div>
    <div class="symbol-name">${esc(r.symbolName)}()</div>
    <div class="symbol-file">${esc(r.symbolFile)}</div>
    <div class="badges">${exportBadge}${complexityBadge}</div>
  </div>
  <div class="risk-badge">${r.riskLevel}</div>
</div>

<!-- ── KPI Strip ── -->
<div class="kpi-strip">${kpis}</div>

<!-- ── Risk Score ── -->
<div class="risk-section">
  <div class="risk-header">
    <span class="risk-title">Estimated Blast Radius</span>
    <span class="risk-value">Risk Score  ${r.riskScore} / 100</span>
  </div>
  <div class="risk-bar-track">
    <div class="risk-bar-fill"></div>
  </div>
  <div class="risk-labels">
    <span>Low</span><span>Medium</span><span>High</span><span>Critical</span>
  </div>
</div>

<!-- ── Detail Sections ── -->
<div class="details">
  ${section('API Routes', r.apiRoutes.length, routesContent)}
  ${section('Frontend Components', r.frontendComponents.length, componentsContent)}
  ${section('Importing Modules', r.importedByModules.length, importersContent)}
  ${section('All Call Sites', r.callSites.length, callSitesContent)}
  ${section('Recommended Tests', r.recommendedTests.length, testsContent)}
  ${section('Circular Dependencies', r.circularDependencies.length, circularContent)}
</div>

</body>
</html>`;
}
