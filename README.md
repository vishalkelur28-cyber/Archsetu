# ArchSetu

> **Understand any JavaScript or TypeScript codebase instantly — without AI.**

ArchSetu is a VS Code extension that gives developers deep structural insight into their code. It answers the questions every developer asks when they open an unfamiliar project:

- *Where does this app even start?*
- *If I change this function, what breaks?*
- *Which functions are dead and can be safely deleted?*
- *How healthy is this codebase overall?*
- *Which files are the most complex?*

No internet connection. No API keys. No AI. Just fast, accurate, offline analysis of your JavaScript and TypeScript files.

---

## Why ArchSetu is Different

Tools like Cursor, Copilot, and Cline are built for **writing** code. ArchSetu is built for **understanding** code.

| What you want to know | Cursor / Copilot | ArchSetu |
|---|---|---|
| Write new code faster | ✅ | ❌ |
| Understand an unfamiliar codebase | ❌ | ✅ |
| See all callers of a function across every file | ❌ | ✅ |
| Find dead (unused) functions project-wide | ❌ | ✅ |
| Know the blast radius before refactoring | ❌ | ✅ |
| Visualize the health of the entire project | ❌ | ✅ |
| See cross-file call relationships | ❌ | ✅ |
| Works offline with no API key | ❌ | ✅ |

---

## All Commands

Open the **Command Palette** (`Ctrl+Shift+P` / `Cmd+Shift+P`) and type `ArchSetu` to see every command.

| Command | What it does |
|---|---|
| `ArchSetu: Explain File` | File stats: lines, functions, classes, imports, most complex function |
| `ArchSetu: Show Functions (Jump)` | Searchable list of all functions — pick one to jump to it |
| `ArchSetu: List Functions` | All functions with line numbers, lengths, and complexity scores |
| `ArchSetu: Function Graph (This File)` | Call graph within the current file |
| `ArchSetu: Cross-File Call Graph` | Call graph across the ENTIRE project |
| `ArchSetu: Find Dead Code` | Functions defined but never called anywhere in the project |
| `ArchSetu: Blast Radius Analysis` | Everything that depends on the function under your cursor |
| `ArchSetu: Detect Entry Points` | Routes, exports, event listeners, main() — where the app starts |
| `ArchSetu: Codebase Health Dashboard` | Visual panel: health score, hotspots, largest files, coupling |
| `ArchSetu: Change Impact Simulator` | Before you change a symbol — see risk score, every call site, routes, components, and test recommendations |

---

## Feature Explanations

---

### 1. Explain File

**Command:** `ArchSetu: Explain File`
**Works on:** The file currently open in your editor

Gives you a one-glance summary of any JS/TS file. Useful when you open a file for the first time and want to know what you're dealing with before reading any code.

**What it shows:**
- File name
- Total number of lines
- Number of functions detected
- Number of classes
- Number of import / require statements
- Name and complexity score of the most complex function in the file

**Example output:**
```
╔═══════════════════════════════════════════════╗
║           ArchSetu — File Analysis            ║
╚═══════════════════════════════════════════════╝

  File          :  auth.ts
  Total Lines   :  284
  Functions     :  11
  Classes       :  1
  Imports       :  6
  Most Complex  :  validateTokenPayload()  — score 13  (High — consider splitting)

═══════════════════════════════════════════════════
```

**When to use it:**
- First time opening a file
- Code review — quickly gauge file complexity
- Onboarding to a new project

---

### 2. Show Functions (Jump)

**Command:** `ArchSetu: Show Functions (Jump)`
**Works on:** The file currently open in your editor

Opens a searchable dropdown (VS Code QuickPick) listing every function in the file. Type any part of the function name to filter. Press Enter to jump the cursor directly to that function.

**What it shows in the dropdown:**
- Function icon + name
- Line number
- The actual source code line (so you can see the signature)

**When to use it:**
- Navigating large files with many functions
- Faster than scrolling or using Ctrl+F to search for a function name
- Works better than the built-in "Go to Symbol" for complex files

---

### 3. List Functions

**Command:** `ArchSetu: List Functions`
**Works on:** The file currently open in your editor

Prints a table of every function in the file to the ArchSetu output panel. Unlike "Show Functions", this stays visible as a reference while you work.

**What it shows for each function:**
- Sequential number
- Function name
- Starting line number
- Length in lines
- Complexity score with label (Low / Med / HIGH)

**Example output:**
```
  #    Name                            Line    Length   Complexity
  ─────────────────────────────────────────────────────────────────
    1  activate                          381    14 lines   2 Low
    2  deactivate                        396     4 lines   1 Low
    3  validateUser                       45    38 lines   9 Med
    4  createToken                        84    12 lines   3 Low
    5  refreshToken                       97    61 lines  14 HIGH
```

**When to use it:**
- Getting a full inventory of what's in a file
- Identifying which functions are too long or too complex
- Audit before a refactor

---

### 4. Function Graph (This File)

**Command:** `ArchSetu: Function Graph (This File)`
**Works on:** The file currently open in your editor

Shows a text-based tree of which functions call which other functions — within this one file. Each function is shown as a root node, with lines below it showing what it calls.

**Example output:**
```
  login()  —  line 23
  ├── validateUser()
  └── createSession()

  validateUser()  —  line 45
  ├── hashPassword()
  └── queryDatabase()

  hashPassword()  —  line 78
  └── (does not call any other function in this file)
```

**When to use it:**
- Understanding how functions relate to each other before editing
- Finding long call chains that might be simplified
- Understanding the flow of logic in a file

**Note:** This only shows calls within the current file. For cross-file connections, use "Cross-File Call Graph."

---

### 5. Cross-File Call Graph

**Command:** `ArchSetu: Cross-File Call Graph`
**Scope:** Entire workspace (all JS/TS files)

This is ArchSetu's most powerful feature. It scans every JavaScript and TypeScript file in your project and maps out which files call functions defined in which other files. The result is a full picture of how your entire codebase is connected.

**How it works:**
1. Reads every `.js`, `.ts`, `.jsx`, `.tsx` file (skipping `node_modules`)
2. Detects all function definitions across all files
3. For each function, searches all OTHER files for calls to it
4. Groups results by the file that defines the function

**Example output:**
```
📁  src/utils/auth.ts
────────────────────────────────────────────────────
  validateUser()
    → src/routes/login.ts  :  line 45
      const result = validateUser(req.body, options)
    → src/middleware/guard.ts  :  line 12
      if (!validateUser(ctx.user)) return 401

  createToken()
    → src/routes/login.ts  :  line 67
      const token = createToken(userId, expiry)

Files scanned             : 24
Files with connections    : 8
Total cross-file calls    : 31
```

**When to use it:**
- Starting on a new codebase — see the full picture in one command
- Before a major refactor — understand all dependencies
- Architecture review — spot which files are most heavily used

---

### 6. Find Dead Code

**Command:** `ArchSetu: Find Dead Code`
**Scope:** Entire workspace (all JS/TS files)

Scans the entire project for functions that are defined somewhere but never called from anywhere. These are "dead" — they exist in the code but nothing uses them.

**Why dead code is a problem:**
- Confuses developers ("is this actually used somewhere?")
- Takes up space and adds maintenance burden
- Can mask bugs that nobody notices because the code never runs

**How it works:**
1. Collects every function definition across all files
2. Searches the entire codebase for calls to each function name
3. If a function has no callers (or only the definition itself), it's flagged as dead

**Example output:**
```
  Found 3 potentially dead function(s):

  📁 src/utils/helpers.ts
       ⚠  formatDate()   —   line 12
       ⚠  parseCSV()     —   line 45

  📁 src/routes/admin.ts
       ⚠  legacyLogin()  —   line 89

  Total functions found    : 47
  Live (called somewhere)  : 44
  Dead (never called)      : 3
```

**Important:** This is static analysis. It cannot detect functions called via:
- String names (e.g. `obj[funcName]()`)
- `eval()`
- Dynamic `require()` or `import()`

Always review before deleting anything.

**When to use it:**
- Before a release — clean up leftover code
- After a big refactor — find functions that are no longer needed
- Reducing bundle size — less code = faster load

---

### 7. Blast Radius Analysis

**Command:** `ArchSetu: Blast Radius Analysis`
**Works on:** The word under your cursor (place cursor on any function name)

"Blast radius" is the term for how much of your codebase is affected if you change one thing. Before you rename, modify, or delete a function, run this command to see exactly what will break.

**How to use it:**
1. Open any file that contains (or calls) the function you're about to change
2. Click on the function's name so your cursor is on it
3. Run `ArchSetu: Blast Radius Analysis` from the Command Palette
4. Read the full list of every file and line that calls this function

**Example output (cursor was on `validateUser`):**
```
╔═══════════════════════════════════════════════════╗
║         ArchSetu — Blast Radius Analysis         ║
║  Everything that depends on this function        ║
╚═══════════════════════════════════════════════════╝

  Function        :  validateUser()
  Affected files  :  3
  Total call sites:  5

  All of the following will need attention if you change this function:

  📁 src/routes/auth.ts  (2 call site(s))
      line   45 :  const ok = validateUser(req.body)
      line   89 :  if (!validateUser(token)) throw new Error(...)

  📁 src/middleware/guard.ts  (2 call site(s))
      line   12 :  validateUser(ctx.user)
      line   34 :  return validateUser(payload)

  📁 tests/auth.test.ts  (1 call site(s))
      line   23 :  expect(validateUser(mockData)).toBe(true)
```

**When to use it:**
- Before renaming a function
- Before changing a function's parameters
- Before deleting a function
- During code review to understand impact of proposed changes

---

### NEW — Change Impact Simulator

**Command:** `ArchSetu: Change Impact Simulator`
**Works on:** The word under your cursor (function, class, or any exported symbol)

The most comprehensive pre-change analysis in ArchSetu. Before you touch a symbol, run this to see a full interactive panel showing everything that will be affected.

**How to use it:**
1. Place your cursor on any function name, class name, or exported identifier
2. Run `ArchSetu: Change Impact Simulator` from the Command Palette
3. A panel opens beside your editor with the full impact report

**What the panel shows:**

| Section | Description |
|---|---|
| **Risk Score (0–100)** | A calculated score — the higher the number, the riskier the change |
| **Risk Level** | LOW / MEDIUM / HIGH / CRITICAL badge |
| **Call Sites** | Total number of times this symbol is called across the project |
| **Files Affected** | How many distinct files contain a call site |
| **Importing Modules** | Files that directly import the source file |
| **API Routes** | HTTP routes (GET/POST/etc.) in the affected files |
| **Frontend Components** | React/JSX component files (.tsx/.jsx) that use this symbol |
| **Recommended Tests** | Test files that should be run after this change |
| **Circular Dependencies** | Detected circular imports between the source file and its callers |

**Risk Score Algorithm:**

| Factor | Max Points |
|---|---|
| Number of call sites (the more callers, the riskier) | 25 |
| Number of distinct files affected | 20 |
| Number of modules that import the source file | 15 |
| Symbol touches live API routes | 10 |
| Symbol is used by frontend components | 8 |
| High function complexity | 10 |
| Circular dependencies detected | 12 |
| Symbol is exported (part of public API) | 5 |
| No test file found | 5 |
| **Total** | **100** |

**Risk Levels:**

| Score | Level | Meaning |
|---|---|---|
| 0–25 | LOW | Safe to change. Limited impact, well contained. |
| 26–50 | MEDIUM | Review callers before changing. Run the recommended tests. |
| 51–75 | HIGH | High blast radius. Coordinate with your team. |
| 76–100 | CRITICAL | Dangerous change. Touches API routes, many files, or has circular deps. |

**Example panel (cursor was on `calculateInvoice`):**

```
⚡ Change Impact Simulator

calculateInvoice()
src/billing/invoice.ts                                              [HIGH]

┌────────────┬──────────────┬──────────────┬────────────┬──────────────┐
│  17        │  8           │  4           │  2         │  3           │
│  Call Sites│  Files       │  Modules     │  API Routes│  UI Components│
└────────────┴──────────────┴──────────────┴────────────┴──────────────┘

Risk Score  84 / 100
████████████████████████████████████████████████████░░░░░░░░░░

▶ API Routes (2)
▶ Frontend Components (3)
▶ Importing Modules (4)
▶ All Call Sites (17)
▶ Recommended Tests (3)
▶ Circular Dependencies (none)
```

**When to use it:**
- Every time before you modify a function that might be shared
- When onboarding — understand the risk profile of key functions
- During architecture reviews — identify your highest-risk symbols
- Before deploying — validate test coverage for changed functions

---

### 8. Detect Entry Points

**Command:** `ArchSetu: Detect Entry Points`
**Scope:** Entire workspace (all JS/TS files)

Finds every "door into your application" — the places where execution starts or where the outside world can call into your code. Grouped by type for easy reading.

**Entry point types detected:**

| Type | Examples |
|---|---|
| **HTTP GET/POST/PUT/PATCH/DELETE** | `app.get('/login', ...)`, `router.post('/users', ...)` |
| **HTTP USE** | `app.use('/api', ...)` — middleware routes |
| **Event** | `addEventListener('click', ...)`, `emitter.on('data', ...)` |
| **Export** | `export function myFunc()`, `export const handler = ...` |
| **Main** | `function main()` — classic app entry point |
| **IIFE** | `(async () => { ... })()` — self-running code on file load |

**Example output:**
```
  ── HTTP GET ─────────────────────────────────────
  /                          src/routes/index.ts  :  line 5
  /api/users                 src/routes/users.ts  :  line 8
  /api/users/:id             src/routes/users.ts  :  line 15

  ── HTTP POST ────────────────────────────────────
  /api/login                 src/routes/auth.ts   :  line 12
  /api/register              src/routes/auth.ts   :  line 34

  ── Export ───────────────────────────────────────
  validateUser               src/utils/auth.ts    :  line 45
  hashPassword               src/utils/auth.ts    :  line 67

  ── Main ─────────────────────────────────────────
  main                       src/index.ts         :  line 1

  Total entry points found: 9
```

**When to use it:**
- Day one on a new codebase — "where do I even start?"
- API documentation — see all your routes in one place
- Security review — see every public-facing entry point at a glance

**Frameworks supported:** Express, Fastify, Hapi, Koa, and any framework that uses `app.METHOD()` or `router.METHOD()` syntax.

---

### 9. Codebase Health Dashboard

**Command:** `ArchSetu: Codebase Health Dashboard`
**Scope:** Entire workspace (all JS/TS files)

Opens a visual panel inside VS Code showing the overall health of your codebase. Think of it like the dashboard in a car — one look tells you if something needs attention.

**What the dashboard shows:**

**Health Score (0–100)**
A single number that grades your codebase:
- **70–100 (Green — Healthy):** Complexity is low, code is maintainable
- **40–69 (Orange — Needs Attention):** Some complex functions that should be simplified
- **0–39 (Red — Critical):** High complexity throughout, refactoring is strongly recommended

The score is calculated from the average maximum complexity across all files. The lower your complexity, the higher your score.

**Key Stats (top row)**
- Total JS/TS file count
- Total function count
- Total lines of code
- Average complexity score

**Complexity Hotspots Table**
The 5 files with the highest complexity. Shows:
- File path
- The single most complex function in that file
- Complexity score with warning labels

**Largest Files Table**
The 5 files with the most lines. Files over 500 lines get a warning — they are likely doing too many things and are candidates for splitting.

**Highest Coupling Table**
The 5 files that import the most other modules. High import counts mean the file depends on many other parts of the system, making it hard to change in isolation.

**When to use it:**
- Monthly code health check
- Before planning a refactoring sprint — see where to focus
- When a new developer joins — show them where the rough edges are
- After a fast-growth period to see what technical debt has accumulated

---

## Complexity Score Explained

Every function in your project gets a complexity score. Here is how to read it:

| Score | Label | What it means |
|---|---|---|
| 1–5 | Low | Simple and easy to understand. One main path through the code. |
| 6–10 | Medium | Getting complex. Several branches. Consider adding comments. |
| 11+ | High | Hard to follow. Multiple nested conditions, loops, or logic paths. Strong candidate for refactoring into smaller functions. |

The score counts:
- `if` / `else if` statements
- `for` / `while` / `do` loops
- `case` in switch statements
- `catch` blocks
- `&&` and `||` logical operators (short-circuit paths)
- Ternary operators `? :`

---

## Supported Languages

- TypeScript (`.ts`, `.tsx`)
- JavaScript (`.js`, `.jsx`)

Function detection covers:

```ts
// 1. Named function declarations
function myFunc() {}
export async function myFunc<T>(arg: T): Promise<void> {}

// 2. Arrow functions
const myFunc = () => {}
const myFunc = async (a: string, b: number) => {}
export const myFunc = (x: number) => x * 2

// 3. Function expressions
const myFunc = function() {}
const myFunc = async function() {}

// 4. Class methods
class MyClass {
  public myMethod() {}
  private async fetchData(): Promise<Data> {}
  static getInstance() {}
}
```

---

## Getting Started (Development)

```bash
# Install dependencies
npm install

# Build the extension
npm run build

# Build and watch for changes automatically
npm run watch

# Type-check without building
npm run lint
```

Then press **F5** in VS Code to launch the **Extension Development Host** — a new VS Code window with ArchSetu loaded.

Open any JavaScript or TypeScript project folder in that window, open the Command Palette (`Ctrl+Shift+P`), and type `ArchSetu` to see all commands.

---

## Tech Stack

- **TypeScript** — the extension itself
- **VS Code Extension API** — for editor integration, output panels, webviews, and QuickPick
- **ESBuild** — fast bundling
- **Node.js `fs` module** — for reading workspace files
- **No external runtime dependencies** — everything is built-in

---

## Performance Notes

Commands that scan the whole workspace (Cross-File Graph, Dead Code Finder, Entry Points, Health Dashboard, Change Impact Simulator) read every JS/TS file on disk. They show a loading spinner while working.

On small to medium projects (under ~500 files), these commands complete in 1–5 seconds.
On very large projects (1000+ files), they may take 10–30 seconds.

`node_modules` and `.d.ts` files are always excluded automatically.

---

## Feedback & Suggestions

Found a bug? Have an idea for a new feature? Something not working as expected?

**[Share your feedback here →](https://docs.google.com/forms/d/e/1FAIpQLScRu1HXFj-WuV7qTkNq22A2Yi28JtQJ7RdJjMICktGUJD22Nw/viewform)**

All feedback is read personally. Your input directly shapes what gets built next.

---

## Privacy

ArchSetu performs 100% local, offline analysis.

- Zero network requests
- Zero telemetry
- Zero API keys required
- Your source code never leaves your machine

---

## Architecture

ArchSetu is built as a modular Engineering Intelligence Platform:

```
src/
├── extension.ts          ← thin entry point (activate/deactivate only)
├── types/index.ts        ← all shared TypeScript interfaces
├── parser/               ← function detection engine (regex + brace counter)
├── analysis/             ← reusable analysis modules
│   ├── ComplexityAnalyzer.ts
│   ├── CallSiteAnalyzer.ts
│   └── ChangeImpactAnalyzer.ts
├── commands/             ← one file per VS Code command
├── ui/                   ← webview HTML builders + status bar
└── utils/                ← file I/O, text helpers, editor utilities
```

Every analysis module is independently reusable by future features. No logic is duplicated across commands.
