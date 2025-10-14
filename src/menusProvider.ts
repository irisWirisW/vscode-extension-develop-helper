import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { IconManager } from './iconManager';

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
      vscode.commands.registerCommand('vedh.editMenu', (node: MenuNode) => {
        this.editMenu(node);
      })
    );

    // 注册刷新命令
    context.subscriptions.push(
      vscode.commands.registerCommand('vedh.refreshMenus', () => {
        this.refresh();
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
        command: 'vedh.editMenu',
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

          vscode.window.showInformationMessage(`已定位到菜单: ${node.name}`);
        }
      } catch (error) {
        vscode.window.showErrorMessage(`打开文件失败: ${error}`);
      }
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
