import * as vscode from "vscode";
import * as path from "path";
import { Status } from "./util/status";
import { ServerDownloader } from "./serverDownloader";
import { correctScriptName } from "./util/osUtils";

export async function registerDebugAdapter(context: vscode.ExtensionContext, status: Status): Promise<void> {
	status.update("Registering Kotlin Debug Adapter...");
	
	// Prepare debug adapter
	const debugAdapterInstallDir = path.join(context.globalStoragePath, "debugAdapterInstall");
	const debugAdapterDownloader = new ServerDownloader("Kotlin Debug Adapter", "kotlin-debug-adapter", "adapter.zip", debugAdapterInstallDir);
	try {
		await debugAdapterDownloader.downloadServerIfNeeded(status);
	} catch (error) {
		console.error(error);
		vscode.window.showErrorMessage(`Could not download debug adapter: ${error}`);
		return;
	}
	
	const startScriptPath = path.join(debugAdapterInstallDir, "adapter", "bin", correctScriptName("kotlin-debug-adapter"));
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
