import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 统一的图标管理器
 * 用于处理所有 TreeItem 的图标
 */
export class IconManager {
  private extensionPath: string;

  constructor(extensionPath: string) {
    this.extensionPath = extensionPath;
  }

  /**
   * 获取图标路径
   * @param iconName 图标名称，可以是：
   *   - 内置图标名（如 'gear', 'folder'）
   *   - SVG文件名（如 'icon.svg'）
   *   - null/undefined（显示默认图标）
   */
  getIcon(iconName: string | undefined): vscode.ThemeIcon | { light: string; dark: string } {
    if (!iconName) {
      return new vscode.ThemeIcon('circle-slash');
    }

    // 如果是 SVG 文件，尝试从 resources 目录加载
    if (iconName.endsWith('.svg')) {
      const lightPath = this.getIconPath('light', iconName);
      const darkPath = this.getIconPath('dark', iconName);

      if (fs.existsSync(lightPath) && fs.existsSync(darkPath)) {
        return {
          light: lightPath,
          dark: darkPath
        };
      }
      // 如果 SVG 文件不存在，fallback 到默认图标
      return new vscode.ThemeIcon('circle-slash');
    }

    // 检查是否是有效的内置图标
    if (this.isValidBuiltInIcon(iconName)) {
      return new vscode.ThemeIcon(iconName);
    }

    // 默认图标
    return new vscode.ThemeIcon('circle-slash');
  }

  /**
   * 根据属性类型获取合适的图标
   */
  getIconForPropertyType(value: any): string {
    if (typeof value === 'object') {
      return 'json';
    } else if (typeof value === 'boolean') {
      return 'symbol-boolean';
    } else if (typeof value === 'string') {
      return 'symbol-string';
    } else if (typeof value === 'number') {
      return 'symbol-numeric';
    }
    return 'symbol-property';
  }

  /**
   * 获取图标文件路径
   */
  private getIconPath(theme: string, iconName: string): string {
    return path.join(this.extensionPath, 'resources', theme, iconName);
  }

  /**
   * 检查是否是有效的内置图标
   */
  private isValidBuiltInIcon(iconName: string): boolean {
    return BUILT_IN_ICONS.includes(iconName);
  }
}

/**
 * VSCode 内置图标列表（Codicons）
 * 来源: https://code.visualstudio.com/api/references/icons-in-labels
 */
export const BUILT_IN_ICONS = [
  'account', 'activate-breakpoints', 'add', 'archive', 'arrow-both', 'arrow-circle-down',
  'arrow-circle-left', 'arrow-circle-right', 'arrow-circle-up', 'arrow-down', 'arrow-left',
  'arrow-right', 'arrow-small-down', 'arrow-small-left', 'arrow-small-right', 'arrow-small-up',
  'arrow-swap', 'arrow-up', 'azure-devops', 'azure', 'beaker-stop', 'beaker', 'bell-dot',
  'bell-slash', 'bell', 'blank', 'bold', 'book', 'bookmark', 'briefcase', 'broadcast',
  'browser', 'bug', 'calendar', 'call-incoming', 'call-outgoing', 'case-sensitive',
  'check-all', 'check', 'checklist', 'chevron-down', 'chevron-left', 'chevron-right',
  'chevron-up', 'chrome-close', 'chrome-maximize', 'chrome-minimize', 'chrome-restore',
  'circle-filled', 'circle-large-filled', 'circle-large-outline', 'circle-outline',
  'circle-slash', 'circle-small-filled', 'circuit-board', 'clear-all', 'clippy',
  'close-all', 'close', 'cloud-download', 'cloud-upload', 'cloud', 'code', 'coffee',
  'collapse-all', 'color-mode', 'combine', 'comment-discussion', 'comment-draft',
  'comment-unresolved', 'comment', 'compass-active', 'compass-dot', 'compass', 'console',
  'copy', 'credit-card', 'dash', 'dashboard', 'database', 'debug-all', 'debug-alt-small',
  'debug-alt', 'debug-breakpoint-conditional-unverified', 'debug-breakpoint-conditional',
  'debug-breakpoint-data-unverified', 'debug-breakpoint-data', 'debug-breakpoint-function-unverified',
  'debug-breakpoint-function', 'debug-breakpoint-log-unverified', 'debug-breakpoint-log',
  'debug-breakpoint-unsupported', 'debug-console', 'debug-continue', 'debug-coverage',
  'debug-disconnect', 'debug-line-by-line', 'debug-pause', 'debug-rerun', 'debug-restart-frame',
  'debug-restart', 'debug-reverse-continue', 'debug-stackframe-active', 'debug-stackframe-dot',
  'debug-stackframe', 'debug-start', 'debug-step-back', 'debug-step-into', 'debug-step-out',
  'debug-step-over', 'debug-stop', 'debug', 'desktop-download', 'device-camera-video',
  'device-camera', 'device-desktop', 'device-mobile', 'diff-added', 'diff-ignored',
  'diff-modified', 'diff-removed', 'diff-renamed', 'diff', 'discard', 'edit', 'editor-layout',
  'ellipsis', 'empty-window', 'error-small', 'error', 'exclude', 'expand-all', 'export',
  'extensions', 'eye-closed', 'eye-watch', 'eye', 'feedback', 'file-add', 'file-binary',
  'file-code', 'file-media', 'file-pdf', 'file-submodule', 'file-symlink-directory',
  'file-symlink-file', 'file-zip', 'file', 'files', 'filter-filled', 'filter', 'flame',
  'fold-down', 'fold-up', 'fold', 'folder-active', 'folder-library', 'folder-opened',
  'folder', 'game', 'gear', 'gift', 'gist-new', 'gist-secret', 'gist', 'git-commit',
  'git-compare', 'git-merge', 'git-pull-request-closed', 'git-pull-request-create',
  'git-pull-request-draft', 'git-pull-request-go-to-changes', 'git-pull-request', 'github-action',
  'github-alt', 'github-inverted', 'github', 'globe', 'go-to-file', 'grabber', 'graph-left',
  'graph-line', 'graph-scatter', 'graph', 'gripper', 'group-by-ref-type', 'heart-filled',
  'heart', 'history', 'home', 'horizontal-rule', 'hubot', 'inbox', 'indent', 'info',
  'insert', 'inspect', 'issue-closed', 'issue-draft', 'issue-reopened', 'issues',
  'italic', 'jersey', 'json', 'kebab-vertical', 'key', 'law', 'layers-active', 'layers-dot',
  'layers', 'layout-activitybar-left', 'layout-activitybar-right', 'layout-centered',
  'layout-menubar', 'layout-panel-center', 'layout-panel-justify', 'layout-panel-left',
  'layout-panel-off', 'layout-panel-right', 'layout-panel', 'layout-sidebar-left-off',
  'layout-sidebar-left', 'layout-sidebar-right-off', 'layout-sidebar-right', 'layout-statusbar',
  'layout', 'library', 'lightbulb-autofix', 'lightbulb-sparkle', 'lightbulb', 'link-external',
  'link', 'list-filter', 'list-flat', 'list-ordered', 'list-selection', 'list-tree',
  'list-unordered', 'live-share', 'loading', 'location', 'lock-small', 'lock', 'magnet',
  'mail-read', 'mail-reply', 'mail', 'map-filled', 'map', 'markdown', 'megaphone', 'mention',
  'menu', 'merge', 'milestone', 'mirror', 'modifier-key', 'mortar-board', 'move', 'multi-select',
  'multiple-windows', 'music', 'mute', 'newline', 'no-newline', 'note', 'notebook-template',
  'notebook', 'octoface', 'open-preview', 'organization', 'output', 'package', 'paintcan',
  'pass-filled', 'pass', 'percentage', 'person-add', 'person', 'pie-chart', 'pin', 'pinned-dirty',
  'pinned', 'play-circle', 'play', 'plug', 'preserve-case', 'preview', 'primitive-square',
  'project', 'pulse', 'question', 'quote', 'radio-tower', 'reactions', 'record-keys',
  'record-small', 'record', 'redo', 'references', 'refresh', 'regex', 'remote-explorer',
  'remote', 'remove', 'replace-all', 'replace', 'reply', 'repo-clone', 'repo-force-push',
  'repo-forked', 'repo-pull', 'repo-push', 'repo', 'report', 'request-changes', 'robot',
  'rocket', 'root-folder-opened', 'root-folder', 'rss', 'ruby', 'run-above', 'run-all',
  'run-below', 'run-errors', 'save-all', 'save-as', 'save', 'screen-full', 'screen-normal',
  'search-fuzzy', 'search-stop', 'search', 'send', 'server-environment', 'server-process',
  'server', 'settings-gear', 'settings', 'share', 'shield', 'sign-in', 'sign-out',
  'smiley', 'sort-precedence', 'source-control', 'sparkle-filled', 'sparkle', 'split-horizontal',
  'split-vertical', 'squirrel', 'star-empty', 'star-full', 'star-half', 'stop-circle',
  'symbol-array', 'symbol-boolean', 'symbol-class', 'symbol-color', 'symbol-constant',
  'symbol-enum-member', 'symbol-enum', 'symbol-event', 'symbol-field', 'symbol-file',
  'symbol-interface', 'symbol-key', 'symbol-keyword', 'symbol-method', 'symbol-misc',
  'symbol-namespace', 'symbol-numeric', 'symbol-operator', 'symbol-parameter', 'symbol-property',
  'symbol-ruler', 'symbol-snippet', 'symbol-string', 'symbol-structure', 'symbol-variable',
  'sync-ignored', 'sync', 'table', 'tag', 'target', 'tasklist', 'telescope', 'terminal-bash',
  'terminal-cmd', 'terminal-debian', 'terminal-linux', 'terminal-powershell', 'terminal-tmux',
  'terminal-ubuntu', 'terminal', 'text-size', 'three-bars', 'thumbsdown', 'thumbsup',
  'tools', 'trash', 'triangle-down', 'triangle-left', 'triangle-right', 'triangle-up',
  'twitter', 'type-hierarchy-sub', 'type-hierarchy-super', 'type-hierarchy', 'unfold',
  'ungroup-by-ref-type', 'unlock', 'unmute', 'unverified', 'variable-group', 'verified-filled',
  'verified', 'versions', 'vm-active', 'vm-connect', 'vm-outline', 'vm-running', 'vm',
  'wand', 'warning', 'watch', 'whitespace', 'whole-word', 'window', 'word-wrap',
  'workspace-trusted', 'workspace-unknown', 'workspace-untrusted', 'zoom-in', 'zoom-out'
];

/**
 * 常用图标快速选择列表（用于图标选择器）
 */
export const COMMON_ICONS = [
  // 操作类
  { label: '$(sync)', description: '同步/刷新', icon: 'sync' },
  { label: '$(sync~spin)', description: '同步旋转动画', icon: 'sync~spin' },
  { label: '$(edit)', description: '编辑', icon: 'edit' },
  { label: '$(add)', description: '添加', icon: 'add' },
  { label: '$(remove)', description: '删除', icon: 'remove' },
  { label: '$(trash)', description: '垃圾桶', icon: 'trash' },
  { label: '$(save)', description: '保存', icon: 'save' },
  { label: '$(save-all)', description: '全部保存', icon: 'save-all' },
  { label: '$(copy)', description: '复制', icon: 'copy' },
  { label: '$(close)', description: '关闭', icon: 'close' },
  { label: '$(check)', description: '勾选', icon: 'check' },
  { label: '$(check-all)', description: '全选', icon: 'check-all' },

  // 文件和文件夹
  { label: '$(file)', description: '文件', icon: 'file' },
  { label: '$(file-code)', description: '代码文件', icon: 'file-code' },
  { label: '$(folder)', description: '文件夹', icon: 'folder' },
  { label: '$(folder-opened)', description: '打开的文件夹', icon: 'folder-opened' },
  { label: '$(files)', description: '多个文件', icon: 'files' },
  { label: '$(new-file)', description: '新文件', icon: 'new-file' },
  { label: '$(new-folder)', description: '新文件夹', icon: 'new-folder' },

  // 导航和箭头
  { label: '$(arrow-right)', description: '右箭头', icon: 'arrow-right' },
  { label: '$(arrow-left)', description: '左箭头', icon: 'arrow-left' },
  { label: '$(arrow-up)', description: '上箭头', icon: 'arrow-up' },
  { label: '$(arrow-down)', description: '下箭头', icon: 'arrow-down' },
  { label: '$(chevron-right)', description: '右尖括号', icon: 'chevron-right' },
  { label: '$(chevron-left)', description: '左尖括号', icon: 'chevron-left' },
  { label: '$(chevron-up)', description: '上尖括号', icon: 'chevron-up' },
  { label: '$(chevron-down)', description: '下尖括号', icon: 'chevron-down' },

  // 状态和通知
  { label: '$(error)', description: '错误', icon: 'error' },
  { label: '$(warning)', description: '警告', icon: 'warning' },
  { label: '$(info)', description: '信息', icon: 'info' },
  { label: '$(bell)', description: '铃铛/通知', icon: 'bell' },
  { label: '$(pass)', description: '通过', icon: 'pass' },
  { label: '$(circle-filled)', description: '实心圆', icon: 'circle-filled' },

  // 搜索和过滤
  { label: '$(search)', description: '搜索', icon: 'search' },
  { label: '$(filter)', description: '过滤', icon: 'filter' },
  { label: '$(zoom-in)', description: '放大', icon: 'zoom-in' },
  { label: '$(zoom-out)', description: '缩小', icon: 'zoom-out' },

  // 开发工具
  { label: '$(code)', description: '代码', icon: 'code' },
  { label: '$(terminal)', description: '终端', icon: 'terminal' },
  { label: '$(debug)', description: '调试', icon: 'debug' },
  { label: '$(debug-start)', description: '开始调试', icon: 'debug-start' },
  { label: '$(debug-pause)', description: '暂停调试', icon: 'debug-pause' },
  { label: '$(debug-stop)', description: '停止调试', icon: 'debug-stop' },
  { label: '$(bug)', description: 'Bug', icon: 'bug' },
  { label: '$(testing-passed-icon)', description: '测试通过', icon: 'testing-passed-icon' },
  { label: '$(testing-failed-icon)', description: '测试失败', icon: 'testing-failed-icon' },

  // Git
  { label: '$(git-commit)', description: 'Git提交', icon: 'git-commit' },
  { label: '$(git-branch)', description: 'Git分支', icon: 'git-branch' },
  { label: '$(git-merge)', description: 'Git合并', icon: 'git-merge' },
  { label: '$(git-pull-request)', description: 'PR', icon: 'git-pull-request' },
  { label: '$(source-control)', description: '源代码管理', icon: 'source-control' },

  // 多媒体和控制
  { label: '$(play)', description: '播放', icon: 'play' },
  { label: '$(stop)', description: '停止', icon: 'stop' },
  { label: '$(pause)', description: '暂停', icon: 'pause' },
  { label: '$(record)', description: '录制', icon: 'record' },

  // 设置和配置
  { label: '$(settings)', description: '设置', icon: 'settings' },
  { label: '$(gear)', description: '齿轮', icon: 'gear' },
  { label: '$(wrench)', description: '扳手', icon: 'wrench' },
  { label: '$(tools)', description: '工具', icon: 'tools' },

  // 扩展和插件
  { label: '$(extensions)', description: '扩展', icon: 'extensions' },
  { label: '$(package)', description: '包', icon: 'package' },
  { label: '$(plug)', description: '插件', icon: 'plug' },

  // 符号和对象
  { label: '$(symbol-method)', description: '方法符号', icon: 'symbol-method' },
  { label: '$(symbol-class)', description: '类符号', icon: 'symbol-class' },
  { label: '$(symbol-property)', description: '属性符号', icon: 'symbol-property' },
  { label: '$(symbol-event)', description: '事件符号', icon: 'symbol-event' },
  { label: '$(symbol-variable)', description: '变量符号', icon: 'symbol-variable' },
  { label: '$(symbol-function)', description: '函数符号', icon: 'symbol-function' },

  // 界面元素
  { label: '$(window)', description: '窗口', icon: 'window' },
  { label: '$(layout)', description: '布局', icon: 'layout' },
  { label: '$(list-tree)', description: '树形列表', icon: 'list-tree' },
  { label: '$(menu)', description: '菜单', icon: 'menu' },
  { label: '$(home)', description: '主页', icon: 'home' },
  { label: '$(dashboard)', description: '仪表盘', icon: 'dashboard' },

  // 其他
  { label: '$(rocket)', description: '火箭', icon: 'rocket' },
  { label: '$(star)', description: '星星', icon: 'star-full' },
  { label: '$(heart)', description: '心形', icon: 'heart' },
  { label: '$(lightbulb)', description: '灯泡', icon: 'lightbulb' },
  { label: '$(eye)', description: '眼睛', icon: 'eye' },
  { label: '$(book)', description: '书籍', icon: 'book' },
  { label: '$(lock)', description: '锁定', icon: 'lock' },
  { label: '$(unlock)', description: '解锁', icon: 'unlock' },
  { label: '$(key)', description: '钥匙', icon: 'key' },
  { label: '$(shield)', description: '盾牌', icon: 'shield' },
  { label: '$(cloud)', description: '云', icon: 'cloud' },
  { label: '$(database)', description: '数据库', icon: 'database' },
  { label: '$(server)', description: '服务器', icon: 'server' },
  { label: '$(globe)', description: '地球', icon: 'globe' },
  { label: '$(link)', description: '链接', icon: 'link' },
  { label: '$(mail)', description: '邮件', icon: 'mail' },
  { label: '$(json)', description: 'JSON', icon: 'json' },
];
