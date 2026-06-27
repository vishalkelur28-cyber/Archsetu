# Contributing to ArchSetu

Thank you for your interest in contributing. ArchSetu is a precision tool — every line of code that goes in must meet a high bar for correctness, performance, and clarity. Please read this guide fully before opening a pull request.

---

## Table of Contents

1. [Before You Start](#1-before-you-start)
2. [Setting Up the Development Environment](#2-setting-up-the-development-environment)
3. [Project Structure](#3-project-structure)
4. [Branch Naming Rules](#4-branch-naming-rules)
5. [Commit Message Rules](#5-commit-message-rules)
6. [Code Rules](#6-code-rules)
7. [Testing Rules](#7-testing-rules)
8. [Pull Request Rules](#8-pull-request-rules)
9. [What Gets Rejected](#9-what-gets-rejected)
10. [Reporting Bugs](#10-reporting-bugs)
11. [Suggesting Features](#11-suggesting-features)

---

## 1. Before You Start

- **Open an issue first** before writing any code. Describe what you want to fix or build. Wait for a maintainer to confirm it before spending time on implementation. PRs that arrive without a linked issue will be closed.
- **One PR, one thing.** Do not combine a bug fix with a refactor or a new feature in the same PR. If they are unrelated, they go in separate PRs.
- **Do not submit PRs that only fix formatting, rename variables, or reorder imports.** These are noise and will be closed without review.
- **Do not submit PRs generated entirely by AI tools** (ChatGPT, Copilot, Cursor, etc.). You must understand every line of code you submit and be able to defend it in a review.

---

## 2. Setting Up the Development Environment

**Requirements:**
- Node.js 18 or higher
- npm 9 or higher
- VS Code (latest stable)

```bash
# Clone the repository
git clone https://github.com/vishalkelur28-cyber/Archsetu.git
cd Archsetu

# Install dependencies
npm install

# Build the extension
npm run build

# Type-check (no build output)
npm run lint

# Run all tests
npm test

# Watch mode during development
npm run watch
```

**Running the extension locally:**

1. Open the `Archsetu` folder in VS Code
2. Press **F5** to launch the Extension Development Host
3. Open any JavaScript or TypeScript project in that new window
4. Open the Command Palette (`Ctrl+Shift+P`) and type `ArchSetu`

---

## 3. Project Structure

```
src/
├── extension.ts              ← activation entry point only — no logic here
├── types/index.ts            ← all shared interfaces and types
├── parser/
│   └── FunctionParser.ts     ← regex-based function detection engine
├── analysis/
│   ├── AstCache.ts           ← lazy-loading AST cache with diagnostics
│   ├── CallSiteAnalyzer.ts   ← finds all call sites for a given symbol
│   ├── ChangeImpactAnalyzer.ts
│   ├── ComplexityAnalyzer.ts
│   └── DeadCodeAnalyzer.ts
├── commands/                 ← one file per VS Code command
├── ui/                       ← webview HTML builders and status bar
└── utils/
    ├── editorUtils.ts
    ├── fileUtils.ts
    ├── outputChannel.ts
    ├── symbolExtractor.ts    ← shared cursor symbol extraction logic
    └── textUtils.ts

__mocks__/
└── vscode.ts                 ← VS Code API mock for unit tests

src/__tests__/               ← all test files live here
test-fixture/                ← sample TS/JS files used by integration tests
```

**Rules:**
- Analysis logic belongs in `src/analysis/`. Commands are thin wrappers that call analysis modules and render output.
- Shared utilities belong in `src/utils/`. Do not duplicate helpers across command files.
- Do not put business logic directly inside `extension.ts`. It registers commands only.
- Do not create new top-level directories without discussion.

---

## 4. Branch Naming Rules

All branches must follow this format:

```
<type>/<short-description>
```

| Type | When to use |
|---|---|
| `fix/` | Bug fix |
| `feat/` | New feature |
| `test/` | Adding or fixing tests only |
| `docs/` | Documentation changes only |
| `refactor/` | Internal restructuring with no behaviour change |
| `perf/` | Performance improvement |

**Examples:**
```
fix/dead-code-false-negative
feat/hover-provider-integration
test/symbol-extractor-edge-cases
docs/contributing-guide
```

**Rules:**
- Use lowercase and hyphens only. No underscores, no camelCase, no spaces.
- Keep the description short — under 5 words.
- Never push directly to `main`. All changes go through a PR.

---

## 5. Commit Message Rules

Follow the **Conventional Commits** format:

```
<type>(<scope>): <short summary>
```

**Types:** `fix`, `feat`, `test`, `docs`, `refactor`, `perf`, `chore`

**Scope:** the module or area affected (e.g. `parser`, `deadCode`, `blastRadius`, `symbolExtractor`, `tests`)

**Summary:** present tense, lowercase, no full stop at the end, under 72 characters

**Examples:**
```
fix(deadCode): exclude compiled JS output from dead code scan
feat(entryPoints): detect Next.js page exports as entry points
test(symbolExtractor): add regression for cursor on return type
refactor(callSite): extract isDeclarationLine into shared utility
docs(readme): add complexity score explanation table
```

**Rules:**
- One logical change per commit. Do not bundle unrelated changes.
- Do not use vague messages like `fix stuff`, `update`, `wip`, `misc`, or `changes`.
- Do not mention AI tools, pair-programming sessions, or external assistants in commit messages.

---

## 6. Code Rules

### TypeScript

- **Strict mode is on.** `tsconfig.json` enforces `strict: true`. Zero type errors are allowed — `npm run lint` must pass clean.
- **No `any`.** If you genuinely need an escape hatch, use `unknown` and narrow it properly.
- **No non-null assertions (`!`)** unless you can prove the value cannot be null at that point with a comment explaining why.
- **No unused variables or imports.** The TypeScript compiler will catch these — fix them before submitting.
- **Prefer `const` over `let`.** Only use `let` when reassignment is genuinely needed.

### Comments

- **Write no comments by default.** Well-named functions and variables are self-documenting.
- Only add a comment when the **why** is non-obvious: a hidden constraint, a workaround for a specific edge case, or behavior that would surprise a reader.
- Do not write comments that describe what the code does — the code already does that.
- Do not write multi-line comment blocks or JSDoc on every function.

### Functions

- **One function, one responsibility.** If a function does two things, split it.
- **Keep functions short.** If a function exceeds ~40 lines, consider whether it should be broken up. There is no hard limit, but long functions attract scrutiny in review.
- **Pure functions wherever possible.** Analysis logic should take inputs and return outputs with no side effects. Side effects (file I/O, VS Code API calls) belong at the command layer.

### Error Handling

- **Do not swallow errors silently.** If you catch an exception, either handle it properly or re-throw it.
- **Do not add error handling for scenarios that cannot happen.** Trust the TypeScript type system and internal invariants.
- **Validate at boundaries only** — user input, file system reads, and external API responses. Do not defensively check values that your own code just set.

### Performance

- **Never read a file more than once per command execution.** Use the `AstCache` for parsed results.
- **Exclude `node_modules`, `out/`, `dist/`, `build/`, `.next/`, and `coverage/`** from any file scan. This is already done in `getAllWorkspaceFiles()` — do not bypass it.
- **Do not use synchronous file I/O** (`fs.readFileSync`) on paths the user provides. Use the async utilities in `fileUtils.ts`.

### Security

- **No `eval()` or `new Function()`.**
- **No `child_process` or shell execution of any kind.**
- **No network requests.** ArchSetu is a fully offline tool. Any PR that adds a network call (analytics, telemetry, update checks, or otherwise) will be rejected immediately.

---

## 7. Testing Rules

- **Every bug fix must include a regression test** that would have caught the bug before the fix. If your PR fixes a bug without a test, it will be sent back.
- **Every new feature must include tests** covering the happy path and at least two edge cases.
- **Tests must be deterministic.** No random data, no time-dependent logic, no tests that pass sometimes and fail other times.
- **Tests must be fast.** Unit tests should complete in milliseconds. If your test reads real files from disk, it belongs in `integration.test.ts` with a note explaining why.
- **Do not mock what you are testing.** Mock only external dependencies (VS Code API, file system) — not the module under test.
- **All 260 tests must pass** before submitting. Run `npm test` and confirm `Tests: 260 passed, 260 total` (or higher if you added new tests).
- **Test file naming:** `src/__tests__/<ModuleName>.test.ts`. Match the name of the module being tested.

**Running tests:**
```bash
npm test                  # run all tests once
npm run test:watch        # watch mode
npm run test:coverage     # coverage report
```

---

## 8. Pull Request Rules

### Before opening a PR

- [ ] `npm run lint` passes with zero TypeScript errors
- [ ] `npm test` passes with zero failures
- [ ] Your branch is up to date with `main` (rebase if needed)
- [ ] You have linked the issue your PR addresses
- [ ] You have tested the feature manually in the Extension Development Host (F5)

### PR title format

Same as commit message format:
```
fix(deadCode): exclude compiled JS output from dead code scan
feat(entryPoints): detect Lambda handler exports
```

### PR description must include

1. **What changed** — a plain English summary of what the PR does
2. **Why** — the problem it solves or the issue it addresses (link the issue)
3. **How to test manually** — exact steps to verify the change works in VS Code
4. **Screenshots or output** — for any change that affects what a user sees

### Review process

- A maintainer will review within a reasonable timeframe.
- Reviewers may request changes. Address every comment before marking the PR ready again.
- Do not merge your own PR.
- PRs with unresolved review comments will not be merged.
- Approvals do not expire — if you make only the requested changes after approval, you do not need a new approval.

---

## 9. What Gets Rejected

The following will result in an immediate close without extended discussion:

| Reason | Example |
|---|---|
| No linked issue | PR appears without prior discussion |
| Adds telemetry or network requests | Analytics, update pings, any `fetch()` or `http` call |
| Breaks existing tests | `npm test` shows failures |
| TypeScript errors | `npm run lint` is not clean |
| AI-generated code submitted without understanding | Reviewer asks about a line and author cannot explain it |
| Mixes unrelated changes | Bug fix + new feature in one PR |
| Formatting-only PR | Whitespace, import reordering, quote style changes |
| Adds `console.log` statements | Use the ArchSetu output channel (`getOutputChannel()`) for any diagnostic output |
| Adds `any` type | Use proper types or `unknown` with narrowing |
| Removes or skips existing tests | Deleting tests to make CI pass |
| Adds external runtime dependencies | `npm install <anything>` — the extension has zero runtime deps by design |

---

## 10. Reporting Bugs

**Before reporting:**
- Update to the latest version of ArchSetu from the marketplace
- Try the command on a different project to rule out project-specific issues
- Check existing issues to see if it has already been reported

**When reporting, include:**
- VS Code version
- ArchSetu version
- Operating system
- The exact command you ran
- What you expected to happen
- What actually happened
- A minimal reproduction (ideally a small code snippet that triggers the bug)

**[Report a bug →](https://github.com/vishalkelur28-cyber/Archsetu/issues/new)**

---

## 11. Suggesting Features

**[Share a feature idea via the feedback form →](https://docs.google.com/forms/d/e/1FAIpQLScRu1HXFj-WuV7qTkNq22A2Yi28JtQJ7RdJjMICktGUJD22Nw/viewform)**

Or open a GitHub issue with the label `enhancement`. Include:
- The problem you are trying to solve (not just the solution)
- Who benefits from this and how often they would use it
- Whether you are willing to implement it yourself

Feature requests that duplicate existing VS Code functionality, require network access, or require AI/LLM integration will not be accepted — ArchSetu is intentionally offline and AI-free.

---

## Final Note

ArchSetu exists to help developers understand code without relying on black-box AI tools. The same principle applies here: every contribution should reflect a genuine understanding of the problem and the solution. Quality over quantity, always.
