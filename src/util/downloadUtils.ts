import * as request from "request";
import * as fs from "fs";

const requestProgress = require("request-progress");

export function download(srcUrl: string, destPath: fs.PathLike, progress: (percent: number) => void): Promise<void> {
    return new Promise((resolve, reject) => {
        requestProgress(request.get(srcUrl))
            .on("progress", state => progress(state.percent))
            .on("complete", () => resolve())
            .on("error", err => reject(err))
            .pipe(fs.createWriteStream(destPath));
    });
}
