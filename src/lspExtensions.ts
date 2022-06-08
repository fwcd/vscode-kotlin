import { RequestType0, RequestType } from "vscode-jsonrpc";
import { TextDocumentIdentifier } from "vscode-languageclient";
import { LanguageClient } from "vscode-languageclient/node";

export namespace JarClassContentsRequest {
    export const type = new RequestType<TextDocumentIdentifier, string, void>("kotlin/jarClassContents");
}

export namespace MainClassRequest {
    export const type = new RequestType<TextDocumentIdentifier, any, void>("kotlin/mainClass")
}

export namespace BuildOutputLocationRequest {
    export const type = new RequestType0<string, void>("kotlin/buildOutputLocation");
}

export class KotlinApi {
    private client: LanguageClient;

    constructor(client: LanguageClient) {
        this.client = client;
    }

    async getBuildOutputLocation(): Promise<string> {
        return await this.client.sendRequest(BuildOutputLocationRequest.type);
    }
}
