import * as vscode from 'vscode';

/**
 * 显示信息通知（根据设置决定是否显示）
 * @param message 要显示的消息
 */
export function showNotification(message: string): void {
	const config = vscode.workspace.getConfiguration('vedh');
	const showNotifications = config.get<boolean>('showNotifications', true);

	if (showNotifications) {
		vscode.window.showInformationMessage(message);
	}
}

/**
 * 切换信息提示的开启/暂停状态
 */
export async function toggleNotifications(): Promise<void> {
	const config = vscode.workspace.getConfiguration('vedh');
	const currentValue = config.get<boolean>('showNotifications', true);
	const newValue = !currentValue;

	await config.update('showNotifications', newValue, vscode.ConfigurationTarget.Global);
	const status = newValue ? '已开启' : '已暂停';
	// 这个通知始终显示，用于反馈切换结果
	vscode.window.showInformationMessage(`信息提示${status}`);
}
