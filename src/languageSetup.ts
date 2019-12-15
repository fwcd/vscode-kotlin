import * as child_process from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as vscode from 'vscode';
import { LanguageClient, LanguageClientOptions, RevealOutputChannelOn, ServerOptions, TransportKind, Transport } from "vscode-languageclient";
import { LOG } from './util/logger';
import { isOSUnixoid, correctBinname, correctScriptName } from './util/osUtils';
import { ServerDownloader } from './serverDownloader';
import { Status } from "./util/status";
import { fsExists } from "./util/fsUtils";
import { JarClassContentProvider } from "./jarClassContentProvider";

/** Downloads and starts the language server. */
export async function activateLanguageServer(context: vscode.ExtensionContext, status: Status, config: vscode.WorkspaceConfiguration) {
    LOG.info('Activating Kotlin Language Server...');
    status.update("Activating Kotlin Language Server...");
    
    // Prepare language server
    const langServerInstallDir = path.join(context.globalStoragePath, "langServerInstall");
    const customPath: string = config.get("languageServer.path");
    
    if (!customPath) {
        const langServerDownloader = new ServerDownloader("Kotlin Language Server", "kotlin-language-server", "server.zip", langServerInstallDir);
        
        try {
            await langServerDownloader.downloadServerIfNeeded(status);
        } catch (error) {
			console.error(error);
            vscode.window.showWarningMessage(`Could not update/download Kotlin Language Server: ${error}`);
            return;
        }
    }
    
    const javaExecutablePath = await findJavaExecutable('java');

    if (javaExecutablePath == null) {
        vscode.window.showErrorMessage("Couldn't locate java in $JAVA_HOME or $PATH");
        return;
    }

    const outputChannel = vscode.window.createOutputChannel("Kotlin");
    context.subscriptions.push(outputChannel);
    
    const transportLayer = config.get("languageServer.transport");
    let transport: Transport;
    let args: string[] = [];
    let initStatusSuffix: string = "";

    if (transportLayer == "tcp") {
        const tcpPort: number = config.get("languageServer.port");

        transport = { kind: TransportKind.socket, port: tcpPort };
        initStatusSuffix = ` via port ${tcpPort}`;
        args = ["--tcpClientPort", tcpPort.toString()];
        
        LOG.info(`Connecting via TCP, port: ${tcpPort}`);
    } else if (transportLayer == "stdio") {
        transport = TransportKind.stdio;

        LOG.info("Connecting via Stdio.");
    } else {
        LOG.info(`Unknown transport layer: ${transportLayer}`);
    }
    
    status.update(`Initializing Kotlin Language Server${initStatusSuffix}...`);

    const startScriptPath = customPath || path.resolve(langServerInstallDir, "server", "bin", correctScriptName("kotlin-language-server"));
    const options = { outputChannel, startScriptPath, args, transport };
    const languageClient = createLanguageClient(options);

    // Create the language client and start the client.
    let languageClientDisposable = languageClient.start();
    context.subscriptions.push(languageClientDisposable);
    
    // Register a content provider for the 'kls' scheme
    const contentProvider = new JarClassContentProvider(languageClient);
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider("kls", contentProvider));
    context.subscriptions.push(vscode.commands.registerCommand("kotlin.languageServer.restart", async () => {
        await languageClient.stop();
        languageClientDisposable.dispose();

        outputChannel.appendLine("");
        outputChannel.appendLine(" === Language Server Restart ===")
        outputChannel.appendLine("");

        languageClientDisposable = languageClient.start();
        context.subscriptions.push(languageClientDisposable);
    }));

    await languageClient.onReady();
}

function createLanguageClient(options: {
    outputChannel: vscode.OutputChannel,
    startScriptPath: string,
    args: string[],
    transport: Transport
}): LanguageClient {
    // Options to control the language client
    const clientOptions: LanguageClientOptions = {
        // Register the server for Kotlin documents
        documentSelector: [
            { language: 'kotlin', scheme: 'file' },
            { language: 'kotlin', scheme: 'kls' }
        ],
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
        outputChannel: options.outputChannel,
        revealOutputChannelOn: RevealOutputChannelOn.Never
    }
    
    // Ensure that start script can be executed
    if (isOSUnixoid()) {
        child_process.exec(`chmod +x ${options.startScriptPath}`);
    }

    // Start the child java process
    const serverOptions: ServerOptions = {
        command: options.startScriptPath,
        args: options.args,
        options: { cwd: vscode.workspace.rootPath },
        transport: options.transport
    };

    LOG.info("Creating client {} with args {}", options.startScriptPath, options.args.join(' '));
    return new LanguageClient("kotlin", "Kotlin Language Server", serverOptions, clientOptions);
}

export function configureLanguage(): void {
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

async function findJavaExecutable(rawBinname: string): Promise<string> {
	let binname = correctBinname(rawBinname);

	// First search java.home setting
    let userJavaHome = vscode.workspace.getConfiguration('java').get('home') as string;

	if (userJavaHome != null) {
        LOG.debug("Looking for Java in java.home (settings): {}", userJavaHome);

        let candidate = await findJavaExecutableInJavaHome(userJavaHome, binname);

        if (candidate != null)
            return candidate;
	}

	// Then search each JAVA_HOME
    let envJavaHome = process.env['JAVA_HOME'];

	if (envJavaHome) {
        LOG.debug("Looking for Java in JAVA_HOME (environment variable): {}", envJavaHome);

        let candidate = await findJavaExecutableInJavaHome(envJavaHome, binname);

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

async function findJavaExecutableInJavaHome(javaHome: string, binname: string): Promise<string> {
    let workspaces = javaHome.split(path.delimiter);

    for (let i = 0; i < workspaces.length; i++) {
        let binpath = path.join(workspaces[i], 'bin', binname);

        if (await fsExists(binpath))
            return binpath;
	}
	
	return null;
}
