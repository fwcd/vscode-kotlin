# Building
Describes how to build and run the extension.

## Development/Running
First run `npm run watch` in a background shell. The extension will then incrementally build in the background.

Every time you want to run the extension with the language server:
* Prepare the extension using `npm run prepare` (this automatically downloads the language server's binaries into the extension folder)
* Open the debug tab in VSCode
* Run the `Extension` launch configuration

## Debugging
Your can attach the running language server on `localhost:8000`. Note that this can be done using the `Attach Kotlin Language Server` launch configuration in VSCode (requires the [Java Debug Extension](https://marketplace.visualstudio.com/items?itemName=vscjava.vscode-java-debug)).

## Packaging
Run `npm run packageextension` from the repository's top-level-directory. The extension will then be located under the name `kotlin-[version].vsix`.
