import * as vscode from 'vscode';
import * as fs from "fs";
import * as path from "path";
import { correctBinname } from './util/osUtils';
import { fsExists } from "./util/fsUtils";
import { LOG } from './util/logger';

export async function verifyJavaIsAvailable(): Promise<boolean> {
    let javaExecutablePath: string;

    try {
        javaExecutablePath = await findJavaExecutable('java');
    } catch (error) {
        console.error(error);
        vscode.window.showErrorMessage(`Could not locate Java: ${error}`)
        return false;
    }

    if (javaExecutablePath == null) {
        vscode.window.showErrorMessage("Couldn't locate java in $JAVA_HOME or $PATH");
        return false;
    }

    if (javaExecutablePath)

    return true;
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
