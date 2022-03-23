import { RequestType } from "vscode-jsonrpc";
import { TextDocumentIdentifier } from "vscode-languageclient";
import { LanguageClient } from "vscode-languageclient/node";
import { KotlinApi } from "./languageSetup";

export namespace JarClassContentsRequest {
    export const type = new RequestType<TextDocumentIdentifier, string, void>("kotlin/jarClassContents");
}

export function setupCustomClientRequests(languageClient: LanguageClient, kotlinApi: KotlinApi) {
    languageClient.onNotification("kotlin/buildOutputLocationSet", (buildOutputLocation: string) => kotlinApi.buildOutputLocation = buildOutputLocation);
}
