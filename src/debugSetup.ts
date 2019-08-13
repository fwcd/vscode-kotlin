import * as vscode from "vscode";
import { Status } from "./util/status";

export async function registerDebugAdapter(context: vscode.ExtensionContext, status: Status): Promise<void> {
	status.update("Registering Kotlin Debug Adapter...");
	
	// TODO
}
