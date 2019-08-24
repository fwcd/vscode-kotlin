import * as vscode from "vscode";
import { LanguageClient } from "vscode-languageclient";
import { JarClassContentsRequest } from "./lspExtensions";

/**
 * Fetches the source contents of a class using
 * the language server.
 */
export class JarClassContentProvider implements vscode.TextDocumentContentProvider {
	private client: LanguageClient;
	
	constructor(client: LanguageClient) {
		this.client = client;
	}
	
	async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
		const result = await this.client.sendRequest(JarClassContentsRequest.type, { uri: uri.toString() });
		if (result == null) {
			vscode.window.showErrorMessage(`Could not fetch class file contents of '${uri}' from the language server. Make sure that it conforms to the format 'kls:file:///path/to/myJar.jar!/path/to/myClass.class'!`);
			return "";
		} else {
			return result;
		}
	}
}
