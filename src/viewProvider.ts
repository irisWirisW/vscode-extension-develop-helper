import * as vscode from 'vscode';
import { IconManager } from './iconManager';
import { FileUtils } from './utils/fileUtils';
import { showNotification } from './utils/notificationManager';
import { CodeNavigator } from './utils/codeNavigator';

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
    this.pkgPath = FileUtils.getPackageJsonPath(currentPath);

    if (FileUtils.exists(this.pkgPath)) {
      console.log("file exist: ", this.pkgPath);
      this.parsePackageJson(this.pkgPath!);
    }

    // 注册编辑命令
    context.subscriptions.push(
      vscode.commands.registerCommand('vedh.views.edit', (node: nodeView) => {
        this.editNode(node);
      })
    );

    // 注册刷新命令
    context.subscriptions.push(
      vscode.commands.registerCommand('vedh.views.refresh', () => {
        this.refresh();
      })
    );

    // 注册新增 view 命令
    context.subscriptions.push(
      vscode.commands.registerCommand('vedh.views.add', () => {
        this.addView();
      })
    );

    // 注册删除 view 命令
    context.subscriptions.push(
      vscode.commands.registerCommand('vedh.views.delete', (node: nodeView) => {
        this.deleteView(node);
      })
    );

    // 注册跳转到代码位置命令
    context.subscriptions.push(
      vscode.commands.registerCommand('vedh.views.goto.registration', (node: nodeView) => {
        this.gotoViewRegistration(node);
      })
    );
  }


  parsePackageJson(pkgPath: string) {
    const json = FileUtils.readJsonFile(pkgPath);
    if (json) {
      this.pkgJson = json;
      console.log("package.json: ", json["contributes"]?.["views"]);
    } else {
      console.error("Failed to parse package.json:", pkgPath);
      this.pkgJson = null;
    }
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
            // 使用 "viewContainer:viewId" 格式存储完整信息
            const fullId = `${element.name}:${item.id}`;
            return new nodeView(nodeType.level2, item.name, item.id, fullId, vscode.TreeItemCollapsibleState.Collapsed, item.icon, this.iconManager);
          });
          return Promise.resolve(lv1List);
        case nodeType.level2: // 加载子项的详细内容
        case nodeType.level3:
        default:
          // 解析 "viewContainer:viewId" 格式
          const [containerName, viewId] = element.id.split(":");
          const viewItem = this.pkgJson.contributes.views[containerName]?.filter((item: any) => item.id === viewId)[0];

          if (!viewItem) {
            return Promise.resolve([]);
          }

          return Promise.resolve(
            Object.keys(viewItem).map(key => {
              const value = viewItem[key];
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
      command: 'vedh.views.edit',
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
    // 重新解析 package.json
    if (FileUtils.exists(this.pkgPath)) {
      this.parsePackageJson(this.pkgPath!);
    }

    this._onDidChangeTreeData.fire();
    console.log("refresh");
  }

  editNode(node: nodeView): void {
    console.log("editNode: ", node);
    showNotification(`Editing node: ${node.name}`);
  }

  async gotoViewRegistration(node: nodeView): Promise<void> {
    // 只对 level2 (具体的 view) 有效
    if (node.type !== nodeType.level2 || !this.currentPath) {
      return;
    }

    // node.description 存储的是真实的 viewId
    const viewId = node.description;
    if (!viewId) {
      return;
    }

    // 显示加载提示
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: `正在搜索视图注册: ${viewId}`,
      cancellable: false
    }, async (progress) => {
      progress.report({ increment: 0 });

      try {
        // 使用 CodeNavigator 查找视图注册位置
        const location = await CodeNavigator.findViewRegistration(
          viewId,
          this.currentPath!
        );

        progress.report({ increment: 100 });

        if (location) {
          // 直接跳转到视图注册位置
          await CodeNavigator.navigateToLocation(location);
        } else {
          // 未找到，提供搜索选项
          const choice = await vscode.window.showWarningMessage(
            `未找到视图 "${viewId}" 的注册位置`,
            '在所有文件中搜索',
            '查看 package.json',
            '取消'
          );

          if (choice === '在所有文件中搜索') {
            // 使用 VS Code 的全局搜索
            vscode.commands.executeCommand('workbench.action.findInFiles', {
              query: viewId,
              isRegex: false,
              isCaseSensitive: true
            });
          } else if (choice === '查看 package.json') {
            // 跳转到 package.json 中的视图定义
            if (this.pkgPath) {
              const doc = await vscode.workspace.openTextDocument(this.pkgPath);
              await vscode.window.showTextDocument(doc);
            }
          }
        }
      } catch (error) {
        vscode.window.showErrorMessage(`搜索失败: ${error}`);
      }
    });
  }

  async addView(): Promise<void> {
    if (!this.pkgPath || !this.pkgJson) {
      vscode.window.showErrorMessage('无法找到 package.json 文件');
      return;
    }

    try {
      // 获取所有可用的 viewContainer
      const viewContainers = Object.keys(this.pkgJson.contributes?.views || {});

      if (viewContainers.length === 0) {
        vscode.window.showErrorMessage('package.json 中没有定义 views 配置');
        return;
      }

      // 让用户选择要添加到哪个 viewContainer
      const selectedContainer = await vscode.window.showQuickPick(viewContainers, {
        placeHolder: '选择要添加 view 的容器',
        title: '选择 ViewContainer'
      });

      if (!selectedContainer) {
        return;
      }

      // 输入 view ID
      const viewId = await vscode.window.showInputBox({
        prompt: '输入 view 的 ID',
        placeHolder: '例如: myExtension.myView',
        validateInput: (value) => {
          if (!value) {
            return '请输入 view ID';
          }
          // 检查是否已存在
          const exists = this.pkgJson.contributes.views[selectedContainer].some(
            (v: any) => v.id === value
          );
          if (exists) {
            return `ID "${value}" 已存在`;
          }
          return null;
        }
      });

      if (!viewId) {
        return;
      }

      // 输入 view 名称
      const viewName = await vscode.window.showInputBox({
        prompt: '输入 view 的显示名称',
        placeHolder: '例如: 我的视图',
        validateInput: (value) => {
          if (!value) {
            return '请输入 view 名称';
          }
          return null;
        }
      });

      if (!viewName) {
        return;
      }

      // 询问是否添加 when 条件
      const addWhen = await vscode.window.showQuickPick(['是', '否'], {
        placeHolder: '是否添加 when 条件？',
        title: '添加 when 条件'
      });

      let whenCondition = '';
      if (addWhen === '是') {
        const when = await vscode.window.showInputBox({
          prompt: '输入 when 条件',
          placeHolder: '例如: resourceFilename == package.json'
        });
        whenCondition = when || '';
      }

      // 构建新的 view 对象
      const newView: any = {
        id: viewId,
        name: viewName
      };

      if (whenCondition) {
        newView.when = whenCondition;
      }

      // 读取并修改 package.json
      const doc = await vscode.workspace.openTextDocument(this.pkgPath);
      const text = doc.getText();

      // 找到对应的 viewContainer 数组
      const viewsPattern = new RegExp(
        `"${selectedContainer}"\\s*:\\s*\\[`,
        'g'
      );
      const match = viewsPattern.exec(text);

      if (!match || match.index === undefined) {
        vscode.window.showErrorMessage(`无法找到 "${selectedContainer}" 配置`);
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

      // 检查数组是否为空
      const arrayContent = text.substring(match.index + match[0].length, arrayEndIndex).trim();
      const isEmpty = arrayContent.length === 0;

      // 构建插入的内容
      const indent = '        ';
      let insertContent = '';

      if (!isEmpty) {
        insertContent = ',\n';
      }

      insertContent += indent + '{\n';
      insertContent += indent + `  "id": "${newView.id}",\n`;
      insertContent += indent + `  "name": "${newView.name}"`;

      if (newView.when) {
        insertContent += ',\n' + indent + `  "when": "${newView.when}"`;
      }

      insertContent += '\n' + indent + '}';

      // 执行插入
      const editor = await vscode.window.showTextDocument(doc);
      const insertPos = doc.positionAt(arrayEndIndex);

      const success = await editor.edit(editBuilder => {
        editBuilder.insert(insertPos, insertContent);
      });

      if (success) {
        await doc.save();
        showNotification(`成功添加 view: ${viewName}`);
        this.refresh();
      }
    } catch (error) {
      vscode.window.showErrorMessage(`添加失败: ${error}`);
    }
  }

  async deleteView(node: nodeView): Promise<void> {
    if (!this.pkgPath || !this.pkgJson) {
      vscode.window.showErrorMessage('无法找到 package.json 文件');
      return;
    }

    // 可以删除 level1 (整个 viewContainer) 或 level2 (具体的 view)
    if (node.type !== nodeType.level1 && node.type !== nodeType.level2) {
      showNotification('只能删除 viewContainer 或具体的 view 项');
      return;
    }

    try {
      // 根据节点类型显示不同的确认信息
      let confirmMessage = '';
      if (node.type === nodeType.level1) {
        const viewCount = this.pkgJson.contributes?.views?.[node.name]?.length || 0;
        confirmMessage = `确定要删除整个 viewContainer "${node.name}" 及其下的 ${viewCount} 个 view 吗？`;
      } else {
        // level2: node.description 存储的是真实的 viewId
        confirmMessage = `确定要删除 view "${node.name}" (${node.description}) 吗？`;
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

      if (node.type === nodeType.level1) {
        // 删除整个 viewContainer，例如 "test": [...]
        const containerName = node.name;

        // 构建搜索模式，匹配整个 viewContainer 配置
        const containerPattern = new RegExp(
          `"${containerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s*:\\s*\\[`,
          'g'
        );

        const match = containerPattern.exec(text);

        if (!match || match.index === undefined) {
          vscode.window.showErrorMessage(`无法找到 viewContainer: ${containerName}`);
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
        // 删除单个 view，node.type === nodeType.level2
        // node.id 格式为 "viewContainer:viewId"，从 description 获取真实的 viewId
        const realViewId = node.description;

        // 构建搜索模式，查找包含这个 id 的对象
        const viewPattern = new RegExp(
          `\\{[^}]*"id"\\s*:\\s*"${realViewId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^}]*\\}`,
          'gs'
        );

        const match = viewPattern.exec(text);

        if (!match || match.index === undefined) {
          vscode.window.showErrorMessage(`无法找到 view: ${realViewId}`);
          return;
        }

        // 找到匹配的起始和结束位置
        let startIndex = match.index;
        let endIndex = match.index + match[0].length;

        deleteStart = startIndex;
        deleteEnd = endIndex;

        // 向前查找，跳过空白字符
        let checkIndex = startIndex - 1;
        while (checkIndex >= 0 && /\s/.test(text[checkIndex])) {
          checkIndex--;
        }

        // 如果前面是逗号，包含逗号一起删除
        if (text[checkIndex] === ',') {
          deleteStart = checkIndex;
          // 包含前面的换行和空白
          while (deleteStart > 0 && /[\s\n]/.test(text[deleteStart - 1])) {
            deleteStart--;
          }
        } else {
          // 否则检查后面是否有逗号
          checkIndex = endIndex;
          while (checkIndex < text.length && /\s/.test(text[checkIndex])) {
            checkIndex++;
          }
          if (text[checkIndex] === ',') {
            deleteEnd = checkIndex + 1;
            // 包含后面的换行
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
        const deleteType = node.type === nodeType.level1 ? 'viewContainer' : 'view';
        showNotification(`已删除 ${deleteType}: ${node.name}`);
        this.refresh();
      }
    } catch (error) {
      vscode.window.showErrorMessage(`删除失败: ${error}`);
    }
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

    // 设置 contextValue 用于右键菜单判断
    switch (type) {
      case nodeType.level1:
        this.contextValue = 'level1';
        break;
      case nodeType.level2:
        this.contextValue = 'level2';
        break;
      case nodeType.level3:
        this.contextValue = 'level3';
        break;
      default:
        this.contextValue = 'item';
        break;
    }
  }
}