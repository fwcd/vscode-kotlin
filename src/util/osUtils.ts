export function isOSWindows(): boolean {
    return process.platform === "win32";
}

export function isOSUnixoid(): boolean {
    let platform = process.platform;
    return platform === "linux"
        || platform === "darwin"
        || platform === "freebsd"
        || platform === "openbsd";
}

export function correctBinname(binname: string): string {
    return binname + ((process.platform === 'win32') ? '.exe' : '');
}

export function correctScriptName(binname: string): string {
    return binname + ((process.platform === 'win32') ? '.bat' : '');
}
