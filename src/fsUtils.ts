import * as fs from "fs";
import { promisify } from "util";

export const fsUnlink = promisify(fs.unlink);
export const fsExists = promisify(fs.exists);
export const fsMkdir = promisify(fs.mkdir);
export const fsReadFile = promisify(fs.readFile);
export const fsWriteFile = promisify(fs.writeFile);
