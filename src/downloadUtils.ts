import * as request from "request";
import * as fs from "fs";

export function download(srcUrl: string, destPath: fs.PathLike): Promise<void> {
	return new Promise((resolve, reject) => {
		request.get(srcUrl, (err, res, body) => {
			if (err) reject(err);
		}).on("complete", () => resolve()).pipe(fs.createWriteStream(destPath));
	});
}
