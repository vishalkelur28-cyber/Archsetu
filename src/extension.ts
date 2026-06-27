// =============================================================================
// ArchSetu — Extension Entry Point
//
// This file is intentionally thin. All logic lives in the modules under:
//   src/commands/   — one file per command
//   src/analysis/   — pure analysis engines
//   src/parser/     — function detection
//   src/ui/         — webview HTML builders + status bar
//   src/utils/      — shared helpers
//   src/types/      — shared interfaces
//
// COMMANDS:
//   archsetu.explainFile      — File stats (lines, functions, complexity)
//   archsetu.showFunctions    — QuickPick jump to any function
//   archsetu.listFunctions    — Print function list to output panel
//   archsetu.functionGraph    — Call graph within current file
//   archsetu.crossFileGraph   — Call graph across the whole project
//   archsetu.deadCode         — Functions defined but never called
//   archsetu.blastRadius      — What breaks if you change the cursor symbol
//   archsetu.entryPoints      — Routes, exports, and app entry points
//   archsetu.healthDashboard  — Visual health dashboard webview
//   archsetu.changeImpact     — Change Impact Simulator (v0.3)
//
// ALWAYS-ON:
//   Status bar badge — live complexity of the function the cursor is in.
// =============================================================================

import * as vscode from 'vscode';

import { explainFile }             from './commands/explainFile';
import { showFunctions }           from './commands/showFunctions';
import { listFunctions }           from './commands/listFunctions';
import { functionGraph }           from './commands/functionGraph';
import { crossFileCallGraph }      from './commands/crossFileGraph';
import { findDeadCode }            from './commands/deadCode';
import { blastRadiusAnalysis }     from './commands/blastRadius';
import { detectEntryPoints }       from './commands/entryPoints';
import { codebaseHealthDashboard } from './commands/healthDashboard';
import { changeImpactSimulator }   from './commands/changeImpact';

import { createStatusBar, disposeStatusBar } from './ui/StatusBar';
import { disposeOutputChannel }              from './utils/outputChannel';
import { shareFeedback, showFeedbackFlow }   from './commands/feedback';

export function activate(context: vscode.ExtensionContext): void {
    // ── Register all commands ─────────────────────────────────────────────────
    const commandMap: Array<[string, () => Promise<void>]> = [
        ['archsetu.explainFile',     explainFile],
        ['archsetu.showFunctions',   showFunctions],
        ['archsetu.listFunctions',   listFunctions],
        ['archsetu.functionGraph',   functionGraph],
        ['archsetu.crossFileGraph',  crossFileCallGraph],
        ['archsetu.deadCode',        findDeadCode],
        ['archsetu.blastRadius',     blastRadiusAnalysis],
        ['archsetu.entryPoints',     detectEntryPoints],
        ['archsetu.healthDashboard', codebaseHealthDashboard],
        ['archsetu.changeImpact',    changeImpactSimulator],
        ['archsetu.feedback',        shareFeedback],
    ];

    for (const [id, handler] of commandMap) {
        context.subscriptions.push(vscode.commands.registerCommand(id, handler));
    }

    // ── Always-on status bar badge ────────────────────────────────────────────
    createStatusBar(context);

    // ── First-install onboarding (fires once, never again) ───────────────────
    const INSTALL_KEY = 'archsetu.v1.installed';
    const isFirstRun  = !context.globalState.get<boolean>(INSTALL_KEY);

    if (isFirstRun) {
        void context.globalState.update(INSTALL_KEY, true);
        void vscode.window.showInformationMessage(
            '👋 Welcome to ArchSetu! Help us build the right features — what problem brought you here?',
            'Tell us (30 sec)',
            'Explore Commands',
            'Dismiss',
        ).then(choice => {
            if (choice === 'Tell us (30 sec)') {
                void showFeedbackFlow();
            } else if (choice === 'Explore Commands') {
                void vscode.commands.executeCommand('workbench.action.quickOpen', '>ArchSetu');
            }
        });
    }
}

export function deactivate(): void {
    disposeStatusBar();
    disposeOutputChannel();
}
