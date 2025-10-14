import * as vscode from 'vscode';
import { ViewProvider } from './viewProvider';
import { CommandsProvider } from './commandsProvider';
import { MenusProvider } from './menusProvider';
import { ViewsContainersProvider } from './viewsContainersProvider';

export function activate(context: vscode.ExtensionContext) {
	const rootPath = (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0)
		? vscode.workspace.workspaceFolders[0].uri.fsPath
		: undefined;

	// ViewsContainers TreeView
	const viewsContainersProvider = new ViewsContainersProvider(context, rootPath);
	vscode.window.createTreeView("vedh.viewsContainers", {
		treeDataProvider: viewsContainersProvider,
		showCollapseAll: true,
		canSelectMany: false,
	});

	// Views TreeView
	const viewProvider = new ViewProvider(context, rootPath);
	vscode.window.createTreeView("vedh.views", {
		treeDataProvider: viewProvider,
		showCollapseAll: true,
		canSelectMany: true,
	});

	// Commands TreeView
	const commandsProvider = new CommandsProvider(context, rootPath);
	vscode.window.createTreeView("vedh.commands", {
		treeDataProvider: commandsProvider,
		showCollapseAll: true,
		canSelectMany: false,
	});

	// Menus TreeView
	const menusProvider = new MenusProvider(context, rootPath);
	vscode.window.createTreeView("vedh.menus", {
		treeDataProvider: menusProvider,
		showCollapseAll: true,
		canSelectMany: false,
	});
}

export function deactivate() { }
