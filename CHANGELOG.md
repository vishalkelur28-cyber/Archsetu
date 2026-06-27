# Changelog

All notable changes to ArchSetu are documented here.

Format: [Semantic Versioning](https://semver.org) — `MAJOR.MINOR.PATCH`

---

## [0.3.0] — 2026-06-27

### Added

**Change Impact Simulator** (`ArchSetu: Change Impact Simulator`)

The flagship feature of Release 0.3. Place your cursor on any function, class, or exported symbol and run this command to see a full interactive risk report before making any change.

- **Risk Score (0–100)** — calculated from call volume, file spread, API exposure, complexity, circular deps, and test coverage
- **Risk Level badge** — LOW / MEDIUM / HIGH / CRITICAL
- **KPI strip** — Call Sites · Files Affected · Importing Modules · API Routes · UI Components
- **API Routes section** — HTTP routes (Express/Fastify/Koa/Hapi) that are reachable through the affected files
- **Frontend Components section** — `.tsx` / `.jsx` files that import the source file
- **Importing Modules section** — every file that statically imports the source file
- **All Call Sites section** — every line across the workspace that calls this symbol
- **Recommended Tests section** — existing test files to run, with prompts to create missing ones
- **Circular Dependencies section** — direct A→B→A circular import cycles
- Modern dark webview with collapsible `<details>` sections, animated risk bar, and VS Code theme variables

### Changed

**Architecture refactor** — the entire extension has been restructured from a single 1,597-line `extension.ts` God File into a fully modular architecture:

```
src/
├── types/index.ts                    (shared interfaces)
├── parser/FunctionParser.ts          (function detection engine)
├── analysis/ComplexityAnalyzer.ts    (complexity scoring)
├── analysis/CallSiteAnalyzer.ts      (shared call-site finder — used by blastRadius, crossFileGraph, changeImpact)
├── analysis/ChangeImpactAnalyzer.ts  (new)
├── commands/                         (one file per command)
├── ui/StatusBar.ts
├── ui/HealthDashboardPanel.ts
├── ui/ChangeImpactPanel.ts           (new)
└── utils/                            (textUtils, fileUtils, editorUtils, outputChannel)
```

- `blastRadius`, `crossFileCallGraph`, and `changeImpact` now share a single `CallSiteAnalyzer` — no logic duplication
- `tsconfig.json` updated with `noUnusedLocals: true` (added to existing strict config)
- `extension.ts` is now a thin entry point — registration only, no business logic

### Fixed

- Removed unused import in `explainFile` detected by strict TypeScript checker

---

## [0.2.0] — Initial Release

### Added

- **Explain File** — file stats in the output panel
- **Show Functions (Jump)** — searchable QuickPick navigator
- **List Functions** — function table with complexity scores
- **Function Graph** — in-file call tree
- **Cross-File Call Graph** — project-wide function dependency map
- **Find Dead Code** — functions defined but never called
- **Blast Radius Analysis** — all call sites for the symbol under the cursor
- **Detect Entry Points** — HTTP routes, exports, event listeners, IIFEs, `main()`
- **Codebase Health Dashboard** — visual webview: health score, complexity hotspots, largest files, coupling table
- **Status Bar Badge** — live complexity indicator for the function the cursor is in (with caching)
- Zero network calls, zero telemetry, zero AI dependency
