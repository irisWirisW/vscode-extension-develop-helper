import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// 1.传入当前的工作区文件夹地址
// 2.获取到package.json的路径
// 3.使用JSON分析package.json的结构，找到views字段
// 4.显示为treeitem
export class ViewProvider implements vscode.TreeDataProvider<nodeView> {


  pkgPath: string | undefined;
  pkgJson: any = undefined;
  viewNodes = [];


  constructor(
    public context: vscode.ExtensionContext,
    public readonly currentPath: string | undefined
  ) {

    // console.log("workspace address: ", currentPath);
    this.pkgPath = currentPath + "/package.json";

    if (this.fileExist(this.pkgPath) && this.pkgPath) {
      console.log("file exist: ", this.pkgPath);
      this.parsePackageJson(this.pkgPath);
    }
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

    if (!element) {
      return Promise.resolve(
        Object.keys(this.pkgJson.contributes.views).map(
          key => new nodeView(key, key, vscode.TreeItemCollapsibleState.Collapsed, "type-hierarchy")
        )
      );
    } else {
      // 加载子项
      return Promise.resolve(
        this.pkgJson.contributes.views[element.label].map((item: any) => {
          return new nodeView(item.name, item.id, vscode.TreeItemCollapsibleState.None, item.icon || 'check');
        })
      );
    }
  }

  getTreeItem(element: nodeView): nodeView {
    return element;
  }

  private _onDidChangeTreeData: vscode.EventEmitter<nodeView | undefined | null | void>
    = new vscode.EventEmitter<nodeView | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<nodeView | undefined | null | void>
    = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
    console.log("refresh");
  }
  edit(): void { }

}


class nodeView extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public id: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public icon?: any,
    public readonly command?: vscode.Command
  ) {
    super(label, collapsibleState);
    this.description = id;
    this.iconPath = this.getIcon(this.icon);
  }

  getIcon(iconName: string | undefined): vscode.ThemeIcon | { light: string; dark: string } {
    // a.svg          √
    // right          √
    // notExist.svg   ⛌
    // notExist       ⛌
    // null           ⛌
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
      // If SVG files don't exist, fall through to default ThemeIcon
    }

    // Check if iconName is a valid built-in icon
    if (this.isValidBuiltInIcon(iconName)) {
      return new vscode.ThemeIcon(iconName);
    } else {
      return new vscode.ThemeIcon('circle-slash');
    }
  }
  private getIconPath(theme: string, iconName: string): string {
    return path.join(__dirname, '..', '..', 'resources', theme, iconName);
  }
  private isValidBuiltInIcon(iconName: string): boolean {
    // This is a partial list of built-in icons. You may need to update this list periodically.
    const builtInIcons = [
      'add', 'archive', 'arrow-both', 'arrow-down', 'arrow-left', 'arrow-right', 'arrow-up',
      'beaker', 'bell', 'bold', 'book', 'bookmark', 'briefcase', 'broadcast', 'browser',
      'bug', 'calendar', 'call-incoming', 'call-outgoing', 'case-sensitive', 'check',
      'checklist', 'chevron-down', 'chevron-left', 'chevron-right', 'chevron-up', 'chrome-close',
      'chrome-maximize', 'chrome-minimize', 'chrome-restore', 'circle-filled', 'circle-outline',
      'circle-slash', 'circuit-board', 'clear-all', 'clippy', 'close-all', 'cloud-download',
      'cloud-upload', 'code', 'collapse-all', 'color-mode', 'comment-discussion', 'compare-changes',
      'credit-card', 'dash', 'dashboard', 'database', 'debug-alt', 'debug-breakpoint-conditional',
      'debug-breakpoint-data', 'debug-breakpoint-function', 'debug-breakpoint-log',
      'debug-breakpoint-unsupported', 'debug-console', 'debug-continue', 'debug-disconnect',
      'debug-pause', 'debug-restart', 'debug-start', 'debug-step-back', 'debug-step-into',
      'debug-step-out', 'debug-step-over', 'debug-stop', 'desktop-download', 'device-camera-video',
      'device-camera', 'device-mobile', 'diff-added', 'diff-ignored', 'diff-modified', 'diff-removed',
      'diff-renamed', 'discard', 'edit', 'editor-layout', 'ellipsis', 'empty-window', 'error',
      'exclude', 'expand-all', 'extensions', 'eye-closed', 'eye', 'feedback', 'file-binary',
      'file-code', 'file-media', 'file-pdf', 'file-submodule', 'file-symlink-directory',
      'file-symlink-file', 'file-zip', 'files', 'filter', 'flame', 'fold-down', 'fold-up', 'folder',
      'gear', 'gift', 'gist-secret', 'gist', 'git-commit', 'git-compare', 'git-merge', 'git-pull-request',
      'github-action', 'github-alt', 'github-inverted', 'github', 'globe', 'go-to-file', 'grabber',
      'graph', 'gripper', 'heart', 'home', 'horizontal-rule', 'hubot', 'inbox', 'info', 'issue-closed',
      'issue-reopened', 'issues', 'italic', 'jersey', 'json', 'kebab-vertical', 'key', 'law',
      'lightbulb-autofix', 'link-external', 'link', 'list-ordered', 'list-unordered', 'live-share',
      'loading', 'location', 'mail-read', 'mail', 'markdown', 'megaphone', 'mention', 'milestone',
      'mortar-board', 'move', 'multiple-windows', 'mute', 'new-file', 'new-folder', 'no-newline',
      'note', 'octoface', 'open-preview', 'package', 'paintcan', 'pin', 'play-circle', 'play',
      'plug', 'preserve-case', 'preview', 'project', 'pulse', 'question', 'quote', 'radio-tower',
      'reactions', 'references', 'refresh', 'regex', 'remote-explorer', 'remote', 'remove', 'replace-all',
      'replace', 'repo-clone', 'repo-force-push', 'repo-pull', 'repo-push', 'repo', 'report', 'request-changes',
      'rocket', 'root-folder-opened', 'root-folder', 'rss', 'ruby', 'save-all', 'save-as', 'save',
      'screen-full', 'screen-normal', 'search-stop', 'search', 'server-environment', 'server-process',
      'server', 'settings-gear', 'settings', 'shield', 'sign-in', 'sign-out', 'smiley', 'sort-precedence',
      'split-horizontal', 'split-vertical', 'squirrel', 'star-full', 'star-half', 'symbol-array',
      'symbol-boolean', 'symbol-class', 'symbol-color', 'symbol-constant', 'symbol-enum-member',
      'symbol-enum', 'symbol-event', 'symbol-field', 'symbol-file', 'symbol-interface', 'symbol-key',
      'symbol-keyword', 'symbol-method', 'symbol-misc', 'symbol-namespace', 'symbol-numeric',
      'symbol-operator', 'symbol-parameter', 'symbol-property', 'symbol-ruler', 'symbol-snippet',
      'symbol-string', 'symbol-structure', 'symbol-variable', 'sync-ignored', 'sync', 'tag',
      'tasklist', 'telescope', 'terminal', 'text-size', 'three-bars', 'thumbsdown', 'thumbsup',
      'tools', 'trash', 'triangle-down', 'triangle-left', 'triangle-right', 'triangle-up', 'twitter',
      'unfold', 'unlock', 'unmute', 'unverified', 'verified', 'versions', 'vm-active', 'vm-outline',
      'vm-running', 'watch', 'whitespace', 'whole-word', 'window', 'word-wrap', 'zoom-in', 'zoom-out', 'type-hierarchy'
    ];

    return builtInIcons.includes(iconName);
  }
}