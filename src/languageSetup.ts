import * as child_process from "child_process";
import * as net from "net";
import * as path from "path";
import * as vscode from 'vscode';
import { LanguageClient, LanguageClientOptions, RevealOutputChannelOn, ServerOptions, StreamInfo } from "vscode-languageclient/node";
import { LOG } from './util/logger';
import { isOSUnixoid, correctScriptName } from './util/osUtils';
import { ServerDownloader } from './serverDownloader';
import { Status } from "./util/status";
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

    const outputChannel = vscode.window.createOutputChannel("Kotlin");
    context.subscriptions.push(outputChannel);
    
    const transportLayer = config.get("languageServer.transport");
    let tcpPort: number = null;
    let env: any = undefined;

    if (transportLayer == "tcp") {
        tcpPort = config.get("languageServer.port");
        
        LOG.info(`Connecting via TCP, port: ${tcpPort}`);
    } else if (transportLayer == "stdio") {
        LOG.info("Connecting via Stdio.");

        if (config.get("languageServer.debugAttach.enabled")) {
            const autoSuspend = config.get("languageServer.debugAttach.autoSuspend");
            const attachPort = config.get("languageServer.debugAttach.port");
            env = {
                KOTLIN_LANGUAGE_SERVER_OPTS: `-Xdebug -agentlib:jdwp=transport=dt_socket,address=${attachPort},server=y,quiet=y,suspend=${autoSuspend ? "y" : "n"}`
            };
        }
    } else {
        LOG.info(`Unknown transport layer: ${transportLayer}`);
    }

    status.dispose();
    
    const startScriptPath = customPath || path.resolve(langServerInstallDir, "server", "bin", correctScriptName("kotlin-language-server"));

    const storagePath = context.storageUri.fsPath
    if (!(await fsExists(storagePath))) {
        await fs.promises.mkdir(storagePath);
    }

    const options = { outputChannel, startScriptPath, tcpPort, env, storagePath };
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
    tcpPort?: number,
    env?: any,
    storagePath: string
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
                vscode.workspace.createFileSystemWatcher('**/*.java'),
                vscode.workspace.createFileSystemWatcher('**/pom.xml'),
                vscode.workspace.createFileSystemWatcher('**/build.gradle'),
                vscode.workspace.createFileSystemWatcher('**/settings.gradle')
            ]
        },
        progressOnInitialization: true,
        outputChannel: options.outputChannel,
        revealOutputChannelOn: RevealOutputChannelOn.Never,
        initializationOptions: {
            storagePath: options.storagePath
        }
    }
    
    // Ensure that start script can be executed
    if (isOSUnixoid()) {
        child_process.exec(`chmod +x ${options.startScriptPath}`);
    }

    // Start the child Java process
    let serverOptions: ServerOptions;
    
    if (options.tcpPort) {
        serverOptions = () => spawnLanguageServerProcessAndConnectViaTcp(options);
    } else {
        serverOptions = {
            command: options.startScriptPath,
            args: [],
            options: {
                cwd: vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath,
                env: options.env
            } // TODO: Support multi-root workspaces (and improve support for when no available is available)
        }
        LOG.info("Creating client at {}", options.startScriptPath);
    }

    return new LanguageClient("kotlin", "Kotlin Language Client", serverOptions, clientOptions);
}

export function spawnLanguageServerProcessAndConnectViaTcp(options: {
    outputChannel: vscode.OutputChannel,
    startScriptPath: string,
    tcpPort?: number
}): Promise<StreamInfo> {
    return new Promise((resolve, reject) => {
        LOG.info("Creating server.")
        const server = net.createServer(socket => {
            LOG.info("Closing server since client has connected.");
            server.close();
            resolve({ reader: socket, writer: socket });
        });
        // Wait for the first client to connect
        server.listen(options.tcpPort, () => {
            const tcpPort = (server.address() as net.AddressInfo).port.toString();
            const proc = child_process.spawn(options.startScriptPath, ["--tcpClientPort", tcpPort]);
            LOG.info("Creating client at {} via TCP port {}", options.startScriptPath, tcpPort);
            
            const outputCallback = data => options.outputChannel.append(`${data}`);
            proc.stdout.on("data", outputCallback);
            proc.stderr.on("data", outputCallback);
            proc.on("exit", (code, sig) => options.outputChannel.appendLine(`The language server exited, code: ${code}, signal: ${sig}`))
        });
        server.on("error", e => reject(e));
    });
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
