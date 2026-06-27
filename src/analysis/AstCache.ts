import * as path from 'path';
import { FunctionInfo } from '../types';
import { detectFunctions } from '../parser/FunctionParser';
import { readFileText } from '../utils/fileUtils';

// =============================================================================
// AstCache — lazy, per-session cache of parsed function definitions
// =============================================================================

/**
 * The AstCache stores parsed function-definition arrays keyed by normalised
 * file path.  It is populated lazily: the first access for a given path reads
 * and parses the file on demand.  This means the cache never throws because a
 * document is "absent" — a miss just triggers an immediate parse.
 *
 * Path normalisation (forward slashes + lower-case drive letter) prevents
 * Windows path-casing or slash-direction differences from causing spurious
 * misses.
 *
 * Diagnostic log (see `getWithDiagnostics`) records:
 *   - cache size at request time
 *   - whether the lookup was a HIT or a MISS (with lazy parse)
 *   - all currently cached paths
 */
export class AstCache {
    private readonly _cache = new Map<string, FunctionInfo[]>();

    // ── Key normalisation ────────────────────────────────────────────────────

    /** Normalise to forward slashes, lower-case drive letter on Windows. */
    private key(fsPath: string): string {
        return fsPath.replace(/\\/g, '/').replace(/^([A-Z]):/, m => m.toLowerCase());
    }

    // ── Public API ───────────────────────────────────────────────────────────

    /** Number of files currently cached. */
    get size(): number { return this._cache.size; }

    /** Paths of all currently cached files. */
    keys(): string[] { return [...this._cache.keys()]; }

    /**
     * Returns parsed functions for `fsPath`.
     * If the path is not cached, the file is read and parsed immediately
     * (lazy build — never fails due to a missing cache entry).
     * Returns [] if the file cannot be read.
     */
    get(fsPath: string): FunctionInfo[] {
        const k = this.key(fsPath);
        if (this._cache.has(k)) { return this._cache.get(k)!; }
        return this._parseLazy(fsPath, k);
    }

    /**
     * Same as `get` but also fills `diagnostics` with a structured log of the
     * lookup result.  Callers can embed this in the Change Impact output channel
     * or webview to help diagnose cache behaviour.
     */
    getWithDiagnostics(fsPath: string, diagnostics: AstCacheDiagnostics): FunctionInfo[] {
        const k     = this.key(fsPath);
        const isHit = this._cache.has(k);

        diagnostics.cacheSize      = this._cache.size;
        diagnostics.requestedPath  = fsPath;
        diagnostics.normalisedKey  = k;
        diagnostics.cachedKeys     = this.keys();
        diagnostics.cacheHit       = isHit;
        diagnostics.parsedLazily   = !isHit;

        const fns = isHit ? this._cache.get(k)! : this._parseLazy(fsPath, k);
        diagnostics.functionCount  = fns.length;
        return fns;
    }

    /**
     * Pre-warms the cache for a set of files (e.g. after a workspace scan).
     * Safe to call multiple times — already-cached files are skipped.
     */
    preIndex(fsPaths: string[]): void {
        for (const p of fsPaths) {
            const k = this.key(p);
            if (!this._cache.has(k)) { this._parseLazy(p, k); }
        }
    }

    /** Evict the cached entry for a single file (e.g. on document save). */
    invalidate(fsPath: string): void {
        this._cache.delete(this.key(fsPath));
    }

    /** Clear all cached entries. */
    clear(): void { this._cache.clear(); }

    // ── Private helpers ──────────────────────────────────────────────────────

    private _parseLazy(fsPath: string, normKey: string): FunctionInfo[] {
        const text = readFileText(fsPath);
        const fns  = text ? detectFunctions(text, text.split('\n')) : [];
        this._cache.set(normKey, fns);
        return fns;
    }
}

// ── Diagnostic record ────────────────────────────────────────────────────────

export interface AstCacheDiagnostics {
    cacheSize:      number;
    requestedPath:  string;
    normalisedKey:  string;
    cachedKeys:     string[];
    cacheHit:       boolean;
    parsedLazily:   boolean;
    functionCount:  number;
}

export function formatDiagnostics(d: AstCacheDiagnostics): string[] {
    return [
        `[AST Cache] size=${d.cacheSize} | hit=${d.cacheHit} | parsed_lazily=${d.parsedLazily}`,
        `[AST Cache] requested: ${path.basename(d.requestedPath)}`,
        `[AST Cache] key: ${d.normalisedKey}`,
        `[AST Cache] functions_found: ${d.functionCount}`,
        `[AST Cache] all_keys(${d.cachedKeys.length}): ${
            d.cachedKeys.map(k => path.basename(k)).join(', ') || '(empty)'
        }`,
    ];
}

// ── Session singleton ────────────────────────────────────────────────────────

/** Shared cache instance reused across all Change Impact Simulator runs. */
export const astCache = new AstCache();
