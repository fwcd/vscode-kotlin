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

function colorizeKotlin(tree: wts.Tree, visibleRanges: { start: number, end: number }[]): { [scope: string]: wts.SyntaxNode[] } {
    let colors: { [scope: string]: wts.SyntaxNode[] } = {};

    function add(scope: string, node: wts.SyntaxNode): void {
        if (!colors[scope]) {
            colors[scope] = [];
        }
        colors[scope]!.push(node);
    }

    for (const node of treeNodes(tree.rootNode)) {
        // Partly ported over from https://github.com/fwcd/atom-ide-kotlin/blob/master/grammars/tree-sitter-kotlin.cson

        switch (node.type) {
        case "simple_identifier":
            switch (node.parent.type) {
            case "type_identifier":
                add("entity.name.type.kotlin", node);
                break;
            case "function_declaration":
            case "call_expression":
            case "infix_expression":
                add("entity.name.function.kotlin", node);
                break;
            case "variable_declaration":
                add("variable.kotlin", node);
                break;
            case "parameter":
                add("variable.parameter.kotlin", node);
                break;
            default:
                break;
            }
            break;
        case "comment":
            add("comment.kotlin", node);
            break;
        case "this_expression":
        case "boolean_literal":
        case '"null"':
            add("constant.language", node);
            break;
        case "line_string_literal":
        case "multi_line_string_literal":
            add("string", node);
            break;
        case "interpolated_expression":
            add("source.kotlin.embedded", node);
            break;
        case "interpolated_identifier":
            add("entity.name", node);
            break;
        case "annotation":
            add("meta.annotation", node);
            break;
        default:
            break;
        }
    }

    return colors;
}

function* treeNodes(node: wts.SyntaxNode): Generator<wts.SyntaxNode> {
    const count = node.childCount;
    for (let i = 0; i < count; i++) {
        const child = node.child(i);
        yield child;
        yield* treeNodes(child);
    }
}
