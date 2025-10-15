import * as vscode from 'vscode';

export interface KeyCombination {
	ctrl?: boolean;
	alt?: boolean;
	shift?: boolean;
	meta?: boolean;
	key: string;
}

export class KeybindingRecorder {
	/**
	 * 记录用户的按键输入，返回格式化的快捷键字符串
	 */
	static async recordKeybinding(platform: 'key' | 'mac' = 'key'): Promise<string | undefined> {
		return new Promise((resolve) => {
			const inputBox = vscode.window.createInputBox();
			inputBox.title = platform === 'mac' ? '录制快捷键 (macOS)' : '录制快捷键 (Windows/Linux)';
			inputBox.prompt = '请按下您想要的快捷键组合...';
			inputBox.placeholder = '等待按键输入...';
			inputBox.ignoreFocusOut = true;
			inputBox.value = '';

			let keyCombination: KeyCombination | null = null;
			let pressedKeys = new Set<string>();
			let isRecording = false;

			// 显示当前按键状态
			const updateDisplay = () => {
				if (keyCombination) {
					const formatted = this.formatKeyCombination(keyCombination, platform);
					inputBox.value = formatted;
					inputBox.prompt = `已捕获: ${formatted} - 按 Enter 确认，Escape 取消`;
				} else {
					inputBox.value = '';
					inputBox.prompt = '请按下您想要的快捷键组合...';
				}
			};

			// 监听输入框变化
			const changeDisposable = inputBox.onDidChangeValue((value) => {
				// 如果用户手动清空，重置状态
				if (value === '') {
					keyCombination = null;
					pressedKeys.clear();
					updateDisplay();
				}
			});

			// 监听接受（Enter）
			const acceptDisposable = inputBox.onDidAccept(() => {
				if (keyCombination) {
					const result = this.formatKeyCombination(keyCombination, platform);
					inputBox.hide();
					resolve(result);
				}
			});

			// 监听隐藏
			const hideDisposable = inputBox.onDidHide(() => {
				changeDisposable.dispose();
				acceptDisposable.dispose();
				hideDisposable.dispose();
				resolve(undefined);
			});

			inputBox.show();

			// 使用 Webview 或原生方法来捕获按键
			// 由于 VSCode API 限制，我们使用一个更好的方法
			this.showKeyCaptureMessage(platform).then((result) => {
				if (result) {
					inputBox.value = result;
					resolve(result);
				}
				inputBox.hide();
			});
		});
	}

	/**
	 * 显示一个带有说明的快捷键捕获对话框
	 */
	private static async showKeyCaptureMessage(platform: 'key' | 'mac'): Promise<string | undefined> {
		const platformName = platform === 'mac' ? 'macOS' : 'Windows/Linux';
		const modifierKey = platform === 'mac' ? 'Cmd' : 'Ctrl';

		// 创建 QuickPick 来手动选择
		return await this.showManualKeybindingInput(platform);
	}

	/**
	 * 手动输入快捷键
	 */
	private static async showManualKeybindingInput(platform: 'key' | 'mac'): Promise<string | undefined> {
		const quickPick = vscode.window.createQuickPick();
		quickPick.title = platform === 'mac' ? '定义快捷键 (macOS)' : '定义快捷键 (Windows/Linux)';
		quickPick.placeholder = '输入快捷键，例如: ctrl+shift+p 或 cmd+k cmd+s';
		quickPick.canSelectMany = false;

		const commonKeybindings = this.getCommonKeybindings(platform);
		quickPick.items = [
			{ label: '$(keyboard) 手动输入', description: '输入自定义快捷键', detail: '例如: ctrl+shift+p' },
			{ label: '', kind: vscode.QuickPickItemKind.Separator },
			{ label: '常用快捷键示例', kind: vscode.QuickPickItemKind.Separator },
			...commonKeybindings
		];

		return new Promise((resolve) => {
			let userInput = '';

			quickPick.onDidChangeValue((value) => {
				userInput = value;
				if (value) {
					// 实时验证和格式化
					const formatted = this.normalizeKeybinding(value, platform);
					if (formatted && formatted !== value) {
						// 提供格式化建议
						quickPick.items = [
							{
								label: `$(check) ${formatted}`,
								description: '格式化后的快捷键',
								detail: '按 Enter 使用此快捷键'
							},
							{ label: '', kind: vscode.QuickPickItemKind.Separator },
							{ label: '$(keyboard) 手动输入', description: '输入自定义快捷键', detail: '例如: ctrl+shift+p' },
							{ label: '', kind: vscode.QuickPickItemKind.Separator },
							{ label: '常用快捷键示例', kind: vscode.QuickPickItemKind.Separator },
							...commonKeybindings
						];
					}
				} else {
					// 恢复默认列表
					quickPick.items = [
						{ label: '$(keyboard) 手动输入', description: '输入自定义快捷键', detail: '例如: ctrl+shift+p' },
						{ label: '', kind: vscode.QuickPickItemKind.Separator },
						{ label: '常用快捷键示例', kind: vscode.QuickPickItemKind.Separator },
						...commonKeybindings
					];
				}
			});

			quickPick.onDidChangeSelection((items) => {
				if (items.length > 0) {
					const selected = items[0];
					if (selected.label.startsWith('$(check)')) {
						// 使用格式化的快捷键
						const keybinding = selected.label.replace('$(check) ', '').trim();
						quickPick.hide();
						resolve(keybinding);
					} else if (!selected.label.startsWith('$(keyboard)') && selected.kind !== vscode.QuickPickItemKind.Separator) {
						// 使用示例快捷键
						quickPick.hide();
						resolve(selected.label);
					}
				}
			});

			quickPick.onDidAccept(() => {
				if (userInput) {
					const normalized = this.normalizeKeybinding(userInput, platform);
					quickPick.hide();
					resolve(normalized || userInput);
				} else if (quickPick.selectedItems.length > 0) {
					const selected = quickPick.selectedItems[0];
					if (!selected.label.startsWith('$(keyboard)') && selected.kind !== vscode.QuickPickItemKind.Separator) {
						quickPick.hide();
						resolve(selected.label);
					}
				}
			});

			quickPick.onDidHide(() => {
				resolve(undefined);
				quickPick.dispose();
			});

			quickPick.show();
		});
	}

	/**
	 * 格式化按键组合为 VSCode 快捷键字符串
	 */
	private static formatKeyCombination(combo: KeyCombination, platform: 'key' | 'mac'): string {
		const parts: string[] = [];

		if (platform === 'mac') {
			if (combo.meta) { parts.push('cmd'); }
			if (combo.ctrl) { parts.push('ctrl'); }
			if (combo.shift) { parts.push('shift'); }
			if (combo.alt) { parts.push('alt'); }
		} else {
			if (combo.ctrl) { parts.push('ctrl'); }
			if (combo.shift) { parts.push('shift'); }
			if (combo.alt) { parts.push('alt'); }
			if (combo.meta) { parts.push('meta'); }
		}

		// 添加主键
		if (combo.key) {
			parts.push(combo.key.toLowerCase());
		}

		return parts.join('+');
	}

	/**
	 * 规范化快捷键字符串
	 */
	private static normalizeKeybinding(input: string, platform: 'key' | 'mac'): string | null {
		try {
			// 分割多段快捷键（例如 "ctrl+k ctrl+s"）
			const chords = input.toLowerCase().trim().split(/\s+/);
			const normalizedChords = chords.map(chord => {
				const parts = chord.split('+').map(p => p.trim()).filter(p => p);

				// 排序修饰键
				const modifiers: string[] = [];
				let mainKey = '';

				for (const part of parts) {
					if (platform === 'mac') {
						if (part === 'cmd' || part === 'command' || part === 'meta') {
							modifiers.push('cmd');
						} else if (part === 'ctrl' || part === 'control') {
							modifiers.push('ctrl');
						} else if (part === 'shift') {
							modifiers.push('shift');
						} else if (part === 'alt' || part === 'option') {
							modifiers.push('alt');
						} else {
							mainKey = part;
						}
					} else {
						if (part === 'ctrl' || part === 'control') {
							modifiers.push('ctrl');
						} else if (part === 'shift') {
							modifiers.push('shift');
						} else if (part === 'alt') {
							modifiers.push('alt');
						} else if (part === 'meta' || part === 'win' || part === 'windows') {
							modifiers.push('meta');
						} else {
							mainKey = part;
						}
					}
				}

				// 去重并排序
				const uniqueModifiers = [...new Set(modifiers)];

				// VSCode 的修饰键顺序
				const order = platform === 'mac'
					? ['cmd', 'ctrl', 'shift', 'alt']
					: ['ctrl', 'shift', 'alt', 'meta'];

				const sortedModifiers = order.filter(m => uniqueModifiers.includes(m));

				if (mainKey) {
					return [...sortedModifiers, mainKey].join('+');
				}
				return sortedModifiers.join('+');
			});

			return normalizedChords.join(' ');
		} catch (error) {
			return null;
		}
	}

	/**
	 * 获取常用快捷键示例
	 */
	private static getCommonKeybindings(platform: 'key' | 'mac'): vscode.QuickPickItem[] {
		if (platform === 'mac') {
			return [
				{ label: 'cmd+shift+p', description: 'Command Palette' },
				{ label: 'cmd+p', description: 'Quick Open' },
				{ label: 'cmd+k cmd+s', description: 'Keyboard Shortcuts (chord)' },
				{ label: 'cmd+b', description: 'Toggle Sidebar' },
				{ label: 'cmd+shift+f', description: 'Search' },
				{ label: 'cmd+/', description: 'Toggle Comment' },
				{ label: 'cmd+d', description: 'Add Selection To Next Find Match' },
				{ label: 'cmd+shift+l', description: 'Select All Occurrences' },
				{ label: 'cmd+enter', description: 'Insert Line Below' },
				{ label: 'cmd+shift+enter', description: 'Insert Line Above' },
			];
		} else {
			return [
				{ label: 'ctrl+shift+p', description: 'Command Palette' },
				{ label: 'ctrl+p', description: 'Quick Open' },
				{ label: 'ctrl+k ctrl+s', description: 'Keyboard Shortcuts (chord)' },
				{ label: 'ctrl+b', description: 'Toggle Sidebar' },
				{ label: 'ctrl+shift+f', description: 'Search' },
				{ label: 'ctrl+/', description: 'Toggle Comment' },
				{ label: 'ctrl+d', description: 'Add Selection To Next Find Match' },
				{ label: 'ctrl+shift+l', description: 'Select All Occurrences' },
				{ label: 'ctrl+enter', description: 'Insert Line Below' },
				{ label: 'ctrl+shift+enter', description: 'Insert Line Above' },
			];
		}
	}

	/**
	 * 验证快捷键格式
	 */
	static validateKeybinding(keybinding: string): { valid: boolean; message?: string } {
		if (!keybinding || keybinding.trim() === '') {
			return { valid: false, message: '快捷键不能为空' };
		}

		const chords = keybinding.toLowerCase().split(/\s+/);

		for (const chord of chords) {
			const parts = chord.split('+');

			// 至少需要一个键
			if (parts.length === 0) {
				return { valid: false, message: '快捷键格式无效' };
			}

			// 检查是否只有修饰键
			const hasMainKey = parts.some(p =>
				!['ctrl', 'shift', 'alt', 'meta', 'cmd', 'command', 'option', 'control', 'win', 'windows'].includes(p)
			);

			if (!hasMainKey && parts.length > 0) {
				return { valid: false, message: '快捷键必须包含一个主键（非修饰键）' };
			}
		}

		return { valid: true };
	}
}
