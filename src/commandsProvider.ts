import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { IconManager, COMMON_ICONS } from './iconManager';
import { CodeNavigator } from './utils/codeNavigator';
import { showNotification } from './utils/notificationManager';

export class CommandsProvider implements vscode.TreeDataProvider<CommandNode> {

  pkgPath: string | undefined;
  pkgJson: any = undefined;
  hasPackageJson: boolean = false;
  private iconManager: IconManager;

  constructor(
    public context: vscode.ExtensionContext,
    public readonly currentPath: string | undefined
  ) {
    this.iconManager = new IconManager(context.extensionPath);
    if (currentPath) {
      this.pkgPath = path.join(currentPath, "package.json");

      if (this.fileExist(this.pkgPath)) {
        console.log("Package.json found: ", this.pkgPath);
        this.hasPackageJson = true;
        this.parsePackageJson(this.pkgPath);
      } else {
        console.log("Package.json not found");
        this.hasPackageJson = false;
      }
    }

    // 注册编辑命令
    context.subscriptions.push(
      vscode.commands.registerCommand('vedh.commands.edit', (node: CommandNode) => {
        this.editCommand(node);
      })
    );

    // 注册刷新命令
    context.subscriptions.push(
      vscode.commands.registerCommand('vedh.commands.refresh', () => {
        this.refresh();
      })
    );

    // 注册复制命令 ID
    context.subscriptions.push(
      vscode.commands.registerCommand('vedh.commands.copy.id', (node: CommandNode) => {
        this.copyCommandId(node);
      })
    );

    // 注册复制命令配置
    context.subscriptions.push(
      vscode.commands.registerCommand('vedh.commands.copy.config', (node: CommandNode) => {
        this.copyCommandConfig(node);
      })
    );

    // 注册跳转到命令注册位置
    context.subscriptions.push(
      vscode.commands.registerCommand('vedh.commands.goto.registration', (node: CommandNode) => {
        this.gotoCommandRegistration(node);
      })
    );
  }

  fileExist(filePath: string | undefined): boolean {
    if (!filePath) {
      return false;
    }
    return fs.existsSync(filePath);
  }

  parsePackageJson(pkgPath: string) {
    try {
      const data = fs.readFileSync(pkgPath, "utf-8");
      this.pkgJson = JSON.parse(data);
      console.log("Commands from package.json: ", this.pkgJson?.contributes?.commands);
    } catch (error) {
      console.error("Error parsing package.json: ", error);
      this.hasPackageJson = false;
    }
  }

  getChildren(element?: CommandNode): Thenable<CommandNode[]> {
    if (!this.hasPackageJson || !this.pkgJson) {
      // 如果没有 package.json，返回错误消息节点
      return Promise.resolve([
        new CommandNode(
          NodeType.error,
          "不是一个标准的VSCode extension插件目录",
          "",
          "",
          vscode.TreeItemCollapsibleState.None,
          "error",
          this.iconManager
        )
      ]);
    }

    // 检查是否有 contributes.commands
    if (!this.pkgJson.contributes || !this.pkgJson.contributes.commands) {
      return Promise.resolve([
        new CommandNode(
          NodeType.info,
          "当前插件没有定义任何命令",
          "",
          "",
          vscode.TreeItemCollapsibleState.None,
          "info",
          this.iconManager
        )
      ]);
    }

    if (!element) {
      // 返回所有 commands
      const commands = this.pkgJson.contributes.commands;
      return Promise.resolve(
        commands.map((cmd: any) => {
          return new CommandNode(
            NodeType.command,
            cmd.title || cmd.command,
            cmd.command,
            cmd.command,
            vscode.TreeItemCollapsibleState.Collapsed,
            cmd.icon ? 'symbol-method' : 'terminal',
            this.iconManager
          );
        })
      );
    } else {
      // 显示命令的详细信息
      if (element.type === NodeType.command) {
        const command = this.pkgJson.contributes.commands.find((cmd: any) => cmd.command === element.id);
        if (command) {
          const details: CommandNode[] = [];

          Object.keys(command).forEach(key => {
            const value = command[key];
            let displayValue = '';

            if (typeof value === 'object') {
              displayValue = JSON.stringify(value, null, 2);
            } else {
              displayValue = String(value);
            }

            const icon = this.iconManager.getIconForPropertyType(value);

            details.push(
              new CommandNode(
                NodeType.property,
                key,
                displayValue,
                "",
                vscode.TreeItemCollapsibleState.None,
                icon,
                this.iconManager
              )
            );
          });

          return Promise.resolve(details);
        }
      }

      return Promise.resolve([]);
    }
  }

  getTreeItem(element: CommandNode): CommandNode {
    // 对于错误和信息节点，不添加命令
    if (element.type === NodeType.error || element.type === NodeType.info) {
      return element;
    }

    // 对于命令节点，添加编辑命令
    if (element.type === NodeType.command) {
      const treeItem = element;
      treeItem.command = {
        command: 'vedh.commands.edit',
        title: 'Edit',
        arguments: [element]
      };
      return treeItem;
    }

    return element;
  }

  private _onDidChangeTreeData: vscode.EventEmitter<CommandNode | undefined | null | void>
    = new vscode.EventEmitter<CommandNode | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<CommandNode | undefined | null | void>
    = this._onDidChangeTreeData.event;

  refresh(): void {
    // 重新解析 package.json
    if (this.pkgPath && this.fileExist(this.pkgPath)) {
      this.hasPackageJson = true;
      this.parsePackageJson(this.pkgPath);
    } else {
      this.hasPackageJson = false;
    }

    this._onDidChangeTreeData.fire();
    console.log("Commands view refreshed");
  }

  async editCommand(node: CommandNode): Promise<void> {
    console.log("Edit command: ", node);

    if (!this.pkgPath) {
      vscode.window.showErrorMessage('无法找到 package.json 文件');
      return;
    }

    if (node.type === NodeType.command) {
      try {
        const doc = await vscode.workspace.openTextDocument(this.pkgPath);
        const editor = await vscode.window.showTextDocument(doc);
        const text = doc.getText();

        // 查找命令在 commands 数组中的位置
        const commandsMatch = text.match(/"commands"\s*:\s*\[/);
        if (!commandsMatch || commandsMatch.index === undefined) {
          vscode.window.showWarningMessage('无法在 package.json 中找到 commands 配置');
          return;
        }

        // 从 commands 数组开始位置查找
        const commandsStartIndex = commandsMatch.index + commandsMatch[0].length;
        const remainingText = text.substring(commandsStartIndex);

        // 构建更精确的搜索模式
        const searchPattern = new RegExp(
          `\\{[^}]*"command"\\s*:\\s*"${node.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^}]*\\}`,
          'gs'
        );

        const match = searchPattern.exec(remainingText);
        if (match && match.index !== undefined) {
          const absoluteIndex = commandsStartIndex + match.index;
          const startPos = doc.positionAt(absoluteIndex);
          const endPos = doc.positionAt(absoluteIndex + match[0].length);

          // 选中整个命令对象
          editor.selection = new vscode.Selection(startPos, endPos);
          editor.revealRange(
            new vscode.Range(startPos, endPos),
            vscode.TextEditorRevealType.InCenter
          );

          // 显示提示信息
          vscode.window.showInformationMessage(
            `已定位到命令: ${node.name}`,
            '折叠其他',
            '格式化'
          ).then(selection => {
            if (selection === '折叠其他') {
              vscode.commands.executeCommand('editor.foldAll');
              vscode.commands.executeCommand('editor.unfold', { selectionLines: [startPos.line] });
            } else if (selection === '格式化') {
              vscode.commands.executeCommand('editor.action.formatDocument');
            }
          });
        } else {
          vscode.window.showWarningMessage(`无法找到命令: ${node.id}`);
        }
      } catch (error) {
        vscode.window.showErrorMessage(`打开文件失败: ${error}`);
      }
    } else if (node.type === NodeType.property) {
      // 如果是 icon 属性，显示图标选择器
      if (node.name === 'icon') {
        // 检查当前值是否是对象（light/dark格式）
        let currentIconValue = node.description;
        try {
          const parsed = JSON.parse(node.description);
          if (typeof parsed === 'object' && (parsed.light || parsed.dark)) {
            const choice = await vscode.window.showInformationMessage(
              '当前图标使用了自定义 SVG 文件（light/dark），是否要替换为内置图标？',
              '是',
              '取消'
            );
            if (choice !== '是') {
              return;
            }
            currentIconValue = '';
          }
        } catch {
          // 不是 JSON 对象，继续
        }

        const selectedIcon = await this.showIconPicker(currentIconValue);
        if (selectedIcon && selectedIcon !== node.description) {
          await this.updateIconValue(node.description, selectedIcon);
        }
      } else {
        // 其他属性使用文本输入框
        const newValue = await vscode.window.showInputBox({
          prompt: `编辑属性 "${node.name}"`,
          value: node.description,
          placeHolder: '输入新值'
        });

        if (newValue !== undefined && newValue !== node.description) {
          await this.updatePropertyValue(node.name, node.description, newValue);
        }
      }
    }
  }

  private async showIconPicker(currentIcon: string): Promise<string | undefined> {
    // 使用统一的常用图标列表

    // 创建 QuickPick
    const quickPick = vscode.window.createQuickPick();
    quickPick.title = '选择图标';
    quickPick.placeholder = '搜索或选择一个内置图标...';
    quickPick.matchOnDescription = true;  // 启用对 description 的搜索（中文）
    quickPick.matchOnDetail = true;       // 启用对 detail 的搜索（英文图标名）

    // 添加按钮：本地图标 + 帮助文档
    quickPick.buttons = [
      {
        iconPath: new vscode.ThemeIcon('add'),
        tooltip: '选择本地 SVG 图标文件'
      },
      {
        iconPath: new vscode.ThemeIcon('question'),
        tooltip: '查看所有可用的内置图标'
      }
    ];

    // 添加自定义输入选项和常用图标
    quickPick.items = [
      {
        label: '$(pencil) 输入自定义图标名称',
        description: '手动输入任何 Codicon 图标',
        detail: 'VSCode 有 400+ 个内置图标可用',
        alwaysShow: true
      },
      { label: '', kind: vscode.QuickPickItemKind.Separator },
      ...COMMON_ICONS.map(icon => ({
        label: icon.label,
        description: icon.description,
        detail: `图标名称: ${icon.icon}`
      }))
    ];

    // 如果有当前图标，高亮显示
    if (currentIcon) {
      const currentItem = quickPick.items.find(item =>
        item.label === currentIcon || item.label === `$(${currentIcon})`
      );
      if (currentItem) {
        quickPick.activeItems = [currentItem];
      }
    }

    return new Promise((resolve) => {
      // 处理按钮点击事件
      quickPick.onDidTriggerButton(async (button) => {
        const buttonIndex = quickPick.buttons.indexOf(button);

        if (buttonIndex === 0) {
          // 第一个按钮：选择本地图标
          quickPick.hide();
          const localIcon = await this.selectLocalIcon();
          resolve(localIcon);
        } else if (buttonIndex === 1) {
          // 第二个按钮：打开帮助文档
          vscode.env.openExternal(vscode.Uri.parse('https://code.visualstudio.com/api/references/icons-in-labels'));
          // 不关闭选择器，用户可以继续选择
        }
      });

      quickPick.onDidChangeSelection(async (items) => {
        if (items.length > 0) {
          const selected = items[0];

          // 如果选择了自定义输入选项
          if (selected.label === '$(pencil) 输入自定义图标名称') {
            quickPick.hide();
            const customIcon = await this.inputCustomIcon();
            resolve(customIcon);
          } else {
            resolve(selected.label);
            quickPick.hide();
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

  private async inputCustomIcon(): Promise<string | undefined> {
    const iconName = await vscode.window.showInputBox({
      prompt: '输入 Codicon 图标名称',
      placeHolder: '例如: sync, edit, check, rocket',
      title: '自定义图标',
      validateInput: (value) => {
        if (!value) {
          return '请输入图标名称';
        }
        // 基本验证：只允许字母、数字、连字符和波浪号
        if (!/^[a-z0-9\-~]+$/i.test(value)) {
          return '图标名称只能包含字母、数字、连字符(-)和波浪号(~)';
        }
        return null;
      }
    });

    if (iconName) {
      // 如果用户输入了图标名，返回格式化的图标字符串
      return `$(${iconName})`;
    }

    return undefined;
  }

  private async selectLocalIcon(): Promise<string | undefined> {
    // 询问用户选择单个图标还是 light/dark 两个图标
    const choice = await vscode.window.showQuickPick(
      [
        { label: '单个 SVG 图标', description: '适用于所有主题', value: 'single' },
        { label: 'Light + Dark 两个图标', description: '分别适配浅色和深色主题', value: 'dual' }
      ],
      {
        placeHolder: '选择图标类型...',
        title: '本地图标配置'
      }
    );

    if (!choice) {
      return undefined;
    }

    if (choice.value === 'single') {
      // 选择单个 SVG 文件
      const uris = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: {
          'SVG 图标': ['svg']
        },
        title: '选择 SVG 图标文件'
      });

      if (uris && uris.length > 0) {
        const relativePath = this.getRelativePath(uris[0].fsPath);
        return relativePath;
      }
    } else {
      // 选择 light 和 dark 两个文件
      const lightUris = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: {
          'SVG 图标': ['svg']
        },
        title: '选择 Light 主题图标'
      });

      if (!lightUris || lightUris.length === 0) {
        return undefined;
      }

      const darkUris = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: {
          'SVG 图标': ['svg']
        },
        title: '选择 Dark 主题图标'
      });

      if (!darkUris || darkUris.length === 0) {
        return undefined;
      }

      const lightPath = this.getRelativePath(lightUris[0].fsPath);
      const darkPath = this.getRelativePath(darkUris[0].fsPath);

      // 返回 JSON 格式的图标配置
      return JSON.stringify({
        light: lightPath,
        dark: darkPath
      });
    }

    return undefined;
  }

  private getRelativePath(absolutePath: string): string {
    // 获取相对于 package.json 的相对路径
    if (this.currentPath) {
      const relative = path.relative(this.currentPath, absolutePath);
      // 确保使用正斜杠（跨平台兼容）
      return relative.replace(/\\/g, '/');
    }
    return absolutePath;
  }

  private async updateIconValue(oldValue: string, newValue: string): Promise<void> {
    if (!this.pkgPath) {
      return;
    }

    try {
      const doc = await vscode.workspace.openTextDocument(this.pkgPath);
      const text = doc.getText();
      let match: RegExpExecArray | null = null;
      let searchPattern: RegExp;

      // 尝试匹配对象格式的图标（light/dark）
      try {
        const parsed = JSON.parse(oldValue);
        if (typeof parsed === 'object') {
          // 匹配多行的对象格式
          searchPattern = new RegExp(
            `"icon"\\s*:\\s*\\{[^}]*\\}`,
            'gs'
          );
          match = searchPattern.exec(text);
        }
      } catch {
        // 如果不是 JSON，尝试匹配简单字符串格式
        searchPattern = new RegExp(
          `"icon"\\s*:\\s*"${oldValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`,
          'g'
        );
        match = searchPattern.exec(text);
      }

      if (match && match.index !== undefined) {
        const editor = await vscode.window.showTextDocument(doc);
        const startPos = doc.positionAt(match.index);
        const endPos = doc.positionAt(match.index + match[0].length);

        // 构建替换内容
        let replacement: string;
        try {
          // 检查新值是否是 JSON 对象（light/dark格式）
          const parsed = JSON.parse(newValue);
          if (typeof parsed === 'object' && (parsed.light || parsed.dark)) {
            // 格式化为多行 JSON
            replacement = `"icon": {\n          "light": "${parsed.light}",\n          "dark": "${parsed.dark}"\n        }`;
          } else {
            replacement = `"icon": "${newValue}"`;
          }
        } catch {
          // 不是 JSON，作为字符串处理
          replacement = `"icon": "${newValue}"`;
        }

        const success = await editor.edit(editBuilder => {
          editBuilder.replace(new vscode.Range(startPos, endPos), replacement);
        });

        if (success) {
          await doc.save();
          showNotification(`图标已更新`);
          this.refresh();
        }
      } else {
        vscode.window.showWarningMessage(`无法找到图标配置`);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`更新失败: ${error}`);
    }
  }

  private async updatePropertyValue(
    propertyName: string,
    oldValue: string,
    newValue: string
  ): Promise<void> {
    if (!this.pkgPath) {
      return;
    }

    try {
      const doc = await vscode.workspace.openTextDocument(this.pkgPath);
      const text = doc.getText();

      // 构建搜索模式
      const searchPattern = `"${propertyName}"\\s*:\\s*"${oldValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`;
      const regex = new RegExp(searchPattern);
      const match = regex.exec(text);

      if (match && match.index !== undefined) {
        const editor = await vscode.window.showTextDocument(doc);
        const startPos = doc.positionAt(match.index);
        const endPos = doc.positionAt(match.index + match[0].length);

        // 替换值
        const replacement = `"${propertyName}": "${newValue}"`;
        const success = await editor.edit(editBuilder => {
          editBuilder.replace(new vscode.Range(startPos, endPos), replacement);
        });

        if (success) {
          await doc.save();
          showNotification(`属性 "${propertyName}" 已更新`);
          this.refresh();
        }
      } else {
        vscode.window.showWarningMessage(`无法找到属性: ${propertyName}`);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`更新失败: ${error}`);
    }
  }

  copyCommandId(node: CommandNode): void {
    if (node.type === NodeType.command && node.id) {
      vscode.env.clipboard.writeText(node.id).then(() => {
        showNotification(`已复制命令 ID: ${node.id}`);
      });
    }
  }

  copyCommandConfig(node: CommandNode): void {
    if (node.type === NodeType.command && this.pkgJson) {
      const command = this.pkgJson.contributes.commands.find((cmd: any) => cmd.command === node.id);
      if (command) {
        const configText = JSON.stringify(command, null, 2);
        vscode.env.clipboard.writeText(configText).then(() => {
          showNotification(`已复制命令配置: ${node.name}`);
        });
      }
    }
  }

  async gotoCommandRegistration(node: CommandNode): Promise<void> {
    if (node.type !== NodeType.command || !node.id || !this.currentPath) {
      return;
    }

    // 显示加载提示
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: `正在搜索命令注册: ${node.id}`,
      cancellable: false
    }, async (progress) => {
      progress.report({ increment: 0 });

      try {
        // 使用 CodeNavigator 查找命令注册位置
        const location = await CodeNavigator.findCommandRegistration(
          node.id,
          this.currentPath!
        );

        progress.report({ increment: 100 });

        if (location) {
          // 直接跳转到命令注册位置
          await CodeNavigator.navigateToLocation(location);
        } else {
          // 未找到，提供搜索选项
          const choice = await vscode.window.showWarningMessage(
            `未找到命令 "${node.id}" 的注册位置`,
            '在所有文件中搜索',
            '查看 package.json',
            '取消'
          );

          if (choice === '在所有文件中搜索') {
            // 使用 VS Code 的全局搜索
            vscode.commands.executeCommand('workbench.action.findInFiles', {
              query: `registerCommand.*${node.id}`,
              isRegex: true,
              isCaseSensitive: true
            });
          } else if (choice === '查看 package.json') {
            // 跳转到 package.json 中的命令定义
            this.editCommand(node);
          }
        }
      } catch (error) {
        vscode.window.showErrorMessage(`搜索失败: ${error}`);
      }
    });
  }

  private async previewLocation(location: { filePath: string; line: number; context: string }): Promise<void> {
    const fileName = path.basename(location.filePath);
    const webview = vscode.window.createWebviewPanel(
      'commandPreview',
      `命令注册预览: ${fileName}`,
      vscode.ViewColumn.Beside,
      {}
    );

    webview.webview.html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: 'Consolas', 'Monaco', monospace;
            padding: 20px;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
          }
          pre {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
            line-height: 1.5;
          }
          .file-info {
            color: var(--vscode-descriptionForeground);
            margin-bottom: 15px;
            font-size: 0.9em;
          }
          .highlight-line {
            background-color: var(--vscode-editor-findMatchHighlightBackground);
          }
        </style>
      </head>
      <body>
        <div class="file-info">
          📄 ${location.filePath}<br>
          📍 行: ${location.line + 1}
        </div>
        <pre><code>${this.escapeHtml(location.context)}</code></pre>
      </body>
      </html>
    `;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

enum NodeType {
  command,
  property,
  error,
  info
}

class CommandNode extends vscode.TreeItem {
  constructor(
    public readonly type: NodeType,
    public readonly name: string,
    public readonly description: string,
    public readonly id: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly icon: string | undefined,
    private iconManager: IconManager,
    public command?: vscode.Command
  ) {
    super(name, collapsibleState);
    this.description = description;
    this.iconPath = iconManager.getIcon(icon);

    // 设置 contextValue 用于菜单条件判断
    switch (type) {
      case NodeType.command:
        this.contextValue = 'command';
        break;
      case NodeType.property:
        this.contextValue = 'property';
        break;
      case NodeType.error:
        this.contextValue = 'error';
        break;
      case NodeType.info:
        this.contextValue = 'info';
        break;
    }

    // 为属性节点添加 tooltip
    if (type === NodeType.property) {
      this.tooltip = `${name}: ${description}`;
    }
  }
}
