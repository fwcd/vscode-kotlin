import { RequestType } from "vscode-jsonrpc";
import { TextDocumentIdentifier } from "vscode-languageclient";

export namespace JarClassContentsRequest {
	export const type = new RequestType<TextDocumentIdentifier, string, void, void>("kotlin/jarClassContents");
}
