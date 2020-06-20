# Kotlin IDE for Visual Studio Code
Smart code completion, linting, debugging, formatting and more for Kotlin in VSCode using the [Kotlin language server](https://github.com/fwcd/kotlin-language-server) and the [Kotlin debug adapter](https://github.com/fwcd/kotlin-debug-adapter).

[![Version](https://img.shields.io/visual-studio-marketplace/v/fwcd.kotlin)](https://marketplace.visualstudio.com/items?itemName=fwcd.kotlin)
[![Build Status](https://travis-ci.org/fwcd/vscode-kotlin.svg?branch=master)](https://travis-ci.org/fwcd/vscode-kotlin)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/fwcd.kotlin)](https://marketplace.visualstudio.com/items?itemName=fwcd.kotlin)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/fwcd.kotlin)](https://marketplace.visualstudio.com/items?itemName=fwcd.kotlin)
[![Chat](https://img.shields.io/badge/chat-on%20discord-7289da)](https://discord.gg/cNtppzN)

To use, open a Kotlin file **inside a Gradle or Maven project**. Support for Kotlin source files with a standalone compiler (`kotlinc`) is experimental. The language server will then automatically launch in the background.

## Features
* Code completion
* Linting
* Debugging
* Go-to-definition
* Signature help
* Hover
* Formatting
* Document symbols
* Find references

## Usage

### Debugging
* Setup:
    * Open the `launch.json` file in your project and invoke code completion to create a new launch configuration (or select `Add Configuration...` in the debug tab)
* Launch:
    * Build your project (before every launch)
	* Click the `Run` button in the `Debug` tab or press `F5`
