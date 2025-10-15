import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { IconManager } from './iconManager';
import { showNotification } from './utils/notificationManager';
import { CodeNavigator } from './utils/codeNavigator';

export class MenusProvider implements vscode.TreeDataProvider<MenuNode> {

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
      vscode.commands.registerCommand('vedh.menus.edit', (node: MenuNode) => {
        this.editMenu(node);
      })
    );

    // 注册刷新命令
    context.subscriptions.push(
      vscode.commands.registerCommand('vedh.menus.refresh', () => {
        this.refresh();
      })
    );

    // 注册跳转到命令注册位置
    context.subscriptions.push(
      vscode.commands.registerCommand('vedh.menus.goto.registration', (node: MenuNode) => {
        this.gotoMenuRegistration(node);
      })
    );

    // 注册删除命令
    context.subscriptions.push(
      vscode.commands.registerCommand('vedh.menus.delete', (node: MenuNode) => {
        this.deleteMenu(node);
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
      console.log("Menus from package.json: ", this.pkgJson?.contributes?.menus);
    } catch (error) {
      console.error("Error parsing package.json: ", error);
      this.hasPackageJson = false;
    }
  }

  getChildren(element?: MenuNode): Thenable<MenuNode[]> {
    if (!this.hasPackageJson || !this.pkgJson) {
      return Promise.resolve([
        new MenuNode(
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

    if (!this.pkgJson.contributes || !this.pkgJson.contributes.menus) {
      return Promise.resolve([
        new MenuNode(
          NodeType.info,
          "当前插件没有定义任何菜单",
          "",
          "",
          vscode.TreeItemCollapsibleState.None,
          "info",
          this.iconManager
        )
      ]);
    }

    if (!element) {
      // 返回所有菜单类型（如 view/title, view/item/context 等）
      const menus = this.pkgJson.contributes.menus;
      return Promise.resolve(
        Object.keys(menus).map(menuType => {
          const count = menus[menuType].length;
          return new MenuNode(
            NodeType.menuType,
            menuType,
            `${count} 项`,
            menuType,
            vscode.TreeItemCollapsibleState.Collapsed,
            'list-tree',
            this.iconManager
          );
        })
      );
    } else if (element.type === NodeType.menuType) {
      // 显示某个菜单类型下的所有菜单项
      const menuItems = this.pkgJson.contributes.menus[element.id];
      return Promise.resolve(
        menuItems.map((item: any, index: number) => {
          const label = item.command || item.submenu || `Menu ${index}`;
          const when = item.when ? `when: ${item.when}` : '';
          return new MenuNode(
            NodeType.menuItem,
            label,
            when,
            `${element.id}[${index}]`,
            vscode.TreeItemCollapsibleState.Collapsed,
            'symbol-event',
            this.iconManager
          );
        })
      );
    } else if (element.type === NodeType.menuItem) {
      // 显示菜单项的详细信息
      const [menuType, indexStr] = element.id.split('[');
      const index = parseInt(indexStr.replace(']', ''));
      const menuItem = this.pkgJson.contributes.menus[menuType][index];

      if (menuItem) {
        const details: MenuNode[] = [];

        Object.keys(menuItem).forEach(key => {
          const value = menuItem[key];
          let displayValue = '';

          if (typeof value === 'object') {
            displayValue = JSON.stringify(value, null, 2);
          } else {
            displayValue = String(value);
          }

          const icon = this.iconManager.getIconForPropertyType(value);

          details.push(
            new MenuNode(
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

  getTreeItem(element: MenuNode): MenuNode {
    if (element.type === NodeType.error || element.type === NodeType.info) {
      return element;
    }

    if (element.type === NodeType.menuItem) {
      const treeItem = element;
      treeItem.command = {
        command: 'vedh.menus.edit',
        title: 'Edit',
        arguments: [element]
      };
      return treeItem;
    }

    return element;
  }

  private _onDidChangeTreeData: vscode.EventEmitter<MenuNode | undefined | null | void>
    = new vscode.EventEmitter<MenuNode | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<MenuNode | undefined | null | void>
    = this._onDidChangeTreeData.event;

  refresh(): void {
    if (this.pkgPath && this.fileExist(this.pkgPath)) {
      this.hasPackageJson = true;
      this.parsePackageJson(this.pkgPath);
    } else {
      this.hasPackageJson = false;
    }

    this._onDidChangeTreeData.fire();
    console.log("Menus view refreshed");
  }

  async editMenu(node: MenuNode): Promise<void> {
    console.log("Edit menu: ", node);

    if (!this.pkgPath) {
      vscode.window.showErrorMessage('无法找到 package.json 文件');
      return;
    }

    if (node.type === NodeType.menuItem) {
      try {
        const doc = await vscode.workspace.openTextDocument(this.pkgPath);
        const editor = await vscode.window.showTextDocument(doc);
        const text = doc.getText();

        // 查找 menus 配置的位置
        const menusMatch = text.match(/"menus"\s*:\s*\{/);
        if (!menusMatch || menusMatch.index === undefined) {
          vscode.window.showWarningMessage('无法在 package.json 中找到 menus 配置');
          return;
        }

        // 找到对应的菜单项
        const [menuType] = node.id.split('[');
        const menuTypePattern = new RegExp(`"${menuType.replace(/\//g, '\\/')}"\\s*:\\s*\\[`);
        const menuTypeMatch = text.substring(menusMatch.index).match(menuTypePattern);

        if (menuTypeMatch && menuTypeMatch.index !== undefined) {
          const startPos = doc.positionAt(menusMatch.index + menuTypeMatch.index);
          editor.selection = new vscode.Selection(startPos, startPos);
          editor.revealRange(
            new vscode.Range(startPos, startPos),
            vscode.TextEditorRevealType.InCenter
          );

          showNotification(`已定位到菜单: ${node.name}`);
        }
      } catch (error) {
        vscode.window.showErrorMessage(`打开文件失败: ${error}`);
      }
    }
  }

  async gotoMenuRegistration(node: MenuNode): Promise<void> {
    if (node.type !== NodeType.menuItem || !this.currentPath) {
      return;
    }

    // 获取菜单项的命令 ID
    const [menuType, indexStr] = node.id.split('[');
    const index = parseInt(indexStr.replace(']', ''));
    const menuItem = this.pkgJson?.contributes?.menus?.[menuType]?.[index];

    if (!menuItem) {
      return;
    }

    const commandId = menuItem.command || menuItem.submenu;
    if (!commandId) {
      vscode.window.showWarningMessage('菜单项没有关联的命令或子菜单');
      return;
    }

    // 显示加载提示
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: `正在搜索命令注册: ${commandId}`,
      cancellable: false
    }, async (progress) => {
      progress.report({ increment: 0 });

      try {
        // 使用 CodeNavigator 查找命令注册位置
        const location = await CodeNavigator.findCommandRegistration(
          commandId,
          this.currentPath!
        );

        progress.report({ increment: 100 });

        if (location) {
          // 直接跳转到命令注册位置
          await CodeNavigator.navigateToLocation(location);
        } else {
          // 未找到，提供搜索选项
          const choice = await vscode.window.showWarningMessage(
            `未找到命令 "${commandId}" 的注册位置`,
            '在所有文件中搜索',
            '查看 package.json',
            '取消'
          );

          if (choice === '在所有文件中搜索') {
            // 使用 VS Code 的全局搜索
            vscode.commands.executeCommand('workbench.action.findInFiles', {
              query: commandId,
              isRegex: false,
              isCaseSensitive: true
            });
          } else if (choice === '查看 package.json') {
            // 跳转到 package.json 中的菜单定义
            this.editMenu(node);
          }
        }
      } catch (error) {
        vscode.window.showErrorMessage(`搜索失败: ${error}`);
      }
    });
  }

  async deleteMenu(node: MenuNode): Promise<void> {
    if (!this.pkgPath || !this.pkgJson) {
      vscode.window.showErrorMessage('无法找到 package.json 文件');
      return;
    }

    // 可以删除 menuType (整个菜单类型) 或 menuItem (具体的菜单项)
    if (node.type !== NodeType.menuType && node.type !== NodeType.menuItem) {
      showNotification('只能删除菜单类型或具体的菜单项');
      return;
    }

    try {
      // 根据节点类型显示不同的确认信息
      let confirmMessage = '';
      if (node.type === NodeType.menuType) {
        const itemCount = this.pkgJson.contributes?.menus?.[node.name]?.length || 0;
        confirmMessage = `确定要删除整个菜单类型 "${node.name}" 及其下的 ${itemCount} 个菜单项吗？`;
      } else {
        // menuItem
        confirmMessage = `确定要删除菜单项 "${node.name}" 吗？`;
      }

      const confirm = await vscode.window.showWarningMessage(
        confirmMessage,
        { modal: true },
        '删除',
        '取消'
      );

      if (confirm !== '删除') {
        return;
      }

      // 读取 package.json
      const doc = await vscode.workspace.openTextDocument(this.pkgPath);
      const text = doc.getText();

      let deleteStart = -1;
      let deleteEnd = -1;

      if (node.type === NodeType.menuType) {
        // 删除整个菜单类型，例如 "view/title": [...]
        const menuTypeName = node.name;

        // 构建搜索模式，匹配整个菜单类型配置
        const menuTypePattern = new RegExp(
          `"${menuTypeName.replace(/\//g, '\\/')}"\\s*:\\s*\\[`,
          'g'
        );

        const match = menuTypePattern.exec(text);

        if (!match || match.index === undefined) {
          vscode.window.showErrorMessage(`无法找到菜单类型: ${menuTypeName}`);
          return;
        }

        // 找到数组的结束位置
        let bracketCount = 1;
        let currentIndex = match.index + match[0].length;
        let arrayEndIndex = -1;

        while (currentIndex < text.length && bracketCount > 0) {
          if (text[currentIndex] === '[') {
            bracketCount++;
          } else if (text[currentIndex] === ']') {
            bracketCount--;
            if (bracketCount === 0) {
              arrayEndIndex = currentIndex;
              break;
            }
          }
          currentIndex++;
        }

        if (arrayEndIndex === -1) {
          vscode.window.showErrorMessage('解析 package.json 失败');
          return;
        }

        // 找到这个属性的起始位置（包括属性名）
        let propStart = match.index;
        // 向前找到前面的引号
        while (propStart > 0 && text[propStart - 1] !== '\n') {
          propStart--;
        }

        deleteStart = propStart;
        deleteEnd = arrayEndIndex + 1;

        // 检查后面是否有逗号
        let checkIndex = deleteEnd;
        while (checkIndex < text.length && /\s/.test(text[checkIndex])) {
          checkIndex++;
        }
        if (text[checkIndex] === ',') {
          deleteEnd = checkIndex + 1;
        } else {
          // 检查前面是否有逗号
          checkIndex = deleteStart - 1;
          while (checkIndex >= 0 && /\s/.test(text[checkIndex])) {
            checkIndex--;
          }
          if (text[checkIndex] === ',') {
            deleteStart = checkIndex;
          }
        }

        // 包含后面的换行
        while (deleteEnd < text.length && text[deleteEnd] === '\n') {
          deleteEnd++;
        }

      } else {
        // 删除单个菜单项，node.type === NodeType.menuItem
        // node.id 格式为 "menuType[index]"
        const [menuType, indexStr] = node.id.split('[');
        const index = parseInt(indexStr.replace(']', ''));
        const menuItems = this.pkgJson.contributes.menus[menuType];

        if (!menuItems || !menuItems[index]) {
          vscode.window.showErrorMessage(`无法找到菜单项`);
          return;
        }

        const menuItem = menuItems[index];

        // 查找 menus 区域
        const menusMatch = text.match(/"menus"\s*:\s*\{/);
        if (!menusMatch || menusMatch.index === undefined) {
          vscode.window.showErrorMessage('无法找到 menus 配置');
          return;
        }

        // 查找对应的菜单类型
        const menuTypePattern = new RegExp(`"${menuType.replace(/\//g, '\\/')}"\\s*:\\s*\\[`);
        const menuTypeMatch = text.substring(menusMatch.index).match(menuTypePattern);

        if (!menuTypeMatch || menuTypeMatch.index === undefined) {
          vscode.window.showErrorMessage(`无法找到菜单类型: ${menuType}`);
          return;
        }

        const menuTypeStartIndex = menusMatch.index + menuTypeMatch.index + menuTypeMatch[0].length;

        // 构建搜索模式，查找包含这个菜单项的对象
        // 由于菜单项可能有多个属性，我们需要找到匹配的对象
        const menuItemString = JSON.stringify(menuItem);
        const menuItemIndex = text.indexOf(menuItemString, menuTypeStartIndex);

        if (menuItemIndex === -1) {
          // 如果精确匹配失败，尝试更灵活的匹配
          vscode.window.showWarningMessage('使用灵活匹配删除菜单项');

          // 尝试通过 command 或其他唯一标识符查找
          const commandId = menuItem.command || menuItem.submenu;
          if (commandId) {
            const pattern = new RegExp(
              `\\{[^}]*"(?:command|submenu)"\\s*:\\s*"${commandId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^}]*"when"\\s*:\\s*"${(menuItem.when || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^}]*\\}`,
              'gs'
            );

            const match = pattern.exec(text.substring(menuTypeStartIndex));
            if (match && match.index !== undefined) {
              const absoluteIndex = menuTypeStartIndex + match.index;
              deleteStart = absoluteIndex;
              deleteEnd = absoluteIndex + match[0].length;
            } else {
              vscode.window.showErrorMessage('无法找到菜单项配置');
              return;
            }
          } else {
            vscode.window.showErrorMessage('无法找到菜单项配置');
            return;
          }
        } else {
          deleteStart = menuItemIndex;
          deleteEnd = menuItemIndex + menuItemString.length;
        }

        // 处理逗号
        let checkIndex = deleteStart - 1;
        while (checkIndex >= 0 && /\s/.test(text[checkIndex])) {
          checkIndex--;
        }

        if (text[checkIndex] === ',') {
          deleteStart = checkIndex;
          while (deleteStart > 0 && /[\s\n]/.test(text[deleteStart - 1])) {
            deleteStart--;
          }
        } else {
          checkIndex = deleteEnd;
          while (checkIndex < text.length && /\s/.test(text[checkIndex])) {
            checkIndex++;
          }
          if (text[checkIndex] === ',') {
            deleteEnd = checkIndex + 1;
            while (deleteEnd < text.length && /[\s\n]/.test(text[deleteEnd])) {
              deleteEnd++;
            }
          }
        }
      }

      // 执行删除
      const editor = await vscode.window.showTextDocument(doc);
      const startPos = doc.positionAt(deleteStart);
      const endPos = doc.positionAt(deleteEnd);

      const success = await editor.edit(editBuilder => {
        editBuilder.delete(new vscode.Range(startPos, endPos));
      });

      if (success) {
        await doc.save();
        const deleteType = node.type === NodeType.menuType ? '菜单类型' : '菜单项';
        showNotification(`已删除 ${deleteType}: ${node.name}`);
        this.refresh();
      }
    } catch (error) {
      vscode.window.showErrorMessage(`删除失败: ${error}`);
    }
  }
}

enum NodeType {
  menuType,
  menuItem,
  property,
  error,
  info
}

class MenuNode extends vscode.TreeItem {
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

    switch (type) {
      case NodeType.menuType:
        this.contextValue = 'menuType';
        break;
      case NodeType.menuItem:
        this.contextValue = 'menuItem';
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

    if (type === NodeType.property) {
      this.tooltip = `${name}: ${description}`;
    }
  }
}
