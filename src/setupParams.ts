import * as vscode from "vscode";
import { JavaInstallation } from "./javaSetup";
import { Status } from "./util/status";

export interface ServerSetupParams {
    context: vscode.ExtensionContext;
    status: Status;
    config: vscode.WorkspaceConfiguration;
    javaInstallation: JavaInstallation;
    javaOpts: string;
    outputChannel: vscode.OutputChannel;
}
