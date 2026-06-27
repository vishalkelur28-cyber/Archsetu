import { buildChangeImpactHTML } from '../ui/ChangeImpactPanel';
import { ChangeImpactResult } from '../types';

function makeResult(overrides: Partial<ChangeImpactResult> = {}): ChangeImpactResult {
    return {
        symbolName:           'calculateInvoice',
        symbolFile:           'src/billing/invoice.ts',
        calledByCount:        5,
        usedInFilesCount:     3,
        importedByModules:    [],
        apiRoutes:            [],
        frontendComponents:   [],
        riskScore:            30,
        riskLevel:            'MEDIUM',
        recommendedTests:     [],
        circularDependencies: [],
        isExported:           false,
        complexity:           3,
        callSites:            [],
        ...overrides,
    };
}

describe('buildChangeImpactHTML — structure', () => {
    it('produces a complete HTML document', () => {
        const html = buildChangeImpactHTML(makeResult());
        expect(html).toContain('<!DOCTYPE html>');
        expect(html).toContain('</html>');
        expect(html).toContain('<body>');
    });

    it('displays the symbol name with parentheses', () => {
        const html = buildChangeImpactHTML(makeResult({ symbolName: 'calculateInvoice' }));
        expect(html).toContain('calculateInvoice()');
    });

    it('displays the symbol file path', () => {
        const html = buildChangeImpactHTML(makeResult());
        expect(html).toContain('src/billing/invoice.ts');
    });

    it('includes all six section headings', () => {
        const html = buildChangeImpactHTML(makeResult());
        expect(html).toContain('API Routes');
        expect(html).toContain('Frontend Components');
        expect(html).toContain('Importing Modules');
        expect(html).toContain('All Call Sites');
        expect(html).toContain('Recommended Tests');
        expect(html).toContain('Circular Dependencies');
    });

    it('uses VS Code CSS variables for theme compatibility', () => {
        const html = buildChangeImpactHTML(makeResult());
        expect(html).toContain('var(--vscode-editor-background');
    });
});

describe('buildChangeImpactHTML — risk levels', () => {
    it('shows LOW badge', () => {
        const html = buildChangeImpactHTML(makeResult({ riskScore: 5, riskLevel: 'LOW' }));
        expect(html).toContain('LOW');
    });

    it('shows MEDIUM badge', () => {
        const html = buildChangeImpactHTML(makeResult({ riskScore: 40, riskLevel: 'MEDIUM' }));
        expect(html).toContain('MEDIUM');
    });

    it('shows HIGH badge', () => {
        const html = buildChangeImpactHTML(makeResult({ riskScore: 60, riskLevel: 'HIGH' }));
        expect(html).toContain('HIGH');
    });

    it('shows CRITICAL badge', () => {
        const html = buildChangeImpactHTML(makeResult({ riskScore: 90, riskLevel: 'CRITICAL' }));
        expect(html).toContain('CRITICAL');
    });

    it('uses green (#4caf50) for LOW risk', () => {
        expect(buildChangeImpactHTML(makeResult({ riskLevel: 'LOW' }))).toContain('#4caf50');
    });

    it('uses orange (#ff9800) for MEDIUM risk', () => {
        expect(buildChangeImpactHTML(makeResult({ riskLevel: 'MEDIUM' }))).toContain('#ff9800');
    });

    it('uses deep-orange (#f97316) for HIGH risk', () => {
        expect(buildChangeImpactHTML(makeResult({ riskLevel: 'HIGH' }))).toContain('#f97316');
    });

    it('uses red (#f44336) for CRITICAL risk', () => {
        expect(buildChangeImpactHTML(makeResult({ riskLevel: 'CRITICAL' }))).toContain('#f44336');
    });

    it('encodes risk score as the risk-bar width percentage', () => {
        const html = buildChangeImpactHTML(makeResult({ riskScore: 75 }));
        expect(html).toContain('width: 75%');
    });
});

describe('buildChangeImpactHTML — XSS prevention', () => {
    it('escapes < and > in the symbol name', () => {
        const html = buildChangeImpactHTML(makeResult({ symbolName: '<script>alert(1)</script>' }));
        expect(html).not.toContain('<script>alert(1)</script>');
        expect(html).toContain('&lt;script&gt;');
    });

    it('escapes < in the file path', () => {
        const html = buildChangeImpactHTML(makeResult({ symbolFile: 'src/<dangerous>/file.ts' }));
        expect(html).toContain('&lt;dangerous&gt;');
    });

    it('escapes & in import statement text', () => {
        const result = makeResult({
            importedByModules: [{
                filePath: '/a/b.ts',
                fileName: 'b.ts',
                line: 0,
                importStatement: 'import { a & b } from "./c"',
            }],
        });
        const html = buildChangeImpactHTML(result);
        expect(html).toContain('&amp;');
        expect(html).not.toContain('{ a & b }');
    });

    it('escapes " in call site line text', () => {
        const result = makeResult({
            callSites: [{
                filePath: '/f.ts', fileName: 'f.ts', line: 0,
                lineText: 'call("dangerous <value>")',
            }],
        });
        const html = buildChangeImpactHTML(result);
        expect(html).toContain('&lt;value&gt;');
        expect(html).not.toContain('<value>');
    });
});

describe('buildChangeImpactHTML — KPI strip', () => {
    it('shows calledByCount in the Call Sites KPI', () => {
        const html = buildChangeImpactHTML(makeResult({ calledByCount: 42 }));
        expect(html).toContain('>42<');
    });

    it('shows usedInFilesCount in the Files Affected KPI', () => {
        const html = buildChangeImpactHTML(makeResult({ usedInFilesCount: 7 }));
        expect(html).toContain('>7<');
    });
});

describe('buildChangeImpactHTML — sections', () => {
    it('opens sections that have items', () => {
        const html = buildChangeImpactHTML(makeResult({ apiRoutes: ['GET /health'] }));
        expect(html).toMatch(/<details open>/);
    });

    it('does not open empty sections', () => {
        const html = buildChangeImpactHTML(makeResult()); // all arrays empty
        // No <details open> should appear at all
        expect(html).not.toMatch(/<details open>/);
    });

    it('shows the API route text', () => {
        const html = buildChangeImpactHTML(makeResult({ apiRoutes: ['POST /api/order'] }));
        expect(html).toContain('POST /api/order');
    });

    it('shows "No API routes detected" when routes are empty', () => {
        expect(buildChangeImpactHTML(makeResult())).toContain('No API routes detected');
    });

    it('shows "No frontend components detected" when empty', () => {
        expect(buildChangeImpactHTML(makeResult())).toContain('No frontend components detected');
    });

    it('shows the frontend component name', () => {
        const html = buildChangeImpactHTML(makeResult({ frontendComponents: ['Dashboard.tsx'] }));
        expect(html).toContain('Dashboard.tsx');
    });

    it('shows circular dep warning when deps are present', () => {
        const html = buildChangeImpactHTML(makeResult({ circularDependencies: ['services/auth.ts'] }));
        expect(html).toContain('Circular imports detected!');
        expect(html).toContain('services/auth.ts');
    });

    it('shows ok-text when no circular dependencies', () => {
        const html = buildChangeImpactHTML(makeResult({ circularDependencies: [] }));
        expect(html).toContain('ok-text');
        expect(html).toContain('No circular dependencies detected');
    });

    it('shows "and N more call sites" when callSites are truncated (Bug #7)', () => {
        // calledByCount = 73, callSites capped at 50 → shows "23 more call sites"
        const result = makeResult({
            calledByCount: 73,
            callSites: Array.from({ length: 50 }, (_, i) => ({
                filePath: `/f${i}.ts`, fileName: `f${i}.ts`, line: 0, lineText: 'call()',
            })),
        });
        const html = buildChangeImpactHTML(result);
        expect(html).toContain('23 more call sites');
        // KPI still shows 73 (full count); section badge shows 50 (sliced length)
        expect(html).toContain('>73<');
    });

    it('does NOT show "more call sites" when not truncated', () => {
        const result = makeResult({
            calledByCount: 5,
            callSites: Array.from({ length: 5 }, (_, i) => ({
                filePath: `/f${i}.ts`, fileName: `f${i}.ts`, line: 0, lineText: 'call()',
            })),
        });
        expect(buildChangeImpactHTML(result)).not.toContain('more call sites');
    });
});

describe('buildChangeImpactHTML — badges', () => {
    it('shows "exported" pill when isExported is true', () => {
        expect(buildChangeImpactHTML(makeResult({ isExported: true }))).toContain('exported');
    });

    it('does not show "exported" pill when isExported is false', () => {
        expect(buildChangeImpactHTML(makeResult({ isExported: false }))).not.toContain('>exported<');
    });

    it('shows Low complexity pill for score <= 5', () => {
        expect(buildChangeImpactHTML(makeResult({ complexity: 3 }))).toContain('complexity 3 Low');
    });

    it('shows Med complexity pill for score 6-10', () => {
        expect(buildChangeImpactHTML(makeResult({ complexity: 8 }))).toContain('complexity 8 Med');
    });

    it('shows HIGH complexity pill for score > 10', () => {
        expect(buildChangeImpactHTML(makeResult({ complexity: 15 }))).toContain('complexity 15 HIGH');
    });
});

describe('buildChangeImpactHTML — test recommendations', () => {
    it('shows the test file name', () => {
        const html = buildChangeImpactHTML(makeResult({ recommendedTests: ['auth.test.ts'] }));
        expect(html).toContain('auth.test.ts');
    });

    it('shows create-hint for missing test files', () => {
        const html = buildChangeImpactHTML(makeResult({
            recommendedTests: ['billing.test.ts  (create this file)'],
        }));
        expect(html).toContain('create-hint');
        expect(html).toContain('create this file');
    });

    it('shows "No test files found" when list is empty', () => {
        expect(buildChangeImpactHTML(makeResult())).toContain('No test files found');
    });
});
