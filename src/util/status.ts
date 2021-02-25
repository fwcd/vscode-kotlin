import * as vscode from "vscode";

export interface Status {
    /** Updates the message. */
    update(msg: string): void;

    dispose(): void;
}

/**
 * Encapsulates a status bar item.
 */
export class StatusBarEntry implements Status {
    private barItem: vscode.StatusBarItem;
    private prefix?: string;
    private disposed: boolean = false;
    
    constructor(context: vscode.ExtensionContext, prefix?: string) {
        this.prefix = prefix;
        this.barItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        context.subscriptions.push(this.barItem);
    }
    
    show(): void {
        this.barItem.show();
    }
    
    update(msg: string): void {
        this.barItem.text = `${this.prefix} ${msg}`;
    }
    
    dispose(): void {
        if (!this.disposed) {
            this.disposed = true;
            this.barItem.dispose();
        }
    }
}
