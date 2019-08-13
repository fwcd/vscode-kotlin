'use strict';
import * as vscode from 'vscode';
import { LOG } from './util/logger';
import { activateLanguageServer, configureLanguage } from './languageSetup';
import { registerDebugAdapter } from './debugSetup';
import { fsExists, fsMkdir } from './util/fsUtils';
import { StatusBarEntry } from './util/status';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext): Promise<void> {
    configureLanguage();

    const kotlinConfig = vscode.workspace.getConfiguration("kotlin");
    const langServerEnabled = kotlinConfig.get("languageServer.enabled");
    const debugAdapterEnabled = kotlinConfig.get("debugAdapter.enabled");
    
    if (!(await fsExists(context.globalStoragePath))) {
        await fsMkdir(context.globalStoragePath);
    }
    
    const status = new StatusBarEntry(context, "$(sync~spin)");
    status.update("Activating Kotlin extension...");
    status.show();
    
    if (langServerEnabled) {
        await activateLanguageServer(context, status);
    } else {
        LOG.info("Skipping language server activation since 'kotlin.languageServer.enabled' is false");
    }
    
    if (debugAdapterEnabled) {
        await registerDebugAdapter(context, status);
    } else {
        LOG.info("Skipping debug adapter registration since 'kotlin.debugAdapter.enabled' is false");
    }
    
    status.dispose();
}

// this method is called when your extension is deactivated
export function deactivate(): void {}
