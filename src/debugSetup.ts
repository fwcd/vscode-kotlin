import * as vscode from "vscode";
import * as path from "path";
import * as child_process from "child_process";
import { Status } from "./util/status";
import { ServerDownloader } from "./serverDownloader";
import { correctScriptName, isOSUnixoid } from "./util/osUtils";

export async function registerDebugAdapter(context: vscode.ExtensionContext, status: Status, config: vscode.WorkspaceConfiguration): Promise<void> {
    status.update("Registering Kotlin Debug Adapter...");
    
    // Prepare debug adapter
    const debugAdapterInstallDir = path.join(context.globalStoragePath, "debugAdapterInstall");
    const customPath: string = config.get("debugAdapter.path");
    
    if (!customPath) {
        const debugAdapterDownloader = new ServerDownloader("Kotlin Debug Adapter", "kotlin-debug-adapter", "adapter.zip", debugAdapterInstallDir);
        
        try {
            await debugAdapterDownloader.downloadServerIfNeeded(status);
        } catch (error) {
            console.error(error);
            vscode.window.showWarningMessage(`Could not update/download Kotlin Debug Adapter: ${error}`);
            return;
        }
    }
    
    const startScriptPath = customPath || path.join(debugAdapterInstallDir, "adapter", "bin", correctScriptName("kotlin-debug-adapter"));
    
    // Ensure that start script can be executed
    if (isOSUnixoid()) {
        child_process.exec(`chmod +x ${startScriptPath}`);
    }
    
    vscode.debug.registerDebugAdapterDescriptorFactory("kotlin", new KotlinDebugAdapterDescriptorFactory(startScriptPath));
}

/**
 * A factory that creates descriptors which point
 * to the Kotlin debug adapter start script.
 */
export class KotlinDebugAdapterDescriptorFactory implements vscode.DebugAdapterDescriptorFactory {
    private startScriptPath: string;
    
    public constructor(startScriptPath: string) {
        this.startScriptPath = startScriptPath;
    }
    
    async createDebugAdapterDescriptor(session: vscode.DebugSession, executable: vscode.DebugAdapterExecutable | undefined): Promise<vscode.DebugAdapterDescriptor> {
        return new vscode.DebugAdapterExecutable(this.startScriptPath);
    }
}
