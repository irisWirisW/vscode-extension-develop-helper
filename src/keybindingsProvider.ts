import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { IconManager } from './iconManager';
import { showNotification } from './utils/notificationManager';

export class KeybindingsProvider implements vscode.TreeDataProvider<KeybindingNode> {

  pkgPath: string | undefined;
  pkgJson: any = undefined;
  hasPackageJson: boolean = false;
  private iconManager: IconManager;

  private _onDidChangeTreeData: vscode.EventEmitter<KeybindingNode | undefined | null | void> = new vscode.EventEmitter<KeybindingNode | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<KeybindingNode | undefined | null | void> = this._onDidChangeTreeData.event;

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
      vscode.commands.registerCommand('vedh.keybindings.edit', (node: KeybindingNode) => {
        this.editKeybinding(node);
      })
    );

    // 注册刷新命令
    context.subscriptions.push(
      vscode.commands.registerCommand('vedh.keybindings.refresh', () => {
        this.refresh();
      })
    );

    // 注册复制快捷键命令
    context.subscriptions.push(
      vscode.commands.registerCommand('vedh.keybindings.copy', (node: KeybindingNode) => {
        this.copyKeybinding(node);
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
      console.log("Keybindings from package.json: ", this.pkgJson?.contributes?.keybindings);
    } catch (error) {
      console.error("Error parsing package.json: ", error);
      this.hasPackageJson = false;
    }
  }

  getChildren(element?: KeybindingNode): Thenable<KeybindingNode[]> {
    if (!this.hasPackageJson || !this.pkgJson) {
      return Promise.resolve([
        new KeybindingNode(
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

    if (!this.pkgJson.contributes || !this.pkgJson.contributes.keybindings) {
      return Promise.resolve([
        new KeybindingNode(
          NodeType.info,
          "当前插件没有定义任何快捷键",
          "",
          "",
          vscode.TreeItemCollapsibleState.None,
          "info",
          this.iconManager
        )
      ]);
    }

    if (!element) {
      // 返回所有快捷键绑定
      const keybindings = this.pkgJson.contributes.keybindings;
      return Promise.resolve(
        keybindings.map((kb: any, index: number) => {
          const displayName = kb.command || `Keybinding ${index + 1}`;
          return new KeybindingNode(
            NodeType.keybinding,
            displayName,
            kb.command || '',
            '',
            vscode.TreeItemCollapsibleState.Collapsed,
            "keybinding",
            this.iconManager,
            kb,
            index
          );
        })
      );
    } else if (element.type === NodeType.keybinding && element.keybindingData) {
      // 返回快捷键的详细信息
      const kb = element.keybindingData;
      const details: KeybindingNode[] = [];

      // command
      if (kb.command) {
        details.push(new KeybindingNode(
          NodeType.property,
          "command",
          kb.command,
          kb.command,
          vscode.TreeItemCollapsibleState.None,
          "property",
          this.iconManager
        ));
      }

      // key (Windows/Linux)
      if (kb.key) {
        details.push(new KeybindingNode(
          NodeType.property,
          "key",
          kb.key,
          kb.key,
          vscode.TreeItemCollapsibleState.None,
          "property",
          this.iconManager
        ));
      }

      // mac
      if (kb.mac) {
        details.push(new KeybindingNode(
          NodeType.property,
          "mac",
          kb.mac,
          kb.mac,
          vscode.TreeItemCollapsibleState.None,
          "property",
          this.iconManager
        ));
      }

      // when
      if (kb.when) {
        details.push(new KeybindingNode(
          NodeType.property,
          "when",
          kb.when,
          kb.when,
          vscode.TreeItemCollapsibleState.None,
          "property",
          this.iconManager
        ));
      }

      return Promise.resolve(details);
    }

    return Promise.resolve([]);
  }

  getTreeItem(element: KeybindingNode): vscode.TreeItem {
    return element;
  }

  refresh(): void {
    if (this.pkgPath) {
      this.parsePackageJson(this.pkgPath);
    }
    this._onDidChangeTreeData.fire();
    console.log("Keybindings refreshed");
  }

  async editKeybinding(node: KeybindingNode): Promise<void> {
    if (!this.pkgPath) {
      vscode.window.showErrorMessage('无法找到 package.json 文件');
      return;
    }

    try {
      const doc = await vscode.workspace.openTextDocument(this.pkgPath);
      const editor = await vscode.window.showTextDocument(doc);
      const text = doc.getText();

      // 查找 keybindings 区域
      const keybindingsMatch = text.match(/"keybindings"\s*:\s*\[/);
      if (keybindingsMatch && keybindingsMatch.index !== undefined) {
        const startPos = doc.positionAt(keybindingsMatch.index);

        // 定位到具体的快捷键绑定
        if (node.type === NodeType.keybinding && node.index !== undefined) {
          const keybindings = this.pkgJson.contributes.keybindings;
          let currentIndex = 0;
          let found = false;

          for (let i = 0; i < keybindings.length; i++) {
            const kbString = JSON.stringify(keybindings[i], null, 2);
            const kbMatch = text.indexOf(kbString, keybindingsMatch.index);

            if (kbMatch !== -1 && i === node.index) {
              const kbStartPos = doc.positionAt(kbMatch);
              editor.selection = new vscode.Selection(kbStartPos, kbStartPos);
              editor.revealRange(
                new vscode.Range(kbStartPos, kbStartPos),
                vscode.TextEditorRevealType.InCenter
              );
              found = true;
              break;
            }
          }

          if (!found) {
            editor.selection = new vscode.Selection(startPos, startPos);
            editor.revealRange(
              new vscode.Range(startPos, startPos),
              vscode.TextEditorRevealType.InCenter
            );
          }
        } else {
          editor.selection = new vscode.Selection(startPos, startPos);
          editor.revealRange(
            new vscode.Range(startPos, startPos),
            vscode.TextEditorRevealType.InCenter
          );
        }

        showNotification(`已定位到快捷键: ${node.name}`);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`打开文件失败: ${error}`);
    }
  }

  copyKeybinding(node: KeybindingNode): void {
    if (node.type === NodeType.keybinding && node.keybindingData) {
      const configText = JSON.stringify(node.keybindingData, null, 2);
      vscode.env.clipboard.writeText(configText).then(() => {
        showNotification(`已复制快捷键配置: ${node.name}`);
      });
    }
  }
}

enum NodeType {
  keybinding = "keybinding",
  property = "property",
  error = "error",
  info = "info"
}

class KeybindingNode extends vscode.TreeItem {
  constructor(
    public readonly type: NodeType,
    public readonly name: string,
    public readonly value: string,
    public readonly description: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly contextValue: string,
    private iconManager: IconManager,
    public readonly keybindingData?: any,
    public readonly index?: number
  ) {
    super(name, collapsibleState);

    this.tooltip = this.getTooltip();
    this.description = description;
    this.contextValue = contextValue;

    // 设置图标
    this.iconPath = this.getIcon();
  }

  private getTooltip(): string {
    if (this.type === NodeType.keybinding) {
      const kb = this.keybindingData;
      let tooltip = `命令: ${kb.command}\n`;
      if (kb.key) {
        tooltip += `Windows/Linux: ${kb.key}\n`;
      }
      if (kb.mac) {
        tooltip += `macOS: ${kb.mac}\n`;
      }
      if (kb.when) {
        tooltip += `条件: ${kb.when}`;
      }
      return tooltip;
    } else if (this.type === NodeType.property) {
      return `${this.name}: ${this.value}`;
    }
    return this.description;
  }

  private getIcon(): vscode.ThemeIcon | { light: string; dark: string } | undefined {
    switch (this.type) {
      case NodeType.keybinding:
        return new vscode.ThemeIcon('symbol-key');
      case NodeType.property:
        if (this.name === 'command') {
          return new vscode.ThemeIcon('symbol-method');
        } else if (this.name === 'key' || this.name === 'mac') {
          return new vscode.ThemeIcon('keyboard');
        } else if (this.name === 'when') {
          return this.iconManager.getIcon('when');
        }
        return new vscode.ThemeIcon('symbol-property');
      case NodeType.error:
        return new vscode.ThemeIcon('error');
      case NodeType.info:
        return new vscode.ThemeIcon('info');
      default:
        return undefined;
    }
  }
}
