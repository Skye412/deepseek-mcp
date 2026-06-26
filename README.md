# DeepSeek MCP 访问器

基于 [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) 的 DeepSeek AI 访问器，通过 Playwright 浏览器自动化与 [chat.deepseek.com](https://chat.deepseek.com) 交互，提供 6 个 AI 工具，可直接集成到 Claude Desktop App 或其他 MCP 客户端中使用。

## 功能特性

| 工具名称 | 说明 |
|---------|------|
| `deepseek_chat` | 通用对话工具 — 向 DeepSeek 发送提示并获取 AI 回复，适用于提问、写作、翻译等场景 |
| `deepseek_code_review` | 代码审查工具 — 分析代码中的潜在 Bug、性能问题，并给出改进建议 |
| `deepseek_evaluate_idea` | 创意评估工具 — 从创新性、可行性和研究价值三个维度评估技术方案 |
| `deepseek_explain` | 概念解释工具 — 按初级/中级/专家级别解释文本或概念 |
| `deepseek_summarize` | 文本摘要工具 — 提取文本要点，支持自定义摘要长度 |
| `deepseek_debug` | 调试辅助工具 — 分析错误信息、相关代码和上下文，提供解决方案 |

**核心能力：**

- 基于 Playwright 的 headless 浏览器自动化
- AES-256-GCM + PBKDF2 凭据加密存储
- 自动登录 DeepSeek 账户
- 交互式配置向导
- 完整的 TypeScript 类型定义

## 安装

### 前置条件

- Node.js >= 18.0.0
- npm >= 10.2.0

### 安装步骤

```bash
# 克隆仓库
git clone <repository-url>
cd deepseek-mcp

# 安装依赖
npm install

# 构建项目
npm run build
```

构建完成后，编译输出位于 `dist/` 目录。

## 配置

### 第一步：运行配置向导

```bash
npm run setup
```

配置向导会引导你完成以下步骤：

1. 输入你的 DeepSeek 账户邮箱
2. 输入你的 DeepSeek 账户密码（密码不显示）
3. 设置一个主密码（至少 8 位，用于加密凭据存储）
4. 确认主密码

凭据会以加密形式保存到 `~/.deepseek-mcp/credentials.enc`。

### 第二步：配置 Claude Desktop App

在 Claude Desktop App 的配置文件中添加 MCP 服务器配置：

**macOS：** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows：** `%APPDATA%\Claude\claude_desktop_config.json`

#### 使用源码运行（开发模式）：

```json
{
  "mcpServers": {
    "deepseek": {
      "command": "npx",
      "args": [
        "tsx",
        "/path/to/deepseek-mcp/src/index.ts"
      ],
      "env": {
        "DEEPSEEK_MASTER_PASSWORD": "<你的主密码>"
      }
    }
  }
}
```

#### 使用构建后的代码运行（生产模式）：

```json
{
  "mcpServers": {
    "deepseek": {
      "command": "node",
      "args": [
        "/path/to/deepseek-mcp/dist/index.js"
      ],
      "env": {
        "DEEPSEEK_MASTER_PASSWORD": "<你的主密码>"
      }
    }
  }
}
```

> **注意：** 将 `<你的主密码>` 替换为你在配置向导中设置的主密码。请勿将密码提交到版本控制中。

配置完成后，重启 Claude Desktop App 即可使用 DeepSeek 工具。

## 使用示例

### 1. deepseek_chat — 通用对话

向 DeepSeek 发送任意提示，获取 AI 回复。适用于提问、写作、翻译等通用场景。

```json
{
  "name": "deepseek_chat",
  "arguments": {
    "prompt": "请用 Python 实现一个快速排序算法"
  }
}
```

### 2. deepseek_code_review — 代码审查

将代码发送给 DeepSeek 进行审查，获取问题分析和改进建议。可指定编程语言。

```json
{
  "name": "deepseek_code_review",
  "arguments": {
    "code": "function fibonacci(n) {\n  if (n <= 1) return n;\n  return fibonacci(n-1) + fibonacci(n-2);\n}",
    "language": "javascript"
  }
}
```

`language` 参数可选，省略时 DeepSeek 会自行判断语言。

### 3. deepseek_evaluate_idea — 创意评估

评估一个技术方案的创新性、可行性和研究价值。可提供额外的背景和约束条件。

```json
{
  "name": "deepseek_evaluate_idea",
  "arguments": {
    "idea": "使用多模态大语言模型进行跨语言代码迁移，自动将 Python 代码转换为等价的 Rust 代码并进行性能优化",
    "context": "目标是面向数据科学领域，需要保持数值计算的精度一致"
  }
}
```

`context` 参数可选。

### 4. deepseek_explain — 概念解释

按指定难度级别解释文本或概念，适合不同层次的学习需求。

```json
{
  "name": "deepseek_explain",
  "arguments": {
    "text": "Transformer 架构中的自注意力机制是如何工作的？",
    "level": "beginner"
  }
}
```

`level` 可选值：`beginner`（初级）、`intermediate`（中级，默认）、`expert`（专家）。

### 5. deepseek_summarize — 文本摘要

提取文本要点，生成摘要。支持自定义摘要最大长度。

```json
{
  "name": "deepseek_summarize",
  "arguments": {
    "text": "（此处填入需要摘要的长文本内容）...",
    "max_length": 500
  }
}
```

`max_length` 参数可选，单位为字符数。

### 6. deepseek_debug — 调试辅助

分析错误信息，提供可能的原因和解决方案。可附带相关代码和上下文。

```json
{
  "name": "deepseek_debug",
  "arguments": {
    "error": "TypeError: Cannot read properties of undefined (reading 'map')",
    "code": "const items = await fetchItems();\nreturn items.map(item => item.name);",
    "context": "fetchItems() 在网络请求失败时返回 undefined"
  }
}
```

`code` 和 `context` 参数均可选。

## 开发

### 可用脚本

| 命令 | 说明 |
|------|------|
| `npm run build` | 编译 TypeScript 到 `dist/` |
| `npm run dev` | 使用 tsx watch 模式启动开发服务器 |
| `npm start` | 运行构建后的生产版本 |
| `npm test` | 运行所有测试（vitest） |
| `npm run test:watch` | 以 watch 模式运行测试 |
| `npm run test:coverage` | 运行测试并生成覆盖率报告 |
| `npm run lint` | 检查代码风格 |
| `npm run lint:fix` | 自动修复代码风格问题 |
| `npm run typecheck` | 运行 TypeScript 类型检查 |
| `npm run setup` | 运行配置向导 |

### 项目结构

```
deepseek-mcp/
├── src/
│   ├── index.ts                 # MCP 服务器入口
│   ├── setup.ts                 # 配置向导
│   ├── browser-manager.ts       # Playwright 浏览器管理
│   ├── credential-manager.ts    # AES-256 凭据加密管理
│   ├── types/
│   │   └── index.ts             # TypeScript 类型定义
│   └── tools/
│       ├── chat.ts              # 通用对话工具
│       ├── code-review.ts       # 代码审查工具
│       ├── evaluate-idea.ts     # 创意评估工具
│       ├── explain.ts           # 概念解释工具
│       ├── summarize.ts         # 文本摘要工具
│       └── debug.ts             # 调试辅助工具
├── dist/                        # 编译输出
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── .eslintrc.json
```

### 运行测试

```bash
# 运行所有测试
npm test

# 以 watch 模式运行
npm run test:watch

# 生成覆盖率报告
npm run test:coverage
```

测试使用 [Vitest](https://vitest.dev/) 框架，测试文件位于 `src/` 目录下的 `*.test.ts` 文件中。

## 技术栈

| 技术 | 用途 |
|------|------|
| [Node.js](https://nodejs.org/) >= 18 | 运行时环境 |
| [TypeScript](https://www.typescriptlang.org/) 5.3 | 类型安全的开发语言 |
| [Model Context Protocol SDK](https://www.npmjs.com/package/@modelcontextprotocol/sdk) | MCP 服务器实现 |
| [Playwright](https://playwright.dev/) | 浏览器自动化，与 DeepSeek 网页交互 |
| [Vitest](https://vitest.dev/) | 单元测试框架 |
| [ESLint](https://eslint.org/) + @typescript-eslint | 代码质量检查 |

## 安全措施

本项目高度重视凭据安全，采用以下措施保护你的 DeepSeek 账户信息：

### 加密存储

- **加密算法：** AES-256-GCM（认证加密）
- **密钥派生：** PBKDF2（SHA-512），迭代 100,000 次
- **随机盐值：** 每次加密生成 16 字节随机盐
- **随机 IV：** 每次加密生成 12 字节随机初始化向量
- **认证标签：** GCM 模式自带完整性校验，防止篡改

### 文件权限

- 凭据目录 `~/.deepseek-mcp/` 权限为 `700`（仅所有者可访问）
- 凭据文件 `credentials.enc` 权限为 `600`（仅所有者可读写）

### 主密码保护

- 凭据通过用户设置的主密码加密存储，主密码本身不被保存
- 每次启动服务器时需要通过环境变量 `DEEPSEEK_MASTER_PASSWORD` 提供主密码
- 主密码最少 8 位字符

### 自动登录

服务器启动时使用存储的凭据自动登录 DeepSeek，登录完成后浏览器会保持会话状态，无需重复登录。

## 故障排除

### 问题：启动时报 "No credentials found"

**原因：** 尚未运行配置向导保存凭据。

**解决：** 运行 `npm run setup` 完成凭据配置。

### 问题：启动时报 "DEEPSEEK_MASTER_PASSWORD not set"

**原因：** 未在环境变量中设置主密码。

**解决：** 在 Claude Desktop App 配置文件的 `env` 中添加 `DEEPSEEK_MASTER_PASSWORD`，或在终端中设置环境变量。

### 问题：工具调用失败，提示 "Invalid master password"

**原因：** 提供的主密码与保存凭据时使用的不一致。

**解决：** 重新运行 `npm run setup` 重新配置凭据。

### 问题：浏览器初始化失败

**原因：** Playwright 浏览器未安装。

**解决：** 运行以下命令安装 Playwright 浏览器：

```bash
npx playwright install chromium
```

### 问题：工具调用超时

**原因：** DeepSeek 响应过慢或网络问题。

**解决：** 检查网络连接，确认 `chat.deepseek.com` 可以正常访问。DeepSeek 服务器繁忙时可能需要等待更长时间。

### 问题：构建失败

**原因：** TypeScript 编译错误。

**解决：** 运行 `npm run typecheck` 查看详细的类型错误信息，修复后重新构建。

## 许可证

[MIT License](LICENSE)
