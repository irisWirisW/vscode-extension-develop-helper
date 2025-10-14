import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class CommandsProvider implements vscode.TreeDataProvider<CommandNode> {

  pkgPath: string | undefined;
  pkgJson: any = undefined;
  hasPackageJson: boolean = false;

  constructor(
    public context: vscode.ExtensionContext,
    public readonly currentPath: string | undefined
  ) {
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
      vscode.commands.registerCommand('vedh.editCommand', (node: CommandNode) => {
        this.editCommand(node);
      })
    );

    // 注册刷新命令
    context.subscriptions.push(
      vscode.commands.registerCommand('vedh.refreshCommands', () => {
        this.refresh();
      })
    );

    // 注册复制命令 ID
    context.subscriptions.push(
      vscode.commands.registerCommand('vedh.copyCommandId', (node: CommandNode) => {
        this.copyCommandId(node);
      })
    );

    // 注册复制命令配置
    context.subscriptions.push(
      vscode.commands.registerCommand('vedh.copyCommandConfig', (node: CommandNode) => {
        this.copyCommandConfig(node);
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
          "error"
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
          "info"
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
            cmd.icon ? 'symbol-method' : 'terminal'
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
            let icon = 'symbol-property';

            if (typeof value === 'object') {
              displayValue = JSON.stringify(value, null, 2);
              icon = 'json';
            } else if (typeof value === 'boolean') {
              displayValue = String(value);
              icon = 'symbol-boolean';
            } else if (typeof value === 'string') {
              displayValue = value;
              icon = 'symbol-string';
            } else {
              displayValue = String(value);
            }

            details.push(
              new CommandNode(
                NodeType.property,
                key,
                displayValue,
                "",
                vscode.TreeItemCollapsibleState.None,
                icon
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
        command: 'vedh.editCommand',
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
      // 如果是属性节点，提供快速编辑选项
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
          vscode.window.showInformationMessage(`属性 "${propertyName}" 已更新`);
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
        vscode.window.showInformationMessage(`已复制命令 ID: ${node.id}`);
      });
    }
  }

  copyCommandConfig(node: CommandNode): void {
    if (node.type === NodeType.command && this.pkgJson) {
      const command = this.pkgJson.contributes.commands.find((cmd: any) => cmd.command === node.id);
      if (command) {
        const configText = JSON.stringify(command, null, 2);
        vscode.env.clipboard.writeText(configText).then(() => {
          vscode.window.showInformationMessage(`已复制命令配置: ${node.name}`);
        });
      }
    }
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
    public readonly icon?: string,
    public command?: vscode.Command
  ) {
    super(name, collapsibleState);
    this.description = description;
    this.iconPath = this.getIcon(this.icon);

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

  getIcon(iconName: string | undefined): vscode.ThemeIcon | { light: string; dark: string } {
    if (!iconName) {
      return new vscode.ThemeIcon('circle-slash');
    }

    if (iconName.endsWith('.svg')) {
      const lightPath = this.getIconPath('light', iconName);
      const darkPath = this.getIconPath('dark', iconName);

      if (fs.existsSync(lightPath) && fs.existsSync(darkPath)) {
        return {
          light: lightPath,
          dark: darkPath
        };
      }
    }

    // 使用内置图标
    return new vscode.ThemeIcon(iconName);
  }

  private getIconPath(theme: string, iconName: string): string {
    return path.join(__dirname, '..', 'resources', theme, iconName);
  }
}
