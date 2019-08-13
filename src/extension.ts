'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as child_process from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as vscode from 'vscode';
import { LanguageClient, LanguageClientOptions, RevealOutputChannelOn, ServerOptions } from "vscode-languageclient";
import { LOG } from './logger';
import { isOSUnixoid } from './osUtils';
import { ServerDownloader } from './serverDownloader';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext): Promise<void> {
    configureLanguage();

    const serverEnabled = vscode.workspace.getConfiguration("kotlin").get("languageServer.enabled");

    if (serverEnabled) {
        activateLanguageServer(context);
    } else {
        LOG.info("Skipping language server activation since 'kotlin.languageServer.enabled' is false");
    }
}

// this method is called when your extension is deactivated
export function deactivate(): void {}

async function activateLanguageServer(context: vscode.ExtensionContext) {
    LOG.info('Activating Kotlin Language Server...');
    
    const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    context.subscriptions.push(status);
    status.show();
    
    function updateStatusMessage(msg: string) {
        status.text = `$(sync~spin) ${msg}`
    }
    
    function cleanUp() {
        status.dispose();
    }
    
    updateStatusMessage("Activating Kotlin Language Server...");
    
    const resourcesDir = path.join(context.extensionPath, "resources")
    
    // Prepare language server
    const langServerInstallDir = path.join(resourcesDir, "langServerInstall");
    const langServerDownloader = new ServerDownloader("Kotlin Language Server", "kotlin-language-server", "server.zip", langServerInstallDir);
    try {
        await langServerDownloader.downloadServerIfNeeded(msg => updateStatusMessage(msg));
    } catch (error) {
        vscode.window.showErrorMessage(`Could not download language server: ${error}`);
        cleanUp();
        return;
    }
    
    updateStatusMessage("Initializing Kotlin Language Server...");
    const javaExecutablePath = findJavaExecutable('java');

    if (javaExecutablePath == null) {
        vscode.window.showErrorMessage("Couldn't locate java in $JAVA_HOME or $PATH");
        cleanUp();
        return;
    }

    // Options to control the language client
    let clientOptions: LanguageClientOptions = {
        // Register the server for Kotlin documents
        documentSelector: [{ language: 'kotlin', scheme: 'file' }],
        synchronize: {
            // Synchronize the setting section 'kotlin' to the server
            // NOTE: this currently doesn't do anything
            configurationSection: 'kotlin',
            // Notify the server about file changes to 'javaconfig.json' files contain in the workspace
            // TODO this should be registered from the language server side
            fileEvents: [
                vscode.workspace.createFileSystemWatcher('**/*.kt'),
                vscode.workspace.createFileSystemWatcher('**/*.kts'),
                vscode.workspace.createFileSystemWatcher('**/pom.xml'),
                vscode.workspace.createFileSystemWatcher('**/build.gradle'),
                vscode.workspace.createFileSystemWatcher('**/settings.gradle')
            ]
        },
        outputChannelName: 'Kotlin',
        revealOutputChannelOn: RevealOutputChannelOn.Never
    }
    let startScriptPath = path.resolve(langServerInstallDir, "server", "bin", correctScriptName("kotlin-language-server"))
    let args = [];

    // Ensure that start script can be executed
    if (isOSUnixoid()) {
        child_process.exec("chmod +x " + startScriptPath);
    }

    // Start the child java process
    let serverOptions: ServerOptions = {
        command: startScriptPath,
        args: args,
        options: { cwd: vscode.workspace.rootPath }
    }

    LOG.info("Launching {} with args {}", startScriptPath, args.join(' '));

    // Create the language client and start the client.
    let languageClient = new LanguageClient('kotlin', 'Kotlin Language Server', serverOptions, clientOptions);
    let languageClientDisposable = languageClient.start();

    await languageClient.onReady();
    // Push the disposable to the context's subscriptions so that the
    // client can be deactivated on extension deactivation
    context.subscriptions.push(languageClientDisposable);
    cleanUp();
}

function configureLanguage(): void {
    // Source: https://github.com/Microsoft/vscode/blob/9d611d4dfd5a4a101b5201b8c9e21af97f06e7a7/extensions/typescript/src/typescriptMain.ts#L186
    // License: https://github.com/Microsoft/vscode/blob/9d611d4dfd5a4a101b5201b8c9e21af97f06e7a7/extensions/typescript/OSSREADME.json
    vscode.languages.setLanguageConfiguration("kotlin", {
        indentationRules: {
            // ^(.*\*/)?\s*\}.*$
            decreaseIndentPattern: /^(.*\*\/)?\s*\}.*$/,
            // ^.*\{[^}"']*$
            increaseIndentPattern: /^.*\{[^}"']*$/
        },
        wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g,
        onEnterRules: [
            {
                // e.g. /** | */
                beforeText: /^\s*\/\*\*(?!\/)([^\*]|\*(?!\/))*$/,
                afterText: /^\s*\*\/$/,
                action: { indentAction: vscode.IndentAction.IndentOutdent, appendText: ' * ' }
            },
            {
                // e.g. /** ...|
                beforeText: /^\s*\/\*\*(?!\/)([^\*]|\*(?!\/))*$/,
                action: { indentAction: vscode.IndentAction.None, appendText: ' * ' }
            },
            {
                // e.g.  * ...|
                beforeText: /^(\t|(\ \ ))*\ \*(\ ([^\*]|\*(?!\/))*)?$/,
                action: { indentAction: vscode.IndentAction.None, appendText: '* ' }
            },
            {
                // e.g.  */|
                beforeText: /^(\t|(\ \ ))*\ \*\/\s*$/,
                action: { indentAction: vscode.IndentAction.None, removeText: 1 }
            },
            {
                // e.g.  *-----*/|
                beforeText: /^(\t|(\ \ ))*\ \*[^/]*\*\/\s*$/,
                action: { indentAction: vscode.IndentAction.None, removeText: 1 }
            }
        ]
    });
}

function findJavaExecutable(rawBinname: string): string {
	let binname = correctBinname(rawBinname);

	// First search java.home setting
    let userJavaHome = vscode.workspace.getConfiguration('java').get('home') as string;

	if (userJavaHome != null) {
        LOG.debug("Looking for Java in java.home (settings): {}", userJavaHome);

        let candidate = findJavaExecutableInJavaHome(userJavaHome, binname);

        if (candidate != null)
            return candidate;
	}

	// Then search each JAVA_HOME
    let envJavaHome = process.env['JAVA_HOME'];

	if (envJavaHome) {
        LOG.debug("Looking for Java in JAVA_HOME (environment variable): {}", envJavaHome);

        let candidate = findJavaExecutableInJavaHome(envJavaHome, binname);

        if (candidate != null)
            return candidate;
	}

	// Then search PATH parts
	if (process.env['PATH']) {
        LOG.debug("Looking for Java in PATH");

		let pathparts = process.env['PATH'].split(path.delimiter);
		for (let i = 0; i < pathparts.length; i++) {
			let binpath = path.join(pathparts[i], binname);
			if (fs.existsSync(binpath)) {
				return binpath;
			}
		}
	}

    // Else return the binary name directly (this will likely always fail downstream)
    LOG.debug("Could not find Java, will try using binary name directly");
	return binname;
}

function correctBinname(binname: string): string {
    return binname + ((process.platform === 'win32') ? '.exe' : '');
}

function correctScriptName(binname: string): string {
    return binname + ((process.platform === 'win32') ? '.bat' : '');
}

function findJavaExecutableInJavaHome(javaHome: string, binname: string): string {
    let workspaces = javaHome.split(path.delimiter);

    for (let i = 0; i < workspaces.length; i++) {
        let binpath = path.join(workspaces[i], 'bin', binname);

        if (fs.existsSync(binpath))
            return binpath;
    }
}
