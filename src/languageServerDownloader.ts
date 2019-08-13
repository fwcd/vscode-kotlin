import * as path from "path";
import * as semver from "semver";
import * as extractZipWithCallback from "extract-zip";
import { httpsGet, httpsDownload } from "./httpsUtils";
import { GitHubReleasesAPIResponse } from "./githubApi";
import { fsReadFile, fsWriteFile, fsExists, fsMkdir, fsUnlink } from "./fsUtils";
import { promisify } from "util";

const extractZip = promisify(extractZipWithCallback);
const KLS_DOWNLOAD_URL = "https://github.com/fwcd/kotlin-language-server/releases/latest/download/server.zip";

export interface ServerInfo {
	version: string;
	lastUpdate: number;
}

export async function latestServerVersion(): Promise<string> {
	const rawJson = await httpsGet({
		host: "api.github.com",
		path: "/repos/fwcd/kotlin-language-server/releases/latest",
		headers: { "User-Agent": "vscode-kotlin-ide" }
	});
	const result = JSON.parse(rawJson) as GitHubReleasesAPIResponse;
	return result.tag_name;
}

function serverInfoFile(installDir: string): string {
	return path.join(installDir, "SERVER-INFO");
}

export async function installedServerInfo(installDir: string): Promise<ServerInfo> {
	try {
		const info = JSON.parse((await fsReadFile(serverInfoFile(installDir))).toString("utf8")) as ServerInfo;
		return semver.valid(info.version) ? info : null;
	} catch {
		return null;
	}
}

export async function updateInstalledServerInfo(installDir: string, info: ServerInfo): Promise<void> {
	await fsWriteFile(serverInfoFile(installDir), JSON.stringify(info), { encoding: "utf8" });
}

export async function downloadServer(installDir: string, progressMessage: (msg: string) => void): Promise<void> {
	if (!(await fsExists(installDir))) {
		await fsMkdir(installDir, { recursive: true });
	}
	
	const installParentDir = path.join(installDir, "..");
	const downloadDest = path.join(installParentDir, "serverDownload.zip");
	progressMessage("Downloading Kotlin Language Server...");
	await httpsDownload(KLS_DOWNLOAD_URL, downloadDest);
	
	progressMessage("Unpacking Kotlin Language Server...");
	await extractZip(downloadDest, { dir: installDir });
	await fsUnlink(downloadDest);
	
	progressMessage("Initializing Kotlin Language Server...");
}
