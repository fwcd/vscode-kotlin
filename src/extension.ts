'use strict';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { registerDebugAdapter } from './debugSetup';
import { InternalConfigManager } from './internalConfig';
import { activateLanguageServer, configureLanguage } from './languageSetup';
import { fsExists } from './util/fsUtils';
import { LOG } from './util/logger';
import { Status, StatusBarEntry } from './util/status';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext): Promise<void> {
    configureLanguage();

    const kotlinConfig = vscode.workspace.getConfiguration("kotlin");
    const langServerEnabled = kotlinConfig.get("languageServer.enabled");
    const debugAdapterEnabled = kotlinConfig.get("debugAdapter.enabled");
    
    if (!(await fsExists(context.globalStoragePath))) {
        await fs.promises.mkdir(context.globalStoragePath);
    }
    
    const internalConfigPath = path.join(context.globalStoragePath, "config.json");
    const internalConfigManager = await InternalConfigManager.loadingConfigFrom(internalConfigPath);
    
    if (!internalConfigManager.getConfig().initialized) {
        const message = "The Kotlin extension will automatically download a language server and a debug adapter to provide code completion, linting, debugging and more. If you prefer to install these yourself, you can provide custom paths or disable them in your settings.";
        await vscode.window.showInformationMessage(message, "Ok, continue");
        await internalConfigManager.updateConfig({ initialized: true });
    }

    const initTasks: Promise<void>[] = [];
    
    if (langServerEnabled) {
        // Optionally a custom path to the language server executable
        let customPath = nullIfEmpty(kotlinConfig.get("languageServer.path"));
        
        initTasks.push(withSpinningStatus(context, async status => {
            await activateLanguageServer(context, status, customPath);
        }));
    } else {
        LOG.info("Skipping language server activation since 'kotlin.languageServer.enabled' is false");
    }
    
    if (debugAdapterEnabled) {
        // Optionally a custom path to the debug adapter executable
        let customPath = nullIfEmpty(kotlinConfig.get("debugAdapter.path"));
        
        initTasks.push(withSpinningStatus(context, async status => {
            await registerDebugAdapter(context, status, customPath);
        }));
    } else {
        LOG.info("Skipping debug adapter registration since 'kotlin.debugAdapter.enabled' is false");
    }
    
    await Promise.all(initTasks);
}

function nullIfEmpty(s: string): string | null {
    return (s === "") ? null : s;
}

async function withSpinningStatus(context: vscode.ExtensionContext, action: (status: Status) => Promise<void>): Promise<void> {
    const status = new StatusBarEntry(context, "$(sync~spin)");
    status.show();
    await action(status);
    status.dispose();
}

// this method is called when your extension is deactivated
export function deactivate(): void {}
