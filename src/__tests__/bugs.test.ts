/**
 * Bug regression tests — one describe block per confirmed bug.
 *
 * Tests that document a confirmed bug use the pattern:
 *   "CONFIRMED BUG: <description> — fix by <what to change>"
 *
 * Tests within those blocks verify:
 *   (a) the current (broken) behaviour, so the test passes on the broken code
 *   (b) what the CORRECT behaviour should be, shown as a comment or a
 *       separate assertion marked with the expected fix direction
 *
 * When a bug is fixed, change the relevant assertion and remove the "CONFIRMED BUG" prefix.
 */

import { escapeRegex } from '../utils/textUtils';
import { detectFunctions } from '../parser/FunctionParser';

// =============================================================================
// Bug #3 — Arrow functions with exactly 1 call site are marked as dead code
// =============================================================================

describe('Bug #3 — Dead-code threshold wrong for arrow functions', () => {
    const allText = [
        'const formatDate = (d: Date): string => d.toISOString().split("T")[0];',
        'console.log(formatDate(new Date())); // one call',
    ].join('\n');

    it('CONFIRMED BUG: pattern matches only the call site, not the definition', () => {
        // Arrow function definition "const formatDate = ..." does NOT contain "formatDate("
        // so the regex finds only 1 match (the single call).
        const pattern = new RegExp(`\\b${escapeRegex('formatDate')}\\s*\\(`, 'g');
        const matches = allText.match(pattern) ?? [];
        expect(matches.length).toBe(1); // only the call, never the definition
    });

    it('CONFIRMED BUG: threshold < 2 incorrectly classifies it as dead', () => {
        // The current dead-code finder uses "matches.length < 2" for ALL patterns.
        // With 1 match (the single call site), the arrow function is wrongly flagged.
        const pattern = new RegExp(`\\b${escapeRegex('formatDate')}\\s*\\(`, 'g');
        const matches = allText.match(pattern) ?? [];
        const isMarkedDead = matches.length < 2; // current (broken) threshold
        expect(isMarkedDead).toBe(true); // BUG: should be false — formatDate IS called
    });

    it('named function with 1 call is correctly classified as alive', () => {
        // Named declaration "function formatDate(..." DOES match "formatDate("
        // so 2 matches total (definition + 1 call) → correctly alive.
        const namedText = [
            'function formatDate(d: Date): string { return d.toISOString(); }',
            'console.log(formatDate(new Date()));',
        ].join('\n');
        const pattern = new RegExp(`\\b${escapeRegex('formatDate')}\\s*\\(`, 'g');
        const matches = namedText.match(pattern) ?? [];
        expect(matches.length).toBe(2); // definition + call
        expect(matches.length < 2).toBe(false); // correctly alive
    });

    it('FIX DIRECTION: correct threshold for arrow functions should be < 1', () => {
        // For arrow functions: 0 matches = dead, 1+ matches = alive.
        // For named functions: 1 match = dead (def only), 2+ = alive.
        const pattern = new RegExp(`\\b${escapeRegex('formatDate')}\\s*\\(`, 'g');
        const matches = allText.match(pattern) ?? [];
        const correctThreshold = matches.length < 1; // fix: use 1 for arrow fns
        expect(correctThreshold).toBe(false); // correctly alive with the fixed threshold
    });
});

// =============================================================================
// Bug #4 — Call sites inside comments are counted
// =============================================================================

describe('Bug #4 — Comments counted as call sites', () => {
    it('CONFIRMED BUG: line comment containing a call is matched', () => {
        const text = '// validateUser("ghost@example.com", "shouldnotcount")\nconst x = 1;';
        const pattern = new RegExp(`\\b${escapeRegex('validateUser')}\\s*\\(`, 'g');
        const matches = text.match(pattern) ?? [];
        // Bug: finds 1 match even though it is inside a comment
        expect(matches.length).toBe(1);
        // Should be 0 — commented calls must not inflate call-site counts
    });

    it('CONFIRMED BUG: block comment containing a call is matched', () => {
        const text = '/* validateUser("a", "b") */ const x = 1;';
        const pattern = new RegExp(`\\b${escapeRegex('validateUser')}\\s*\\(`, 'g');
        const matches = text.match(pattern) ?? [];
        expect(matches.length).toBe(1); // Bug: should be 0
    });

    it('real call site is still matched (regression guard for the fix)', () => {
        const text = 'const ok = validateUser(req.email, req.pass);';
        const pattern = new RegExp(`\\b${escapeRegex('validateUser')}\\s*\\(`, 'g');
        const matches = text.match(pattern) ?? [];
        expect(matches.length).toBe(1); // correct: a real call site
    });
});

// =============================================================================
// Bug #2 — findImporters() has false positives for common basenames (e.g. "index")
// =============================================================================

describe('Bug #2 — Basename-only import matching causes false positives', () => {
    // The import regex uses only the basename (without extension) as the match key.
    // When multiple files share the same basename (e.g. index.ts in different dirs),
    // files that import the WRONG index.ts are incorrectly listed as importers.

    function buildImportRegex(sourceBase: string): RegExp {
        // Mirrors the FIXED production regex in ChangeImpactAnalyzer.ts:
        // both alternatives now require [\\/] before the basename.
        const esc = escapeRegex(sourceBase);
        return new RegExp(
            `(?:import\\s+[^;]+from\\s+['"\`][^'"\`]*[\\/]${esc}['"\`]` +
            `|require\\s*\\(\\s*['"\`][^'"\`]*[\\/]${esc}['"\`]\\s*\\))`,
            'g'
        );
    }

    it('matches the correct import', () => {
        const re = buildImportRegex('AuthService');
        expect(re.test(`import { validate } from './AuthService';`)).toBe(true);
    });

    it('does NOT match a longer name (OldAuthService) — no substring match', () => {
        // Fixed: removed the broken second alternative that lacked a [\\/] guard.
        // Now both import and require alternatives require [\\/] before the basename.
        const re = buildImportRegex('AuthService');
        expect(re.test(`import { validate } from './OldAuthService';`)).toBe(false);
    });

    it('CONFIRMED BUG: "index" basename matches imports of DIFFERENT index.ts files', () => {
        const re = buildImportRegex('index'); // sourceFile is root index.ts

        // Correct: this imports from root index.ts
        re.lastIndex = 0;
        const correctMatch = re.test(`import { foo } from './index';`);
        expect(correctMatch).toBe(true);

        // Bug: this imports from services/index.ts, but the regex matches it anyway
        re.lastIndex = 0;
        const falsePositive = re.test(`import { getUser } from './index';`);
        expect(falsePositive).toBe(true); // same pattern → indistinguishable (the bug)
    });

    it('FIX DIRECTION: basename check alone cannot distinguish same-named files across dirs', () => {
        // The fix would require comparing full resolved paths, not just basenames.
        // This test documents the limitation — until fixed, common names like "index",
        // "utils", or "types" will produce false positives.
        const commonNames = ['index', 'utils', 'types', 'helpers', 'config'];
        commonNames.forEach(name => {
            const re = buildImportRegex(name);
            // Both of these match identically — no way to tell them apart with current logic
            const importA = re.test(`import { a } from './${name}';`);
            re.lastIndex = 0;
            const importB = re.test(`import { b } from '../other/${name}';`);
            expect(importA).toBe(importB); // both true — bug confirmed
        });
    });
});

// =============================================================================
// Bug #8 — .test.tsx / .spec.tsx files appear as "Frontend Components"
// =============================================================================

describe('Bug #8 — Test files classified as Frontend Components', () => {
    it('CONFIRMED BUG: .test.tsx ends in .tsx so it passes the component filter', () => {
        const testFilePath = '/project/src/__tests__/Login.test.tsx';
        const isClassifiedAsComponent = /\.(tsx|jsx)$/.test(testFilePath);
        expect(isClassifiedAsComponent).toBe(true); // Bug: should be false
    });

    it('CONFIRMED BUG: .spec.jsx also triggers the false positive', () => {
        const specFilePath = '/project/src/specs/Button.spec.jsx';
        const isClassifiedAsComponent = /\.(tsx|jsx)$/.test(specFilePath);
        expect(isClassifiedAsComponent).toBe(true); // Bug: should be false
    });

    it('FIX DIRECTION: the corrected regex would exclude test/spec suffixes', () => {
        const fix = (fp: string) =>
            /\.(tsx|jsx)$/.test(fp) && !/\.(test|spec)\.(tsx|jsx)$/.test(fp);

        expect(fix('/src/components/Login.tsx')).toBe(true);   // real component ✓
        expect(fix('/src/__tests__/Login.test.tsx')).toBe(false); // test file ✓
        expect(fix('/src/specs/Button.spec.jsx')).toBe(false);    // spec file ✓
        expect(fix('/src/Button.jsx')).toBe(true);             // real component ✓
    });
});

// =============================================================================
// Bug #7 — "All Call Sites" section badge count differs from KPI count
// =============================================================================

describe('Bug #7 — Section badge shows sliced count; KPI shows full count', () => {
    it('describes the inconsistency with 73 call sites (50 shown)', () => {
        // analyzeChangeImpact caps callSites at 50 (for perf) but records full
        // calledByCount. The section is rendered with callSites.length (50)
        // as the badge count while the KPI card displays calledByCount (73).
        // A user sees "73" at the top and "50" on the section — confusing.

        const slicedCount = 50;
        const fullCount   = 73;
        const badgeShows  = slicedCount; // section() receives r.callSites.length
        const kpiShows    = fullCount;   // KPI uses r.calledByCount

        expect(badgeShows).not.toBe(kpiShows); // the inconsistency exists
        // FIX: pass calledByCount to section() instead of callSites.length,
        // or add a note to the badge explaining the cap.
    });
});

// =============================================================================
// Bug #1 — CIS run from a call-site file gives wrong complexity/export data
// =============================================================================

describe('Bug #1 — Cursor on call site yields wrong source-file analysis', () => {
    it('demonstrates the wrong complexity when symbol is not defined in the given file', () => {
        // If the cursor is on "validateUser" in routes.ts (a call site, not the
        // definition file), analyzeChangeImpact is called with sourceFilePath = routes.ts.
        // Since routes.ts does NOT define validateUser, symbolFn is undefined and
        // complexity falls back to 1 — the correct value is whatever auth.ts computes.

        const routesText = [
            "import { validateUser } from './auth';",
            "app.post('/login', (req, res) => {",
            "  const ok = validateUser(req.body.email, req.body.password);",
            "  res.json({ ok });",
            "});",
        ].join('\n');
        const routesLines = routesText.split('\n');
        const fns = detectFunctions(routesText, routesLines);

        // validateUser is NOT defined in routes.ts — only the arrow callbacks are
        const validateFn = fns.find(f => f.name === 'validateUser');
        expect(validateFn).toBeUndefined(); // confirms the lookup fails → complexity = 1
    });

    it('demonstrates the wrong isExported when symbol is not defined in the given file', () => {
        const routesText = "import { validateUser } from './auth';";
        // isSymbolExported scans the file text for "export ... validateUser".
        // routes.ts has no such export.
        const exportPatterns = [
            /export\s+(?:default\s+)?(?:async\s+)?function\s+validateUser\b/,
            /export\s+(?:const|let|var)\s+validateUser\b/,
            /export\s+(?:abstract\s+)?class\s+validateUser\b/,
        ];
        const isExported = exportPatterns.some(p => p.test(routesText));
        expect(isExported).toBe(false); // Bug: the real answer is true (it's exported from auth.ts)
    });
});

// =============================================================================
// Bug #5 — getAllWorkspaceFiles() called twice per Change Impact analysis
// =============================================================================

describe('Bug #5 — Double workspace scan per analysis (performance)', () => {
    it('documents that analyzeChangeImpact calls getAllWorkspaceFiles twice', () => {
        // analyzeChangeImpact() calls:
        //   1. getAllWorkspaceFiles()  directly (line ~14 of the function)
        //   2. findCallSites(symbolName, sourceFilePath) which ALSO calls getAllWorkspaceFiles()
        //
        // This is a performance bug, not a correctness bug.
        // FIX: pass the already-fetched allFiles into findCallSites() as a parameter.
        //
        // This test simply documents the issue as a reference for the fix.
        expect(true).toBe(true); // placeholder — the fix is architectural
    });
});

// =============================================================================
// Bug #6 — deadCode.ts reads all files twice from disk
// =============================================================================

describe('Bug #6 — Dead code command reads workspace files twice', () => {
    it('documents the double-read pattern', () => {
        // deadCode.ts first reads all files to detect functions (one read per file),
        // then concatenates ALL file text into allText (another read per file).
        // FIX: store text alongside functions in the first pass and reuse it.
        //
        // This test simply documents the issue.
        expect(true).toBe(true); // placeholder — fix is in deadCode.ts
    });
});
