/**
 * Minimal VS Code API mock for Jest tests.
 * Points the workspace root at test-fixture/ so integration tests run
 * against real fixture files without needing the Extension Host.
 */
import * as path from 'path';
import * as fs from 'fs';

const FIXTURE_ROOT = path.join(__dirname, '..', 'test-fixture');

function walkSync(dir: string, namePattern: RegExp, excludePatterns: RegExp[]): string[] {
    if (!fs.existsSync(dir)) { return []; }
    const results: string[] = [];
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const normalised = fullPath.replace(/\\/g, '/');
            if (excludePatterns.some(p => p.test(normalised))) { continue; }
            if (entry.isDirectory()) {
                results.push(...walkSync(fullPath, namePattern, excludePatterns));
            } else if (namePattern.test(entry.name)) {
                results.push(fullPath);
            }
        }
    } catch { /* ignore unreadable dirs */ }
    return results;
}

export const workspace = {
    workspaceFolders: [
        { uri: { fsPath: FIXTURE_ROOT } },
    ] as Array<{ uri: { fsPath: string } }>,

    findFiles: jest.fn((include: string, _exclude?: string) => {
        const isTestPattern = /test|spec/.test(include);
        if (isTestPattern) {
            const files = walkSync(FIXTURE_ROOT, /\.(test|spec)\.(ts|js|tsx|jsx)$/, [/node_modules/]);
            return Promise.resolve(files.map(fsPath => ({ fsPath })));
        }
        const files = walkSync(
            FIXTURE_ROOT,
            /\.(ts|tsx|js|jsx)$/,
            [/node_modules/, /\.d\.ts$/],
        );
        return Promise.resolve(files.map(fsPath => ({ fsPath })));
    }),
};

const _silentChannel = {
    appendLine: jest.fn(),
    append:     jest.fn(),
    clear:      jest.fn(),
    show:       jest.fn(),
    hide:       jest.fn(),
    dispose:    jest.fn(),
};

export const window = {
    showWarningMessage:     jest.fn().mockResolvedValue(undefined),
    showInformationMessage: jest.fn().mockResolvedValue(undefined),
    showErrorMessage:       jest.fn().mockResolvedValue(undefined),
    withProgress:           jest.fn().mockImplementation(
        (_opts: unknown, task: () => Promise<void>) => task()
    ),
    createOutputChannel: jest.fn().mockReturnValue(_silentChannel),
};

export const ProgressLocation = { Notification: 15, SourceControl: 1, Window: 10 };

export const Uri = {
    file: (p: string) => ({ fsPath: p }),
};
