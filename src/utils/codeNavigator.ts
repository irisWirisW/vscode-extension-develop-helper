import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 代码导航工具
 * 用于在源代码中查找命令注册位置
 */
export class CodeNavigator {

  /**
   * 查找命令注册的位置
   * @param commandId 命令 ID（如 'vedh.views.refresh'）
   * @param workspacePath 工作区路径
   * @returns 命令注册的位置信息
   */
  static async findCommandRegistration(
    commandId: string,
    workspacePath: string
  ): Promise<CommandLocation | null> {
    // 搜索常见的源码目录
    const searchDirs = ['src', 'extension', 'lib', 'out', 'dist'];
    const fileExtensions = ['.ts', '.js', '.tsx', '.jsx'];

    for (const dir of searchDirs) {
      const searchPath = path.join(workspacePath, dir);
      if (!fs.existsSync(searchPath)) {
        continue;
      }

      const result = await this.searchInDirectory(
        searchPath,
        commandId,
        fileExtensions
      );

      if (result) {
        return result;
      }
    }

    // 如果在常见目录中没找到，搜索整个工作区
    return await this.searchInDirectory(
      workspacePath,
      commandId,
      fileExtensions,
      true
    );
  }

  /**
   * 在指定目录中搜索命令注册
   */
  private static async searchInDirectory(
    dirPath: string,
    commandId: string,
    extensions: string[],
    shallow: boolean = false
  ): Promise<CommandLocation | null> {
    try {
      const files = this.getAllFiles(dirPath, extensions, shallow);

      for (const file of files) {
        const result = await this.searchInFile(file, commandId);
        if (result) {
          return result;
        }
      }
    } catch (error) {
      console.error('Error searching directory:', error);
    }

    return null;
  }

  /**
   * 在文件中搜索命令注册
   */
  private static async searchInFile(
    filePath: string,
    commandId: string
  ): Promise<CommandLocation | null> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      // 搜索 registerCommand 相关的模式
      const patterns = [
        // vscode.commands.registerCommand('commandId', ...)
        new RegExp(`registerCommand\\s*\\(\\s*['"\`]${this.escapeRegex(commandId)}['"\`]`, 'g'),
        // commands.registerCommand('commandId', ...)
        new RegExp(`commands\\.registerCommand\\s*\\(\\s*['"\`]${this.escapeRegex(commandId)}['"\`]`, 'g'),
      ];

      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];

        for (const pattern of patterns) {
          const match = pattern.exec(line);
          if (match) {
            // 找到匹配项，获取上下文
            const contextStart = Math.max(0, lineIndex - 2);
            const contextEnd = Math.min(lines.length - 1, lineIndex + 10);
            const context = lines.slice(contextStart, contextEnd + 1).join('\n');

            return {
              filePath,
              line: lineIndex,
              column: match.index,
              context,
              matchText: match[0]
            };
          }
        }
      }
    } catch (error) {
      // 忽略无法读取的文件
    }

    return null;
  }

  /**
   * 递归获取目录下的所有文件
   */
  private static getAllFiles(
    dirPath: string,
    extensions: string[],
    shallow: boolean = false,
    maxDepth: number = 10,
    currentDepth: number = 0
  ): string[] {
    const files: string[] = [];

    if (currentDepth > maxDepth) {
      return files;
    }

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        // 跳过常见的排除目录
        if (entry.isDirectory()) {
          const skipDirs = ['node_modules', '.git', '.vscode', 'dist', 'build', 'coverage'];
          if (skipDirs.includes(entry.name)) {
            continue;
          }

          if (!shallow) {
            files.push(...this.getAllFiles(fullPath, extensions, false, maxDepth, currentDepth + 1));
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      // 忽略无法访问的目录
    }

    return files;
  }

  /**
   * 转义正则表达式特殊字符
   */
  private static escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 跳转到指定位置
   */
  static async navigateToLocation(location: CommandLocation): Promise<void> {
    try {
      const doc = await vscode.workspace.openTextDocument(location.filePath);
      const editor = await vscode.window.showTextDocument(doc);

      // 定位到具体行和列
      const position = new vscode.Position(location.line, location.column);
      editor.selection = new vscode.Selection(position, position);

      // 查找完整的命令注册语句（可能跨多行）
      const endPosition = this.findStatementEnd(doc, location.line);
      const range = new vscode.Range(
        new vscode.Position(location.line, 0),
        endPosition
      );

      editor.revealRange(range, vscode.TextEditorRevealType.InCenter);

      // 高亮显示找到的范围
      const decoration = vscode.window.createTextEditorDecorationType({
        backgroundColor: new vscode.ThemeColor('editor.findMatchHighlightBackground'),
        border: '1px solid',
        borderColor: new vscode.ThemeColor('editor.findMatchBorder')
      });

      editor.setDecorations(decoration, [range]);

      // 2秒后移除高亮
      setTimeout(() => {
        decoration.dispose();
      }, 2000);

    } catch (error) {
      vscode.window.showErrorMessage(`无法跳转到位置: ${error}`);
    }
  }

  /**
   * 查找语句的结束位置（处理跨行的情况）
   */
  private static findStatementEnd(
    doc: vscode.TextDocument,
    startLine: number
  ): vscode.Position {
    let line = startLine;
    let bracketCount = 0;
    let inStatement = false;

    // 最多向下查找 20 行
    const maxLines = Math.min(doc.lineCount, startLine + 20);

    for (line = startLine; line < maxLines; line++) {
      const lineText = doc.lineAt(line).text;

      for (let i = 0; i < lineText.length; i++) {
        const char = lineText[i];

        if (char === '(') {
          bracketCount++;
          inStatement = true;
        } else if (char === ')') {
          bracketCount--;

          if (inStatement && bracketCount === 0) {
            // 找到语句结束，继续向后找分号
            for (let j = i + 1; j < lineText.length; j++) {
              if (lineText[j] === ';') {
                return new vscode.Position(line, j + 1);
              } else if (lineText[j] !== ' ' && lineText[j] !== '\t') {
                // 遇到非空白字符但不是分号，返回当前位置
                return new vscode.Position(line, i + 1);
              }
            }
            // 行末没有分号，返回行末
            return new vscode.Position(line, lineText.length);
          }
        }
      }
    }

    // 如果没找到结束，返回当前行末
    return new vscode.Position(line - 1, doc.lineAt(line - 1).text.length);
  }

  /**
   * 使用 VS Code 的搜索 API（备用方案）
   */
  static async findCommandUsingSearch(commandId: string): Promise<vscode.Location[]> {
    const searchPattern = `registerCommand\\s*\\(\\s*['"\`]${commandId}['"\`]`;

    try {
      // 使用 workspace.findFiles 和 findTextInFiles
      const locations: vscode.Location[] = [];
      const files = await vscode.workspace.findFiles(
        '**/*.{ts,js,tsx,jsx}',
        '**/node_modules/**'
      );

      for (const file of files) {
        const doc = await vscode.workspace.openTextDocument(file);
        const text = doc.getText();
        const regex = new RegExp(searchPattern, 'g');
        let match;

        while ((match = regex.exec(text)) !== null) {
          const position = doc.positionAt(match.index);
          locations.push(new vscode.Location(file, position));
        }
      }

      return locations;
    } catch (error) {
      console.error('Error in workspace search:', error);
      return [];
    }
  }

  /**
   * 查找 ViewContainer 注册的位置
   * @param viewContainerId ViewContainer ID（如 'myExtension-explorer'）
   * @param workspacePath 工作区路径
   * @returns ViewContainer 注册的位置信息
   */
  static async findViewContainerRegistration(
    viewContainerId: string,
    workspacePath: string
  ): Promise<CommandLocation | null> {
    const searchDirs = ['src', 'extension', 'lib', 'out', 'dist'];
    const fileExtensions = ['.ts', '.js', '.tsx', '.jsx'];

    for (const dir of searchDirs) {
      const searchPath = path.join(workspacePath, dir);
      if (!fs.existsSync(searchPath)) {
        continue;
      }

      const result = await this.searchInDirectoryForPattern(
        searchPath,
        viewContainerId,
        fileExtensions,
        [
          // 搜索 viewContainer 相关的模式
          new RegExp(`['"\`]${this.escapeRegex(viewContainerId)}['"\`]`, 'g'),
        ]
      );

      if (result) {
        return result;
      }
    }

    return null;
  }

  /**
   * 查找 View 的 TreeDataProvider 注册位置
   * @param viewId View ID（如 'myExtension.myView'）
   * @param workspacePath 工作区路径
   * @returns View 注册的位置信息
   */
  static async findViewRegistration(
    viewId: string,
    workspacePath: string
  ): Promise<CommandLocation | null> {
    const searchDirs = ['src', 'extension', 'lib', 'out', 'dist'];
    const fileExtensions = ['.ts', '.js', '.tsx', '.jsx'];

    for (const dir of searchDirs) {
      const searchPath = path.join(workspacePath, dir);
      if (!fs.existsSync(searchPath)) {
        continue;
      }

      const result = await this.searchInDirectoryForPattern(
        searchPath,
        viewId,
        fileExtensions,
        [
          // registerTreeDataProvider
          new RegExp(`registerTreeDataProvider\\s*\\(\\s*['"\`]${this.escapeRegex(viewId)}['"\`]`, 'g'),
          // createTreeView
          new RegExp(`createTreeView\\s*\\(\\s*['"\`]${this.escapeRegex(viewId)}['"\`]`, 'g'),
          // 直接引用 viewId
          new RegExp(`['"\`]${this.escapeRegex(viewId)}['"\`]`, 'g'),
        ]
      );

      if (result) {
        return result;
      }
    }

    return null;
  }

  /**
   * 使用自定义模式在目录中搜索
   */
  private static async searchInDirectoryForPattern(
    dirPath: string,
    searchTerm: string,
    extensions: string[],
    patterns: RegExp[],
    shallow: boolean = false
  ): Promise<CommandLocation | null> {
    try {
      const files = this.getAllFiles(dirPath, extensions, shallow);

      for (const file of files) {
        const result = await this.searchInFileForPattern(file, patterns);
        if (result) {
          return result;
        }
      }
    } catch (error) {
      console.error('Error searching directory:', error);
    }

    return null;
  }

  /**
   * 在文件中使用自定义模式搜索
   */
  private static async searchInFileForPattern(
    filePath: string,
    patterns: RegExp[]
  ): Promise<CommandLocation | null> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];

        for (const pattern of patterns) {
          const match = pattern.exec(line);
          if (match) {
            // 找到匹配项，获取上下文
            const contextStart = Math.max(0, lineIndex - 2);
            const contextEnd = Math.min(lines.length - 1, lineIndex + 10);
            const context = lines.slice(contextStart, contextEnd + 1).join('\n');

            return {
              filePath,
              line: lineIndex,
              column: match.index,
              context,
              matchText: match[0]
            };
          }
        }
      }
    } catch (error) {
      // 忽略无法读取的文件
    }

    return null;
  }
}

/**
 * 命令位置信息
 */
export interface CommandLocation {
  filePath: string;
  line: number;
  column: number;
  context: string;
  matchText: string;
}
