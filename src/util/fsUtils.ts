import * as fs from "fs";

export async function fsExists(path: fs.PathLike): Promise<boolean> {
    try {
        await fs.promises.access(path);
        return true;
    } catch {
        return false;
    }
}
