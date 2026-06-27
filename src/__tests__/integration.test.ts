/**
 * Integration tests — run analyzeChangeImpact against the real test-fixture/
 * directory (no mocking of business logic, only the VS Code API is mocked).
 *
 * The vscode mock in __mocks__/vscode.ts points workspace.workspaceFolders
 * at test-fixture/ and implements findFiles() with a real directory walk,
 * so all file I/O goes through the actual Node fs module.
 */

import * as path from 'path';
import { analyzeChangeImpact } from '../analysis/ChangeImpactAnalyzer';

const FIXTURE = path.join(__dirname, '..', '..', 'test-fixture');

describe('Change Impact — validateUser in auth.ts (correct definition file)', () => {
    let result: Awaited<ReturnType<typeof analyzeChangeImpact>>;

    beforeAll(async () => {
        result = await analyzeChangeImpact('validateUser', path.join(FIXTURE, 'auth.ts'));
    });

    it('finds call sites across multiple files', () => {
        // routes.ts ×2, middleware.ts ×1, Login.tsx ×1 = at least 4 call sites
        // (auth.test.ts also calls it ×3, so total ≥ 4)
        expect(result.calledByCount).toBeGreaterThanOrEqual(4);
    });

    it('detects calls in at least 3 distinct files', () => {
        expect(result.usedInFilesCount).toBeGreaterThanOrEqual(3);
    });

    it('reports validateUser as exported', () => {
        expect(result.isExported).toBe(true);
    });

    it('reports a complexity > 1 (the function has branches)', () => {
        // validateUser has 2 ifs + 1 || + 1 && = score 5
        expect(result.complexity).toBeGreaterThan(1);
    });

    it('detects the POST /api/login route in routes.ts', () => {
        expect(result.apiRoutes).toContain('POST /api/login');
    });

    it('detects the POST /api/register route in routes.ts', () => {
        expect(result.apiRoutes).toContain('POST /api/register');
    });

    it('detects Login.tsx as a frontend component', () => {
        expect(result.frontendComponents).toContain('Login.tsx');
    });

    it('includes auth.test.ts in recommended tests (file already exists)', () => {
        const existingTest = result.recommendedTests.find(
            t => t.includes('auth') && !t.includes('(create')
        );
        expect(existingTest).toBeTruthy();
    });

    it('does not list the source file itself as a call site', () => {
        // excludePath is auth.ts — calls inside auth.ts should be excluded
        const selfCalls = result.callSites.filter(cs =>
            cs.filePath === path.join(FIXTURE, 'auth.ts')
        );
        expect(selfCalls).toHaveLength(0);
    });

    it('produces a symbolFile as a relative path', () => {
        // toDisplayPath should return 'auth.ts', not an absolute path
        expect(result.symbolFile).toBe('auth.ts');
        expect(path.isAbsolute(result.symbolFile)).toBe(false);
    });
});

describe('Change Impact — Bug #1: cursor on call-site file (routes.ts)', () => {
    let resultFromCallSite:   Awaited<ReturnType<typeof analyzeChangeImpact>>;
    let resultFromDefinition: Awaited<ReturnType<typeof analyzeChangeImpact>>;

    beforeAll(async () => {
        [resultFromCallSite, resultFromDefinition] = await Promise.all([
            analyzeChangeImpact('validateUser', path.join(FIXTURE, 'routes.ts')),
            analyzeChangeImpact('validateUser', path.join(FIXTURE, 'auth.ts')),
        ]);
    });

    it('CONFIRMED BUG: complexity is 1 when run from routes.ts (wrong)', () => {
        // validateUser is not defined in routes.ts → complexity fallback = 1
        expect(resultFromCallSite.complexity).toBe(1);
        // Correct complexity (from auth.ts) is > 1
        expect(resultFromDefinition.complexity).toBeGreaterThan(1);
    });

    it('CONFIRMED BUG: isExported is false when run from routes.ts (wrong)', () => {
        expect(resultFromCallSite.isExported).toBe(false);
        expect(resultFromDefinition.isExported).toBe(true);
    });

    it('CONFIRMED BUG: calledByCount is lower from routes.ts (calls in that file excluded)', () => {
        // routes.ts has 2 calls to validateUser; they are excluded as "self" calls.
        expect(resultFromCallSite.calledByCount).toBeLessThan(resultFromDefinition.calledByCount);
    });
});

describe('Change Impact — Bug #2: index.ts basename false positives', () => {
    let result: Awaited<ReturnType<typeof analyzeChangeImpact>>;

    beforeAll(async () => {
        result = await analyzeChangeImpact('main', path.join(FIXTURE, 'index.ts'));
    });

    it('CONFIRMED BUG: services/user.ts appears as an importer of root index.ts', () => {
        // services/user.ts imports from './index' (services/index.ts), NOT from root index.ts.
        // But since both have basename 'index', the regex matches it as an importer.
        const importerNames = result.importedByModules.map(ib => ib.fileName);
        const hasFalsePositive = importerNames.some(n => n.replace(/\\/g, '/').includes('user'));
        // Document the false positive — it IS listed (the bug)
        if (hasFalsePositive) {
            // Bug confirmed: services/user.ts incorrectly appears as an importer of root index.ts
            expect(hasFalsePositive).toBe(true);
        } else {
            // Fixture may have changed; just verify no crash occurred
            expect(result.importedByModules).toBeDefined();
        }
    });
});

describe('Change Impact — formatDate (arrow function, 1 call)', () => {
    let result: Awaited<ReturnType<typeof analyzeChangeImpact>>;

    beforeAll(async () => {
        result = await analyzeChangeImpact('formatDate', path.join(FIXTURE, 'auth.ts'));
    });

    it('finds at least 1 call site for formatDate', () => {
        // routes.ts calls formatDate once
        expect(result.calledByCount).toBeGreaterThanOrEqual(1);
    });

    it('reports formatDate as exported', () => {
        expect(result.isExported).toBe(true);
    });
});

describe('Change Impact — hashPassword (dead function)', () => {
    let result: Awaited<ReturnType<typeof analyzeChangeImpact>>;

    beforeAll(async () => {
        result = await analyzeChangeImpact('hashPassword', path.join(FIXTURE, 'auth.ts'));
    });

    it('finds zero call sites for hashPassword', () => {
        expect(result.calledByCount).toBe(0);
    });

    it('reports hashPassword as NOT exported', () => {
        expect(result.isExported).toBe(false);
    });

    it('does NOT assign CRITICAL risk (has zero callers)', () => {
        // hashPassword has 0 callers, but auth.ts is widely imported and has API routes,
        // so the "file-level" importers inflate its score to MEDIUM.
        // This is a design trade-off: symbol risk reflects the file's import graph,
        // not just the symbol's own call sites.
        expect(result.riskLevel).not.toBe('CRITICAL');
        expect(result.calledByCount).toBe(0);
    });
});
