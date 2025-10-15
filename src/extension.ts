import * as vscode from 'vscode';
import { ViewProvider } from './viewProvider';
import { CommandsProvider } from './commandsProvider';
import { MenusProvider } from './menusProvider';
import { ViewsContainersProvider } from './viewsContainersProvider';
import { KeybindingsProvider } from './keybindingsProvider';
import { showNotification, toggleNotifications } from './utils/notificationManager';

export function activate(context: vscode.ExtensionContext) {
	console.log('🚀 VEDH Extension activated!');

	// 显示激活通知（根据设置决定是否显示）
	showNotification('插件开发助手已激活');

	const rootPath = (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0)
		? vscode.workspace.workspaceFolders[0].uri.fsPath
		: undefined;

	// 注册切换通知命令
	const toggleNotificationsCommand = vscode.commands.registerCommand('vedh.toggleNotifications', toggleNotifications);
	context.subscriptions.push(toggleNotificationsCommand);

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

	// Keybindings TreeView
	const keybindingsProvider = new KeybindingsProvider(context, rootPath);
	vscode.window.createTreeView("vedh.keybindings", {
		treeDataProvider: keybindingsProvider,
		showCollapseAll: true,
		canSelectMany: false,
	});

	// 监听活动编辑器变化，当切换到 package.json 时刷新所有 treeview
	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor(editor => {
			if (editor && editor.document.fileName.endsWith('package.json')) {
				console.log('📝 Switched to package.json, refreshing all tree views');
				// 刷新所有 provider
				viewsContainersProvider.refresh();
				viewProvider.refresh();
				commandsProvider.refresh();
				menusProvider.refresh();
				keybindingsProvider.refresh();
			}
		})
	);

	// 监听 package.json 文件保存，自动刷新所有 treeview
	context.subscriptions.push(
		vscode.workspace.onDidSaveTextDocument(document => {
			if (document.fileName.endsWith('package.json')) {
				console.log('💾 package.json saved, refreshing all tree views');
				// 刷新所有 provider
				viewsContainersProvider.refresh();
				viewProvider.refresh();
				commandsProvider.refresh();
				menusProvider.refresh();
				keybindingsProvider.refresh();
			}
		})
	);
}

export function deactivate() {
	console.log('👋 VEDH Extension deactivated!');
}
