// =============================================================================
// ArchSetu — Shared Types
// All interfaces and types used across the extension live here.
// =============================================================================

/** A function detected inside a single file. */
export interface FunctionInfo {
    readonly name: string;
    readonly line: number;        // 0-based
    readonly character: number;   // 0-based column of the name
    readonly endLine: number;     // 0-based line of the closing brace
}

/** FunctionInfo extended with the file it came from (workspace-wide scans). */
export interface WorkspaceFunctionInfo extends FunctionInfo {
    readonly filePath: string;   // absolute path
    readonly fileName: string;   // workspace-relative display path
}

/** One location in a file where a symbol is called or referenced. */
export interface CallSite {
    readonly filePath: string;
    readonly fileName: string;
    readonly line: number;       // 0-based
    readonly lineText: string;   // trimmed source text of that line
}

/** Per-file metrics collected for the Health Dashboard. */
export interface FileStats {
    relPath: string;
    lineCount: number;
    functionCount: number;
    maxComplexity: number;
    mostComplexFn: string;
    importCount: number;
}

/** Data bag for the Health Dashboard webview. */
export interface DashboardData {
    totalFiles: number;
    totalFunctions: number;
    totalLines: number;
    healthScore: number;         // 0–100
    avgComplexity: number;
    complexityHotspots: Array<{ relPath: string; maxComplexity: number; mostComplexFn: string }>;
    largestFiles: Array<{ relPath: string; lineCount: number }>;
    mostDependentFiles: Array<{ relPath: string; importCount: number }>;
}

/** A file that imports the source file being analysed. */
export interface ImportedBy {
    filePath: string;
    fileName: string;
    line: number;                // 0-based line of the import statement
    importStatement: string;     // trimmed text of the import line
}

/** One entry point detected in the codebase. */
export interface EntryPoint {
    type: string;       // e.g. "HTTP GET", "Event", "Export"
    name: string;       // e.g. "/api/login" or "validateUser"
    fileName: string;
    line: number;       // 0-based
    lineText: string;
}

/** Risk classification for Change Impact analysis. */
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/** Full result produced by the Change Impact Analyzer. */
export interface ChangeImpactResult {
    symbolName: string;
    symbolFile: string;             // workspace-relative path
    calledByCount: number;          // total call sites found
    usedInFilesCount: number;       // distinct files that contain a call site
    importedByModules: ImportedBy[];
    apiRoutes: string[];            // e.g. ["POST /api/order"]
    frontendComponents: string[];   // tsx/jsx filenames that import the source
    riskScore: number;              // 0–100
    riskLevel: RiskLevel;
    recommendedTests: string[];
    circularDependencies: string[];
    isExported: boolean;
    complexity: number;
    callSites: CallSite[];
}
