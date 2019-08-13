import * as https from "https";
import * as fs from "fs";

/** Fetches a UTF-8-encoded string over HTTPS. */
export function httpsGet(options: string | https.RequestOptions): Promise<string> {
	return new Promise((resolve, reject) => {
		const request = https.get(options, res => {
			let data = "";
			res.on("data", chunk => data += chunk.toString("utf8"));
			res.on("end", () => resolve(data));
		});
		request.on("error", err => reject(err));
	});
}

/** Downloads a file over HTTPS. */
export function httpsDownload(src: string | https.RequestOptions, dest: fs.PathLike): Promise<void> {
	return new Promise((resolve, reject) => {
		const file = fs.createWriteStream(dest, { autoClose: false });
		const request = https.get(src, res => {
			res.pipe(file);
			file.on("finish", () => {
				file.on("close", () => resolve());
				file.close();
			});
		});
		request.on("error", err => {
			fs.unlink(dest, unlinkErr => console.error(unlinkErr));
			reject(err);
		});
	});
}
