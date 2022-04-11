import * as vscode from 'vscode';


export class RunDebugCodeLens implements vscode.CodeLensProvider {
    async provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.CodeLens[]> {
        const mainInfo = await vscode.commands.executeCommand("kotlin.resolveMain", document.uri.toString()) as MainInfo

        if(mainInfo && mainInfo.mainClass) {
            return [
                new vscode.CodeLens(
                    mainInfo.range,
                    {
                        title: "Run",
                        command: "kotlin.runMain",
                        arguments: [mainInfo.mainClass, mainInfo.projectRoot]
                    }
                ),
                new vscode.CodeLens(
                    mainInfo.range,
                    {
                        title: "Debug",
                        command: "kotlin.debugMain",
                        arguments: [mainInfo.mainClass, mainInfo.projectRoot]
                    }
                )
            ]
        }
        
        return []
    }
}

interface MainInfo {
    mainClass: String,
    projectRoot: String,
    range: vscode.Range
}
