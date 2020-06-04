// A small script to download the TextMate grammar
// for Kotlin at compile time (i.e. before packaging the extension)

const request = require("request");
const path = require("path");
const extractZip = require("extract-zip");
const fs = require("fs");

const GRAMMAR_URL = "https://github.com/fwcd/kotlin-language-server/releases/latest/download/grammars.zip";
const RESOURCES_PATH = path.join(__dirname, "..", "resources");
const DOWNLOAD_PATH = path.join(RESOURCES_PATH, "grammarsDownload.zip");
const EXTRACT_PATH = path.join(RESOURCES_PATH, "syntaxes");

console.log("Downloading grammars...");
request.get(GRAMMAR_URL)
	.on("complete", () => {
		console.log("Extracting grammars...");
		extractZip(DOWNLOAD_PATH, { dir: EXTRACT_PATH })
			.then(() => {
				console.log("Cleaning up downloaded zip...");
				fs.unlink(DOWNLOAD_PATH, err => {
					if (err) console.log(err);
				});
			})
			.catch(e => console.log(e));
	})
	.on("error", err => console.log(err))
	.pipe(fs.createWriteStream(DOWNLOAD_PATH));
