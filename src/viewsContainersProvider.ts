import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { IconManager } from './iconManager';
import { showNotification } from './utils/notificationManager';

export class ViewsContainersProvider implements vscode.TreeDataProvider<ViewContainerNode> {

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
      vscode.commands.registerCommand('vedh.viewsContainers.edit', (node: ViewContainerNode) => {
        this.editViewContainer(node);
      })
    );

    // 注册刷新命令
    context.subscriptions.push(
      vscode.commands.registerCommand('vedh.viewsContainers.refresh', () => {
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
      console.log("ViewsContainers from package.json: ", this.pkgJson?.contributes?.viewsContainers);
    } catch (error) {
      console.error("Error parsing package.json: ", error);
      this.hasPackageJson = false;
    }
  }

  getChildren(element?: ViewContainerNode): Thenable<ViewContainerNode[]> {
    if (!this.hasPackageJson || !this.pkgJson) {
      return Promise.resolve([
        new ViewContainerNode(
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

    if (!this.pkgJson.contributes || !this.pkgJson.contributes.viewsContainers) {
      return Promise.resolve([
        new ViewContainerNode(
          NodeType.info,
          "当前插件没有定义任何视图容器",
          "",
          "",
          vscode.TreeItemCollapsibleState.None,
          "info",
          this.iconManager
        )
      ]);
    }

    if (!element) {
      // 返回所有容器位置类型（activitybar, panel 等）
      const viewsContainers = this.pkgJson.contributes.viewsContainers;
      return Promise.resolve(
        Object.keys(viewsContainers).map(location => {
          const count = viewsContainers[location].length;
          return new ViewContainerNode(
            NodeType.location,
            location,
            `${count} 个容器`,
            location,
            vscode.TreeItemCollapsibleState.Collapsed,
            'layout',
            this.iconManager
          );
        })
      );
    } else if (element.type === NodeType.location) {
      // 显示某个位置下的所有视图容器
      const containers = this.pkgJson.contributes.viewsContainers[element.id];
      return Promise.resolve(
        containers.map((container: any) => {
          return new ViewContainerNode(
            NodeType.container,
            container.title || container.id,
            container.id,
            container.id,
            vscode.TreeItemCollapsibleState.Collapsed,
            'window',
            this.iconManager
          );
        })
      );
    } else if (element.type === NodeType.container) {
      // 显示容器的详细信息
      const viewsContainers = this.pkgJson.contributes.viewsContainers;
      let container: any = null;

      for (const location of Object.keys(viewsContainers)) {
        container = viewsContainers[location].find((c: any) => c.id === element.id);
        if (container) break;
      }

      if (container) {
        const details: ViewContainerNode[] = [];

        Object.keys(container).forEach(key => {
          const value = container[key];
          let displayValue = '';

          if (typeof value === 'object') {
            displayValue = JSON.stringify(value, null, 2);
          } else {
            displayValue = String(value);
          }

          const icon = this.iconManager.getIconForPropertyType(value);

          details.push(
            new ViewContainerNode(
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

  getTreeItem(element: ViewContainerNode): ViewContainerNode {
    if (element.type === NodeType.error || element.type === NodeType.info) {
      return element;
    }

    if (element.type === NodeType.container) {
      const treeItem = element;
      treeItem.command = {
        command: 'vedh.viewsContainers.edit',
        title: 'Edit',
        arguments: [element]
      };
      return treeItem;
    }

    return element;
  }

  private _onDidChangeTreeData: vscode.EventEmitter<ViewContainerNode | undefined | null | void>
    = new vscode.EventEmitter<ViewContainerNode | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<ViewContainerNode | undefined | null | void>
    = this._onDidChangeTreeData.event;

  refresh(): void {
    if (this.pkgPath && this.fileExist(this.pkgPath)) {
      this.hasPackageJson = true;
      this.parsePackageJson(this.pkgPath);
    } else {
      this.hasPackageJson = false;
    }

    this._onDidChangeTreeData.fire();
    console.log("ViewsContainers view refreshed");
  }

  async editViewContainer(node: ViewContainerNode): Promise<void> {
    console.log("Edit view container: ", node);

    if (!this.pkgPath) {
      vscode.window.showErrorMessage('无法找到 package.json 文件');
      return;
    }

    if (node.type === NodeType.container) {
      try {
        const doc = await vscode.workspace.openTextDocument(this.pkgPath);
        const editor = await vscode.window.showTextDocument(doc);
        const text = doc.getText();

        // 查找容器在文件中的位置
        const searchPattern = new RegExp(
          `\\{[^}]*"id"\\s*:\\s*"${node.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^}]*\\}`,
          'gs'
        );

        const match = searchPattern.exec(text);
        if (match && match.index !== undefined) {
          const startPos = doc.positionAt(match.index);
          const endPos = doc.positionAt(match.index + match[0].length);

          editor.selection = new vscode.Selection(startPos, endPos);
          editor.revealRange(
            new vscode.Range(startPos, endPos),
            vscode.TextEditorRevealType.InCenter
          );

          showNotification(`已定位到视图容器: ${node.name}`);
        } else {
          vscode.window.showWarningMessage(`无法找到视图容器: ${node.id}`);
        }
      } catch (error) {
        vscode.window.showErrorMessage(`打开文件失败: ${error}`);
      }
    }
  }
}

enum NodeType {
  location,
  container,
  property,
  error,
  info
}

class ViewContainerNode extends vscode.TreeItem {
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
      case NodeType.location:
        this.contextValue = 'location';
        break;
      case NodeType.container:
        this.contextValue = 'container';
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
