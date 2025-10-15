import * as fs from 'fs';
import * as path from 'path';

/**
 * 文件系统相关的工具函数
 */
export class FileUtils {
  /**
   * 检查文件或目录是否存在
   * @param filePath 文件路径
   * @returns 文件是否存在
   */
  static exists(filePath: string | undefined): boolean {
    if (!filePath) {
      return false;
    }

    try {
      return fs.existsSync(filePath);
    } catch (error) {
      // 处理权限问题等异常情况
      console.warn(`Error checking file existence: ${filePath}`, error);
      return false;
    }
  }

  /**
   * 安全地读取文件内容
   * @param filePath 文件路径
   * @param encoding 编码格式，默认 utf-8
   * @returns 文件内容，如果读取失败返回 null
   */
  static readFile(filePath: string, encoding: BufferEncoding = 'utf-8'): string | null {
    if (!this.exists(filePath)) {
      return null;
    }

    try {
      return fs.readFileSync(filePath, encoding);
    } catch (error) {
      console.error(`Error reading file: ${filePath}`, error);
      return null;
    }
  }

  /**
   * 安全地读取并解析 JSON 文件
   * @param filePath JSON 文件路径
   * @returns 解析后的对象，如果失败返回 null
   */
  static readJsonFile(filePath: string): any | null {
    const content = this.readFile(filePath);
    if (!content) {
      return null;
    }

    try {
      return JSON.parse(content);
    } catch (error) {
      console.error(`Error parsing JSON file: ${filePath}`, error);
      return null;
    }
  }

  /**
   * 检查路径是否为有效的 package.json 文件
   * @param filePath 文件路径
   * @returns 是否为有效的 package.json
   */
  static isValidPackageJson(filePath: string): boolean {
    if (!this.exists(filePath)) {
      return false;
    }

    const json = this.readJsonFile(filePath);
    return json && typeof json === 'object' && json.name;
  }

  /**
   * 获取工作区的 package.json 路径
   * @param workspacePath 工作区路径
   * @returns package.json 的完整路径
   */
  static getPackageJsonPath(workspacePath: string | undefined): string | undefined {
    if (!workspacePath) {
      return undefined;
    }
    return path.join(workspacePath, 'package.json');
  }
}
