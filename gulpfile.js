"use strict";
const gulp = require("gulp");
const download = require("gulp-download");
const decompress = require('gulp-decompress');

gulp.task("downloadLanguageServer", done => {
	download("https://github.com/fwcd/kotlin-language-server/releases/latest/download/server.zip")
		.pipe(decompress())
		.pipe(gulp.dest("resources"));
	done();
});

gulp.task("downloadGrammars", done => {
	download("https://github.com/fwcd/kotlin-language-server/releases/latest/download/grammars.zip")
		.pipe(decompress())
		.pipe(gulp.dest("resources/syntaxes"));
	done();
});
