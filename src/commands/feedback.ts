import * as vscode from 'vscode';

const FEEDBACK_URL = 'https://docs.google.com/forms/d/e/1FAIpQLScRu1HXFj-WuV7qTkNq22A2Yi28JtQJ7RdJjMICktGUJD22Nw/viewform';

interface PainPoint {
    label:          string;
    detail:         string;
    suggestedCmd:   string;
    suggestedTitle: string;
}

const PAIN_POINTS: PainPoint[] = [
    {
        label:          '$(search) Understanding a large or unfamiliar codebase',
        detail:         'New project, legacy code, or onboarding a new team member',
        suggestedCmd:   'archsetu.healthDashboard',
        suggestedTitle: 'Codebase Health Dashboard',
    },
    {
        label:          '$(trash) Finding dead / unused code',
        detail:         'Functions or modules that are defined but never called',
        suggestedCmd:   'archsetu.deadCode',
        suggestedTitle: 'Find Dead Code',
    },
    {
        label:          '$(list-tree) Tracing call chains (what calls what)',
        detail:         'Following how functions connect across files',
        suggestedCmd:   'archsetu.crossFileGraph',
        suggestedTitle: 'Cross-File Call Graph',
    },
    {
        label:          '$(warning) Measuring code complexity',
        detail:         'Cyclomatic complexity hotspots and over-complicated functions',
        suggestedCmd:   'archsetu.listFunctions',
        suggestedTitle: 'List Functions (with complexity)',
    },
    {
        label:          '$(pulse) Estimating change impact before editing',
        detail:         'Understanding the blast radius of a refactor or bug fix',
        suggestedCmd:   'archsetu.changeImpact',
        suggestedTitle: 'Change Impact Simulator',
    },
    {
        label:          '$(organization) Code reviews — faster and safer',
        detail:         'Quickly understanding what a PR touches and at what risk',
        suggestedCmd:   'archsetu.blastRadius',
        suggestedTitle: 'Blast Radius Analysis',
    },
    {
        label:          '$(debug-disconnect) Circular dependency detection',
        detail:         'Modules that import each other, causing hidden coupling',
        suggestedCmd:   'archsetu.changeImpact',
        suggestedTitle: 'Change Impact Simulator (shows circular deps)',
    },
    {
        label:          '$(comment-discussion) Something else',
        detail:         'Tell us what you need — opens a feedback message',
        suggestedCmd:   '',
        suggestedTitle: '',
    },
];

/**
 * Shared pain-point QuickPick flow used by both the first-run welcome
 * and the manual "Share Feedback" command.
 */
export async function showFeedbackFlow(): Promise<void> {
    const pick = await vscode.window.showQuickPick(
        PAIN_POINTS.map(p => ({ label: p.label, detail: p.detail, _pain: p })),
        {
            title:       'ArchSetu — What problem are you trying to solve?',
            placeHolder: 'Choose the closest match (Esc to skip)',
            matchOnDetail: true,
        }
    );

    if (!pick) { return; }

    const pain = pick._pain;

    if (pain.suggestedCmd) {
        const action = await vscode.window.showInformationMessage(
            `Great match! Try ArchSetu: ${pain.suggestedTitle} — it was built for exactly this.`,
            'Run it now',
            'Send feedback',
            'Dismiss',
        );

        if (action === 'Run it now') {
            void vscode.commands.executeCommand(pain.suggestedCmd);
        } else if (action === 'Send feedback') {
            await openFeedbackLink(pain.label);
        }
    } else {
        // "Something else" branch
        await openFeedbackLink('');
    }
}

async function openFeedbackLink(_painLabel: string): Promise<void> {
    await vscode.env.openExternal(vscode.Uri.parse(FEEDBACK_URL));
}

/** Registered as the `archsetu.feedback` command. */
export async function shareFeedback(): Promise<void> {
    await showFeedbackFlow();
}
