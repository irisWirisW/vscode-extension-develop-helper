import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { IconManager } from './iconManager';
import { showNotification } from './utils/notificationManager';
import { KeybindingRecorder } from './utils/keybindingRecorder';

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

    // 注册录制快捷键命令（编辑 key 属性）
    context.subscriptions.push(
      vscode.commands.registerCommand('vedh.keybindings.recordKey', (node: KeybindingNode) => {
        this.recordKeybinding(node, 'key');
      })
    );

    // 注册录制快捷键命令（编辑 mac 属性）
    context.subscriptions.push(
      vscode.commands.registerCommand('vedh.keybindings.recordMac', (node: KeybindingNode) => {
        this.recordKeybinding(node, 'mac');
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
    } else if (node.type === NodeType.property && node.value) {
      // 复制具体的快捷键值
      vscode.env.clipboard.writeText(node.value).then(() => {
        showNotification(`已复制快捷键: ${node.value}`);
      });
    }
  }

  /**
   * 录制并更新快捷键
   */
  async recordKeybinding(node: KeybindingNode, platform: 'key' | 'mac'): Promise<void> {
    if (!this.pkgPath) {
      vscode.window.showErrorMessage('无法找到 package.json 文件');
      return;
    }

    // 确定是从哪个节点触发的
    let keybindingNode: KeybindingNode | undefined;
    let propertyName: 'key' | 'mac' = platform;

    if (node.type === NodeType.keybinding) {
      // 从快捷键节点触发
      keybindingNode = node;
    } else if (node.type === NodeType.property && (node.name === 'key' || node.name === 'mac')) {
      // 从属性节点触发，需要找到父节点
      keybindingNode = this.findParentKeybindingNode(node);
      propertyName = node.name as 'key' | 'mac';
    } else {
      vscode.window.showWarningMessage('请在快捷键节点或 key/mac 属性节点上使用此功能');
      return;
    }

    if (!keybindingNode) {
      vscode.window.showErrorMessage('无法找到快捷键配置');
      return;
    }

    try {
      // 显示录制界面
      const recordedKey = await KeybindingRecorder.recordKeybinding(propertyName);

      if (!recordedKey) {
        return; // 用户取消
      }

      // 验证快捷键
      const validation = KeybindingRecorder.validateKeybinding(recordedKey);
      if (!validation.valid) {
        vscode.window.showErrorMessage(`快捷键无效: ${validation.message}`);
        return;
      }

      // 更新 package.json
      await this.updateKeybindingInPackageJson(keybindingNode, propertyName, recordedKey);

      showNotification(`已更新 ${propertyName} 为: ${recordedKey}`);
      this.refresh();
    } catch (error) {
      vscode.window.showErrorMessage(`更新失败: ${error}`);
    }
  }

  /**
   * 在 package.json 中更新快捷键
   */
  private async updateKeybindingInPackageJson(
    node: KeybindingNode,
    property: 'key' | 'mac',
    newValue: string
  ): Promise<void> {
    if (!this.pkgPath || node.index === undefined) {
      return;
    }

    const doc = await vscode.workspace.openTextDocument(this.pkgPath);
    const text = doc.getText();
    const keybindings = this.pkgJson.contributes.keybindings;
    const targetKeybinding = keybindings[node.index];

    if (!targetKeybinding) {
      throw new Error('找不到目标快捷键配置');
    }

    // 构建搜索模式 - 查找整个快捷键对象
    const kbString = JSON.stringify(targetKeybinding);
    const kbIndex = text.indexOf(kbString);

    if (kbIndex === -1) {
      // 如果精确匹配失败，尝试更灵活的匹配
      await this.updateKeybindingFlexible(doc, targetKeybinding, property, newValue);
      return;
    }

    // 在快捷键对象内查找属性
    const kbEndIndex = kbIndex + kbString.length;
    const kbText = text.substring(kbIndex, kbEndIndex);

    // 检查属性是否存在
    const propertyPattern = new RegExp(`"${property}"\\s*:\\s*"([^"]*)"`, 'g');
    const match = propertyPattern.exec(kbText);

    const editor = await vscode.window.showTextDocument(doc);

    if (match && match.index !== undefined) {
      // 属性存在，替换值
      const absoluteIndex = kbIndex + match.index;
      const valueStartIndex = absoluteIndex + match[0].indexOf('"', match[0].indexOf(':')) + 1;
      const valueEndIndex = valueStartIndex + match[1].length;

      const startPos = doc.positionAt(valueStartIndex);
      const endPos = doc.positionAt(valueEndIndex);

      await editor.edit(editBuilder => {
        editBuilder.replace(new vscode.Range(startPos, endPos), newValue);
      });
    } else {
      // 属性不存在，需要添加
      await this.addKeybindingProperty(editor, doc, kbIndex, kbText, property, newValue);
    }

    await doc.save();
  }

  /**
   * 添加快捷键属性
   */
  private async addKeybindingProperty(
    editor: vscode.TextEditor,
    doc: vscode.TextDocument,
    kbStartIndex: number,
    kbText: string,
    property: 'key' | 'mac',
    value: string
  ): Promise<void> {
    // 查找最后一个属性的位置
    const lastPropertyMatch = kbText.match(/,?\s*"[^"]+"\s*:\s*"[^"]*"/g);

    if (lastPropertyMatch && lastPropertyMatch.length > 0) {
      // 在最后一个属性后添加
      const lastProperty = lastPropertyMatch[lastPropertyMatch.length - 1];
      const lastPropertyIndex = kbText.lastIndexOf(lastProperty);
      const insertIndex = kbStartIndex + lastPropertyIndex + lastProperty.length;
      const insertPos = doc.positionAt(insertIndex);

      // 确定缩进
      const lineText = doc.lineAt(insertPos.line).text;
      const baseIndent = lineText.match(/^\s*/)?.[0] || '      ';

      const newProperty = `,\n${baseIndent}"${property}": "${value}"`;

      await editor.edit(editBuilder => {
        editBuilder.insert(insertPos, newProperty);
      });
    }
  }

  /**
   * 灵活更新快捷键（当精确匹配失败时）
   */
  private async updateKeybindingFlexible(
    doc: vscode.TextDocument,
    targetKeybinding: any,
    property: 'key' | 'mac',
    newValue: string
  ): Promise<void> {
    // 通过命令 ID 查找
    const text = doc.getText();
    const commandId = targetKeybinding.command;

    if (!commandId) {
      throw new Error('快捷键配置缺少 command 属性');
    }

    // 在 keybindings 数组中查找包含此 command 的对象
    const keybindingsMatch = text.match(/"keybindings"\s*:\s*\[/);
    if (!keybindingsMatch || keybindingsMatch.index === undefined) {
      throw new Error('无法找到 keybindings 配置');
    }

    // 查找特定命令的快捷键对象
    const pattern = new RegExp(
      `\\{[^}]*"command"\\s*:\\s*"${commandId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^}]*\\}`,
      'gs'
    );

    const matches = [...text.matchAll(pattern)];

    if (matches.length === 0) {
      throw new Error(`找不到命令 "${commandId}" 的快捷键配置`);
    }

    // 如果有多个匹配，让用户选择
    const targetMatch = matches[0]; // 暂时使用第一个匹配

    const editor = await vscode.window.showTextDocument(doc);
    const matchStartIndex = targetMatch.index!;
    const matchText = targetMatch[0];

    // 在匹配的对象中查找或添加属性
    const propertyPattern = new RegExp(`"${property}"\\s*:\\s*"([^"]*)"`, 'g');
    const propMatch = propertyPattern.exec(matchText);

    if (propMatch && propMatch.index !== undefined) {
      // 替换现有值
      const valueStartIndex = matchStartIndex + propMatch.index + propMatch[0].indexOf('"', propMatch[0].indexOf(':')) + 1;
      const valueEndIndex = valueStartIndex + propMatch[1].length;

      const startPos = doc.positionAt(valueStartIndex);
      const endPos = doc.positionAt(valueEndIndex);

      await editor.edit(editBuilder => {
        editBuilder.replace(new vscode.Range(startPos, endPos), newValue);
      });
    } else {
      // 添加新属性
      await this.addKeybindingProperty(editor, doc, matchStartIndex, matchText, property, newValue);
    }
  }

  /**
   * 查找属性节点的父快捷键节点
   */
  private findParentKeybindingNode(propertyNode: KeybindingNode): KeybindingNode | undefined {
    // 在当前加载的快捷键列表中查找
    const keybindings = this.pkgJson?.contributes?.keybindings;
    if (!keybindings) {
      return undefined;
    }

    // 通过属性值匹配父节点
    for (let i = 0; i < keybindings.length; i++) {
      const kb = keybindings[i];
      if (kb[propertyNode.name] === propertyNode.value) {
        return new KeybindingNode(
          NodeType.keybinding,
          kb.command || `Keybinding ${i + 1}`,
          kb.command || '',
          '',
          vscode.TreeItemCollapsibleState.Collapsed,
          "keybinding",
          this.iconManager,
          kb,
          i
        );
      }
    }

    return undefined;
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
