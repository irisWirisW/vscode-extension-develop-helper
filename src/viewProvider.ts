import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { IconManager } from './iconManager';

// 1.传入当前的工作区文件夹地址
// 2.获取到package.json的路径
// 3.使用JSON分析package.json的结构，找到views字段
// 4.显示为treeitem
export class ViewProvider implements vscode.TreeDataProvider<nodeView> {


  pkgPath: string | undefined;
  pkgJson: any = undefined;
  viewNodes = [];
  private iconManager: IconManager;


  constructor(
    public context: vscode.ExtensionContext,
    public readonly currentPath: string | undefined
  ) {
    this.iconManager = new IconManager(context.extensionPath);

    // console.log("workspace address: ", currentPath);
    this.pkgPath = currentPath + "/package.json";

    if (this.fileExist(this.pkgPath) && this.pkgPath) {
      console.log("file exist: ", this.pkgPath);
      this.parsePackageJson(this.pkgPath);
    }

    context.subscriptions.push(
      vscode.commands.registerCommand('vedh.editNode', (node: nodeView) => {
        this.editNode(node);
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('vedh.refresh', () => {
        this.refresh();
      })
    );
  }

  fileExist(filePath: string | undefined): boolean {
    if (!filePath) {
      return false;
    }
    if (fs.existsSync(filePath)) {
      return true;
    } else {
      return false;
    }
  }

  parsePackageJson(pkgPath: string) {
    const data = fs.readFileSync(pkgPath, "utf-8");
    const json = JSON.parse(data);
    this.pkgJson = JSON.parse(data);
    console.log("package.json: ", json["contributes"]["views"]);
  }

  getChildren(element?: nodeView): Thenable<nodeView[]> {
    console.log("getChildren: ", element);

    // 检查是否有 package.json
    if (!this.pkgJson) {
      return Promise.resolve([
        new nodeView(
          nodeType.item,
          "不是一个标准的VSCode extension插件目录",
          "",
          "",
          vscode.TreeItemCollapsibleState.None,
          'error',
          this.iconManager
        )
      ]);
    }

    // 检查是否有 contributes.views
    if (!this.pkgJson.contributes || !this.pkgJson.contributes.views) {
      return Promise.resolve([
        new nodeView(
          nodeType.item,
          "当前插件没有定义任何视图",
          "",
          "",
          vscode.TreeItemCollapsibleState.None,
          'info',
          this.iconManager
        )
      ]);
    }

    if (!element) {
      return Promise.resolve(
        Object.keys(this.pkgJson.contributes.views).map(
          key => new nodeView(nodeType.level1, key, "lv1", key, vscode.TreeItemCollapsibleState.Collapsed, 'gear', this.iconManager)
        )
      );
    } else {
      switch (element.type) {
        case nodeType.level1: // 加载子项
          const lv1List: nodeView[] = this.pkgJson.contributes.views[element.name].map((item: any) => {
            return new nodeView(nodeType.level2, item.name, item.id, item.id, vscode.TreeItemCollapsibleState.Collapsed, item.icon, this.iconManager);
          });
          return Promise.resolve(lv1List);
        case nodeType.level2: // 加载子项的详细内容
        case nodeType.level3:
        default:
          const idprefix = element.id.split(".")[0];
          const aa = this.pkgJson.contributes.views[idprefix].filter((item: any) => item.id === element.id)[0];
          return Promise.resolve(
            Object.keys(aa).map(key => {
              const value = aa[key];
              const icon = this.iconManager.getIconForPropertyType(value);
              return new nodeView(nodeType.level3, value, key, "", vscode.TreeItemCollapsibleState.None, icon, this.iconManager);
            })
          );
      }
    }
  }

  getTreeItem(element: nodeView): nodeView {
    const treeItem = element;
    treeItem.command = {
      command: 'vedh.editNode',
      title: 'Edit',
      arguments: [element]
    };
    return treeItem;
  }

  private _onDidChangeTreeData: vscode.EventEmitter<nodeView | undefined | null | void>
    = new vscode.EventEmitter<nodeView | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<nodeView | undefined | null | void>
    = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
    console.log("refresh");
  }
  editNode(node: nodeView): void {
    console.log("editNode: ", node);
    vscode.window.showInformationMessage(`Editing node: ${node.name}`);
  }

}

enum nodeType {
  item,
  itemDetail,
  level1,
  level2,
  level3
}
class nodeView extends vscode.TreeItem {
  constructor(
    public readonly type: nodeType,
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
  }
}