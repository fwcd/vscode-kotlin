import * as vscode from "vscode";

export interface Status {
	/** Displays the status to the user. */
	show(): void;
	
	/** Updates the message. */
	update(msg: string): void;
	
	/** Disposes of this status. */
	dispose(): void;
}

/**
 * Encapsulates a status bar item.
 */
export class StatusBarEntry implements Status {
	private barItem: vscode.StatusBarItem;
	private prefix?: string;
	
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
		this.barItem.dispose();
	}
}
