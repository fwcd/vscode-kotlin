import * as fs from "fs";

export interface InternalConfig {
    initialized?: boolean;
}

export class InternalConfigManager {
    private filePath: string;
    private config: InternalConfig;
    
    private constructor(filePath: string, config: InternalConfig) {
        this.filePath = filePath;
        this.config = config;
    }
    
    static async loadingConfigFrom(filePath: string): Promise<InternalConfigManager> {
        return new InternalConfigManager(filePath, await loadConfigFrom(filePath));
    }
    
    getConfig(): InternalConfig { return this.config; }
    
    async updateConfig(changes: InternalConfig): Promise<void> {
        Object.assign(this.config, changes);
        await saveConfigTo(this.filePath, this.config);
    }
}

async function loadConfigFrom(filePath: string): Promise<InternalConfig> {
    try {
        return JSON.parse((await fs.promises.readFile(filePath)).toString("utf8")) as InternalConfig;
    } catch {
        return { initialized: false };
    }
}

async function saveConfigTo(filePath: string, config: InternalConfig): Promise<void> {
    await fs.promises.writeFile(filePath, JSON.stringify(config), { encoding: "utf8" });
}
