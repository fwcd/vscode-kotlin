import * as extractZipWithCallback from "extract-zip";
import * as path from "path";
import * as semver from "semver";
import * as requestPromise from "request-promise-native";
import { promisify } from "util";
import { fsExists, fsMkdir, fsReadFile, fsUnlink, fsWriteFile } from "./fsUtils";
import { GitHubReleasesAPIResponse } from "./githubApi";
import { LOG } from "./logger";
import { download } from "./downloadUtils";

const extractZip = promisify(extractZipWithCallback);

export interface ServerInfo {
	version: string;
	lastUpdate: number;
}

/**
 * Downloads language servers or debug adapters from GitHub releases.
 */
export class ServerDownloader {
	private githubProjectName: string;
	private assetName: string;
	private installDir: string;
	
	constructor(githubProjectName: string, assetName: string, installDir: string) {
		this.githubProjectName = githubProjectName;
		this.installDir = installDir;
		this.assetName = assetName;
	}
	
	private async latestReleaseInfo(): Promise<GitHubReleasesAPIResponse> {
		const rawJson = await requestPromise.get(`https://api.github.com/repos/fwcd/${this.githubProjectName}/releases/latest`, {
			headers: { "User-Agent": "vscode-kotlin-ide" }
		});
		return JSON.parse(rawJson) as GitHubReleasesAPIResponse;
	}
	
	private serverInfoFile(): string {
		return path.join(this.installDir, "SERVER-INFO");
	}
	
	private async installedServerInfo(): Promise<ServerInfo> {
		try {
			const info = JSON.parse((await fsReadFile(this.serverInfoFile())).toString("utf8")) as ServerInfo;
			return semver.valid(info.version) ? info : null;
		} catch {
			return null;
		}
	}
	
	private async updateInstalledServerInfo(info: ServerInfo): Promise<void> {
		await fsWriteFile(this.serverInfoFile(), JSON.stringify(info), { encoding: "utf8" });
	}
	
	private async downloadServer(downloadUrl: string, version: string, progressMessage: (msg: string) => void): Promise<void> {
		if (!(await fsExists(this.installDir))) {
			await fsMkdir(this.installDir, { recursive: true });
		}
		
		const downloadDest = path.join(this.installDir, `download-${this.assetName}`);
		progressMessage(`Downloading Kotlin Language Server ${version}...`);
		await download(downloadUrl, downloadDest, percent => {
			progressMessage(`Downloading Kotlin Language Server ${version}: ${percent * 100} %`);
		});
		
		progressMessage(`Unpacking Kotlin Language Server ${version}...`);
		await extractZip(downloadDest, { dir: this.installDir });
		await fsUnlink(downloadDest);
		
		progressMessage("Initializing Kotlin Language Server...");
	}
	
	async downloadServerIfNeeded(progressMessage: (msg: string) => void): Promise<void> {
		const serverInfo = (await this.installedServerInfo()) || { version: "0.0.0", lastUpdate: Number.MIN_SAFE_INTEGER };
		const secondsSinceLastUpdate = (Date.now() - serverInfo.lastUpdate) / 1000;
		
		if (secondsSinceLastUpdate > 480) {
			// Only query GitHub API for latest version if some time has passed
			LOG.info("Querying GitHub API for new KLS version...");
			
			const releaseInfo = await this.latestReleaseInfo();
			const latestVersion = releaseInfo.tag_name;
			const installedVersion = serverInfo.version;
			const serverNeedsUpdate = semver.gt(latestVersion, installedVersion);
			let newVersion = installedVersion;
			
			if (serverNeedsUpdate) {
				const serverAsset = releaseInfo.assets.find(asset => asset.name === this.assetName);
				if (serverAsset) {
					const downloadUrl = serverAsset.browser_download_url;
					await this.downloadServer(downloadUrl, latestVersion, msg => progressMessage(msg));
				} else {
					throw new Error(`Latest GitHub release for ${this.githubProjectName} does not contain the asset '${this.assetName}'!`);
				}
				newVersion = latestVersion;
			}
			
			await this.updateInstalledServerInfo({
				version: newVersion,
				lastUpdate: Date.now()
			});
		}
	}
}
