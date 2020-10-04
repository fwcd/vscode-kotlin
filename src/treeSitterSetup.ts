import * as path from 'path';
import * as vscode from 'vscode';
import * as ts from "vscode-tree-sitter";
import * as wts from "web-tree-sitter";
import { fsExists } from './util/fsUtils';
import { Status } from './util/status';

export async function activateTreeSitter(context: vscode.ExtensionContext, status: Status, config: vscode.WorkspaceConfiguration): Promise<void> {
    const parserPath: string = config.get("treeSitter.path") ?? path.join(context.extensionPath, "parsers", "tree-sitter-kotlin.wasm");

    if (!(await fsExists(parserPath))) {
        vscode.window.showWarningMessage("Could not initialize Tree-Sitter syntax highlighter for Kotlin.");
        return;
    }

    // Based on https://github.com/microsoft/vscode-go/pull/2555

    context.subscriptions.push(vscode.window.onDidChangeTextEditorVisibleRanges(event => colorize(event.textEditor)));
    context.subscriptions.push(vscode.window.onDidChangeVisibleTextEditors(colorizeAll));
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(colorizeEdited));
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration("workbench.colorTheme") || event.affectsConfiguration("editor.tokenColorCustomizations")) {
            colorizeAll();
        }
    }));
}

function colorizeEdited(event: vscode.TextDocumentChangeEvent): void {
    colorizeAll(vscode.window.visibleTextEditors.filter(editor =>
        editor.document.uri.toString() === event.document.uri.toString()
    ));
}

function colorizeAll(editors: vscode.TextEditor[] = vscode.window.visibleTextEditors): void {
    for (const editor of editors) {
        colorize(editor);
    }
}

function colorize(editor: vscode.TextEditor): void {
    try {
        if (editor.document.languageId !== "kotlin") return;

        const visibleRanges = editor.visibleRanges.map(range => ({ start: range.start.line, end: range.end.line }));
        const tree = ts.tree(editor.document.uri);
        if (!tree) {
            console.warn(`Could not parse ${editor.document.uri}`);
            return;
        }

        const colors = colorizeKotlin(tree, visibleRanges);

        for (const scope of Object.keys(colors)) {
            const decoration = ts.decoration(scope);
            const ranges = colors[scope]?.map(ts.range);
            if (decoration) {
                editor.setDecorations(decoration, ranges);
            }
        }
    } catch (e) {
        console.error(e);
    }
}

function colorizeKotlin(root: wts.Tree, visibleRanges: { start: number, end: number }[]): { [scope: string]: wts.SyntaxNode[] } {
    let colors: { [scope: string]: wts.SyntaxNode[] } = {};
    for (const cursor of treeNodes(root)) {
        // TODO
    }
    return colors;
}

function* treeNodes(root: wts.Tree): Generator<wts.TreeCursor> {
    const cursor = root.walk();
    let visitedChildren = false;
    while (true) {
        if (visitedChildren) {
            if (cursor.gotoNextSibling()) {
                visitedChildren = false;
                yield cursor;
            } else if (!cursor.gotoParent()) {
                break;
            }
        } else {
            if (cursor.gotoFirstChild()) {
                visitedChildren = false;
                yield cursor;
            } else {
                visitedChildren = true;
            }
        }
    }
}
