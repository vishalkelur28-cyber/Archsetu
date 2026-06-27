import * as vscode from 'vscode';

let _channel: vscode.OutputChannel | undefined;

/** Returns the shared ArchSetu output channel, creating it on first call. */
export function getOutputChannel(): vscode.OutputChannel {
    if (!_channel) {
        _channel = vscode.window.createOutputChannel('ArchSetu');
    }
    return _channel;
}

/** Disposes the output channel and clears the reference. Called on deactivation. */
export function disposeOutputChannel(): void {
    _channel?.dispose();
    _channel = undefined;
}
