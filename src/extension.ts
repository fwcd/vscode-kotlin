'use strict';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { registerDebugAdapter } from './debugSetup';
import { InternalConfigManager } from './internalConfig';
import { verifyJavaIsAvailable } from './javaSetup';
import { activateLanguageServer, configureLanguage } from './languageSetup';
import { KotlinApi } from './lspExtensions';
import { fsExists } from './util/fsUtils';
import { LOG } from './util/logger';
import { Status, StatusBarEntry } from './util/status';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext): Promise<ExtensionApi> {
    configureLanguage();

    const kotlinConfig = vscode.workspace.getConfiguration("kotlin");
    let langServerEnabled = kotlinConfig.get("languageServer.enabled");
    let debugAdapterEnabled = kotlinConfig.get("debugAdapter.enabled");
    
    const globalStoragePath = context.globalStorageUri.fsPath;
    if (!(await fsExists(globalStoragePath))) {
        await fs.promises.mkdir(globalStoragePath);
    }
    
    const internalConfigPath = path.join(globalStoragePath, "config.json");
    const internalConfigManager = await InternalConfigManager.loadingConfigFrom(internalConfigPath);
    
    if (!internalConfigManager.getConfig().initialized) {
        const message = "The Kotlin extension will automatically download a language server and a debug adapter to provide code completion, linting, debugging and more. If you prefer to install these yourself, you can provide custom paths or disable them in your settings. The language server and debug adapter currently only supports Maven and Gradle projects";
        const disableButton = "Disable, then continue";
        const confirmed = await vscode.window.showInformationMessage(message, "Ok, continue", disableButton);

        if(disableButton == confirmed) {
            await kotlinConfig.update("languageServer.enabled", false, true);
            await kotlinConfig.update("debugAdapter.enabled", false, true);
            // these values are not yet updated even if we move the above get-calls down. Works the next time the extension is opened
            langServerEnabled = false;
            debugAdapterEnabled = false;
        }
        
        if (!confirmed) {
            await vscode.window.showWarningMessage("Only syntax highlighting will be available for Kotlin.");
            return;
        }
        await internalConfigManager.updateConfig({ initialized: true });
    }

    const initTasks: Promise<void>[] = [];

    if (!(await verifyJavaIsAvailable())) {
        return;
    }

    let extensionApi: ExtensionApi = new ExtensionApi(null);
    
    if (langServerEnabled) {
        initTasks.push(withSpinningStatus(context, async status => {
            const kotlinApi = await activateLanguageServer(context, status, kotlinConfig);
            extensionApi = new ExtensionApi(kotlinApi);
        }));
    } else {
        LOG.info("Skipping language server activation since 'kotlin.languageServer.enabled' is false");
    }
    
    if (debugAdapterEnabled) {
        initTasks.push(withSpinningStatus(context, async status => {
            await registerDebugAdapter(context, status, kotlinConfig);
        }));
    } else {
        LOG.info("Skipping debug adapter registration since 'kotlin.debugAdapter.enabled' is false");
    }
    
    await Promise.all(initTasks);

    return extensionApi;
}

async function withSpinningStatus(context: vscode.ExtensionContext, action: (status: Status) => Promise<void>): Promise<void> {
    const status = new StatusBarEntry(context, "$(sync~spin)");
    status.show();
    await action(status);
    status.dispose();
}

// this method is called when your extension is deactivated
export function deactivate(): void {}

class ExtensionApi {

    private kotlinApi?: KotlinApi;

    constructor(kotlinApi: KotlinApi) {
        this.kotlinApi = kotlinApi;
    }

    async getBuildOutputPath(): Promise<string> {
        return await this.kotlinApi?.getBuildOutputLocation();
    }
}
