# VSCode Extension Develop Helper

一个帮助开发者更方便地开发和管理 VSCode 扩展的辅助工具。

## 功能特性

- ✅ 可视化展示 `package.json` 中的 views 配置
- ✅ 树形结构展示扩展配置层次
- ✅ 支持深色/浅色主题
- ✅ 快速刷新配置
- 🚧 展示当前配置的指令（开发中）
- 🚧 展示注册的 view（开发中）

## 安装

### 从源码安装

1. 克隆仓库：
   ```bash
   git clone https://github.com/yourusername/vscode-extension-develop-helper.git
   cd vscode-extension-develop-helper
   ```

2. 安装依赖：
   ```bash
   npm install
   ```

3. 编译：
   ```bash
   npm run compile
   ```

4. 按 `F5` 启动调试

### 从 VSIX 安装

```bash
npm run package
code --install-extension ./out/vscode-extension-develop-helper-0.1.21.vsix
```

## 使用方法

1. 在 VSCode 中打开一个扩展项目
2. 在活动栏中点击"插件开发助手"图标
3. 查看项目的 views 配置

## 开发

详见 [DEVELOPMENT.md](./DEVELOPMENT.md)

快速开始：

```bash
# 安装依赖
npm install

# 启动监听模式
npm run watch

# 按 F5 启动调试
```

## 可用的 NPM 脚本

- `npm run compile` - 编译项目
- `npm run watch` - 监听模式
- `npm run lint` - 代码检查
- `npm run lint:fix` - 自动修复
- `npm test` - 运行测试
- `npm run package` - 打包扩展
- `npm run clean` - 清理输出
- `npm run rebuild` - 重新构建

## TODO

- [ ] 展示当前配置的指令
- [ ] 展示注册的 view
- [ ] 支持编辑配置
- [ ] 添加配置验证
- [ ] 支持更多配置项展示

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT
