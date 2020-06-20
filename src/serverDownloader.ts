import extractZip from "extract-zip";
import * as path from "path";
import * as semver from "semver";
import * as requestPromise from "request-promise-native";
import * as fs from "fs";
import { fsExists } from "./util/fsUtils";
import { GitHubReleasesAPIResponse } from "./githubApi";
import { LOG } from "./util/logger";
import { download } from "./util/downloadUtils";
import { Status } from "./util/status";

export interface ServerInfo {
    version: string;
    lastUpdate: number;
}

/**
 * Downloads language servers or debug adapters from GitHub releases.
 * The downloaded automatically manages versioning and downloads
 * updates if necessary.
 */
export class ServerDownloader {
    private displayName: string;
    private githubProjectName: string;
    private assetName: string;
    private installDir: string;
    
    constructor(displayName: string, githubProjectName: string, assetName: string, installDir: string) {
        this.displayName = displayName;
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
            const info = JSON.parse((await fs.promises.readFile(this.serverInfoFile())).toString("utf8")) as ServerInfo;
            return semver.valid(info.version) ? info : null;
        } catch {
            return null;
        }
    }
    
    private async updateInstalledServerInfo(info: ServerInfo): Promise<void> {
        await fs.promises.writeFile(this.serverInfoFile(), JSON.stringify(info), { encoding: "utf8" });
    }
    
    private async downloadServer(downloadUrl: string, version: string, status: Status): Promise<void> {
        if (!(await fsExists(this.installDir))) {
            await fs.promises.mkdir(this.installDir, { recursive: true });
        }
        
        const downloadDest = path.join(this.installDir, `download-${this.assetName}`);
        status.update(`Downloading ${this.displayName} ${version}...`);
        await download(downloadUrl, downloadDest, percent => {
            status.update(`Downloading ${this.displayName} ${version} :: ${(percent * 100).toFixed(2)} %`);
        });
        
        status.update(`Unpacking ${this.displayName} ${version}...`);
        await extractZip(downloadDest, { dir: this.installDir });
        await fs.promises.unlink(downloadDest);
        
        status.update(`Initializing ${this.displayName}...`);
    }
    
    async downloadServerIfNeeded(status: Status): Promise<void> {
        const serverInfo = await this.installedServerInfo();
        const serverInfoOrDefault = serverInfo || { version: "0.0.0", lastUpdate: Number.MIN_SAFE_INTEGER };
        const secondsSinceLastUpdate = (Date.now() - serverInfoOrDefault.lastUpdate) / 1000;
        
        if (secondsSinceLastUpdate > 480) {
            // Only query GitHub API for latest version if some time has passed
            LOG.info(`Querying GitHub API for new ${this.displayName} version...`);
            
            let releaseInfo: GitHubReleasesAPIResponse;
            
            try {
                releaseInfo = await this.latestReleaseInfo();
            } catch (error) {
                const message = `Could not fetch from GitHub releases API: ${error}.`;
                if (serverInfo == null) {
                    // No server is installed yet, so throw
                    throw new Error(message);
                } else {
                    // Do not throw since user might just be offline
                    // and a version of the server is already installed
                    LOG.warn(message);
                    return;
                }
            }
            
            const latestVersion = releaseInfo.tag_name;
            const installedVersion = serverInfoOrDefault.version;
            const serverNeedsUpdate = semver.gt(latestVersion, installedVersion);
            let newVersion = installedVersion;
            
            if (serverNeedsUpdate) {
                const serverAsset = releaseInfo.assets.find(asset => asset.name === this.assetName);
                if (serverAsset) {
                    const downloadUrl = serverAsset.browser_download_url;
                    await this.downloadServer(downloadUrl, latestVersion, status);
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
