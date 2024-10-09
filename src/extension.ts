// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { ViewProvider } from './viewProvider';
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	vscode.workspace.fs.readDirectory(vscode.Uri.file(__dirname)).then((files) => {
		const pathA = files.map(file => file[0]).join(', ');
		// new ViewProvider(context, pathA);
	});

	const rootPath = (vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 0))
		? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;
	const a = new ViewProvider(context, rootPath);
	const view = vscode.window.createTreeView("vedh.views", {
		treeDataProvider: a,
		showCollapseAll: true,
		canSelectMany: true,
	});
}

// This method is called when your extension is deactivated
export function deactivate() { }
