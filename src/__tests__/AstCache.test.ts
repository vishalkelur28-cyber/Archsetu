// Regression tests for the AstCache — the lazy AST indexing system used by
// the Change Impact Simulator.
//
// The cache must NEVER throw or fail because a document is absent.
// A cache miss triggers an immediate lazy parse instead.
//
// Also verifies:
//  - Path normalisation (Windows back-slashes, drive-letter casing)
//  - Pre-indexing, invalidation, and clear()
//  - Diagnostic record fields

import * as path from 'path';
import { AstCache, AstCacheDiagnostics, formatDiagnostics } from '../analysis/AstCache';

// Fixture path for real file I/O in integration assertions
const FIXTURE = path.join(__dirname, '..', '..', 'test-fixture');
const AUTH_TS  = path.join(FIXTURE, 'auth.ts');

// =============================================================================
// Basic lazy loading
// =============================================================================

describe('AstCache — lazy loading', () => {
    it('starts empty', () => {
        const cache = new AstCache();
        expect(cache.size).toBe(0);
        expect(cache.keys()).toHaveLength(0);
    });

    it('never throws for a path that does not exist', () => {
        const cache = new AstCache();
        expect(() => cache.get('/no/such/file.ts')).not.toThrow();
        expect(cache.get('/no/such/file.ts')).toEqual([]);
    });

    it('returns an empty array for a non-existent file (graceful fallback)', () => {
        const cache = new AstCache();
        const fns = cache.get('/nonexistent/path.ts');
        expect(Array.isArray(fns)).toBe(true);
        expect(fns).toHaveLength(0);
    });

    it('parses a real fixture file on first access (lazy build)', () => {
        const cache = new AstCache();
        expect(cache.size).toBe(0); // nothing cached yet

        const fns = cache.get(AUTH_TS);
        expect(fns.length).toBeGreaterThan(0); // auth.ts has functions
        expect(cache.size).toBe(1);            // now cached
    });

    it('returns the same array on a second access (cache hit, no re-parse)', () => {
        const cache = new AstCache();
        const first  = cache.get(AUTH_TS);
        const second = cache.get(AUTH_TS);
        expect(second).toBe(first); // same array reference
        expect(cache.size).toBe(1); // still only 1 entry
    });

    it('finds validateUser in auth.ts', () => {
        const cache = new AstCache();
        const fns = cache.get(AUTH_TS);
        expect(fns.some(f => f.name === 'validateUser')).toBe(true);
    });
});

// =============================================================================
// Path normalisation
// =============================================================================

describe('AstCache — path normalisation', () => {
    it('treats back-slashes and forward-slashes as the same key (Windows paths)', () => {
        const cache = new AstCache();
        // On Windows the real path has back-slashes; simulate both variants
        const withBackslash  = AUTH_TS;                             // native
        const withForward    = AUTH_TS.replace(/\\/g, '/');         // normalised
        // One get() to populate, other should hit the same cache entry
        cache.get(withBackslash);
        expect(cache.size).toBe(1);
        // Getting the forward-slash variant should NOT add a second entry
        cache.get(withForward);
        expect(cache.size).toBe(1);
    });

    it('treats upper-case and lower-case drive letters as the same (Windows)', () => {
        // Simulate C:\ vs c:\ mismatch
        const cache = new AstCache();
        const upper = AUTH_TS.replace(/^([a-z]):/, m => m.toUpperCase());
        const lower = AUTH_TS.replace(/^([A-Z]):/, m => m.toLowerCase());
        cache.get(upper);
        expect(cache.size).toBe(1);
        cache.get(lower);
        expect(cache.size).toBe(1); // same entry, not duplicated
    });
});

// =============================================================================
// Diagnostics
// =============================================================================

describe('AstCache — diagnostics', () => {
    it('reports a cache MISS on first access', () => {
        const cache = new AstCache();
        const diag: AstCacheDiagnostics = {
            cacheSize: -1, requestedPath: '', normalisedKey: '',
            cachedKeys: [], cacheHit: false, parsedLazily: false, functionCount: -1,
        };
        cache.getWithDiagnostics(AUTH_TS, diag);

        expect(diag.cacheHit).toBe(false);
        expect(diag.parsedLazily).toBe(true);
        expect(diag.functionCount).toBeGreaterThan(0);
        expect(diag.requestedPath).toBe(AUTH_TS);
    });

    it('reports a cache HIT on second access', () => {
        const cache = new AstCache();
        const diag1: AstCacheDiagnostics = {
            cacheSize: 0, requestedPath: '', normalisedKey: '',
            cachedKeys: [], cacheHit: false, parsedLazily: false, functionCount: 0,
        };
        const diag2: AstCacheDiagnostics = { ...diag1 };

        cache.getWithDiagnostics(AUTH_TS, diag1);
        cache.getWithDiagnostics(AUTH_TS, diag2);

        expect(diag1.cacheHit).toBe(false); // first access → miss
        expect(diag2.cacheHit).toBe(true);  // second access → hit
        expect(diag2.parsedLazily).toBe(false);
    });

    it('records all cached keys in the diagnostic', () => {
        const cache = new AstCache();
        const diag: AstCacheDiagnostics = {
            cacheSize: 0, requestedPath: '', normalisedKey: '',
            cachedKeys: [], cacheHit: false, parsedLazily: false, functionCount: 0,
        };
        cache.get(AUTH_TS);
        cache.getWithDiagnostics('/nonexistent.ts', diag);
        // After the miss, cachedKeys should include auth.ts
        expect(diag.cachedKeys.some(k => k.includes('auth'))).toBe(true);
    });

    it('formatDiagnostics returns a non-empty array of strings', () => {
        const cache = new AstCache();
        const diag: AstCacheDiagnostics = {
            cacheSize: 0, requestedPath: '', normalisedKey: '',
            cachedKeys: [], cacheHit: false, parsedLazily: false, functionCount: 0,
        };
        cache.getWithDiagnostics(AUTH_TS, diag);
        const lines = formatDiagnostics(diag);
        expect(lines.length).toBeGreaterThan(0);
        expect(lines.every(l => typeof l === 'string')).toBe(true);
        expect(lines.some(l => l.includes('[AST Cache]'))).toBe(true);
    });
});

// =============================================================================
// Cache management
// =============================================================================

describe('AstCache — invalidation and clear', () => {
    it('invalidate() removes a single entry', () => {
        const cache = new AstCache();
        cache.get(AUTH_TS);
        expect(cache.size).toBe(1);
        cache.invalidate(AUTH_TS);
        expect(cache.size).toBe(0);
    });

    it('clear() removes all entries', () => {
        const cache = new AstCache();
        cache.get(AUTH_TS);
        cache.get('/nonexistent1.ts');
        cache.get('/nonexistent2.ts');
        expect(cache.size).toBe(3);
        cache.clear();
        expect(cache.size).toBe(0);
    });

    it('after invalidate, next get() re-parses the file', () => {
        const cache = new AstCache();
        const first = cache.get(AUTH_TS);
        cache.invalidate(AUTH_TS);

        const diag: AstCacheDiagnostics = {
            cacheSize: 0, requestedPath: '', normalisedKey: '',
            cachedKeys: [], cacheHit: false, parsedLazily: false, functionCount: 0,
        };
        const reparsed = cache.getWithDiagnostics(AUTH_TS, diag);

        expect(diag.parsedLazily).toBe(true); // re-parsed after invalidation
        expect(reparsed.length).toBe(first.length); // same result
    });
});

// =============================================================================
// preIndex
// =============================================================================

describe('AstCache — preIndex', () => {
    it('pre-populates the cache from an array of paths', () => {
        const cache = new AstCache();
        expect(cache.size).toBe(0);
        cache.preIndex([AUTH_TS, '/nonexistent.ts']);
        expect(cache.size).toBe(2);
    });

    it('subsequent get() for a pre-indexed file is a HIT', () => {
        const cache = new AstCache();
        cache.preIndex([AUTH_TS]);

        const diag: AstCacheDiagnostics = {
            cacheSize: 0, requestedPath: '', normalisedKey: '',
            cachedKeys: [], cacheHit: false, parsedLazily: false, functionCount: 0,
        };
        cache.getWithDiagnostics(AUTH_TS, diag);
        expect(diag.cacheHit).toBe(true);
        expect(diag.parsedLazily).toBe(false);
    });
});
