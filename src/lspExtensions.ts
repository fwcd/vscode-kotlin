import { RequestType } from "vscode-jsonrpc";
import { TextDocumentIdentifier } from "vscode-languageclient";

export namespace JarClassContentsRequest {
    export const type = new RequestType<TextDocumentIdentifier, string, void>("kotlin/jarClassContents");
}

export namespace MainClassRequest {
    export const type = new RequestType<TextDocumentIdentifier, any, void>("kotlin/mainClass")
}
