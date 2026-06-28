# DeepSeek MCP Server

基于 [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) 的 DeepSeek AI 服务器，通过 Playwright 浏览器自动化与 [chat.deepseek.com](https://chat.deepseek.com) 交互，提供 6 个 AI 工具，可集成到 Claude Desktop App 或其他 MCP 客户端中使用。

## 功能特性

### 6 个 AI 工具

| 工具名称 | 说明 |
|---------|------|
| `deepseek_chat` | 通用对话 — 支持三种模式、深度思考、联网搜索 |
| `deepseek_code_review` | 代码审查 — 分析 Bug、性能问题，给出改进建议 |
| `deepseek_evaluate_idea` | 创意评估 — 评估技术方案的创新性、可行性、研究价值 |
| `deepseek_explain` | 概念解释 — 按初级/中级/专家级别解释文本或概念 |
| `deepseek_summarize` | 文本摘要 — 提取文本要点，支持自定义长度 |
| `deepseek_debug` | 调试辅助 — 分析错误信息，提供解决方案 |

### 三种聊天模式

| 模式 | 说明 | DeepThink | 联网搜索 | 文件上传 |
|------|------|-----------|---------|---------|
| `quick` | 快速模式（默认） | ✅ | ✅ | ✅ |
| `expert` | 专家模式 | ✅ | ❌ | ❌ |
| `vision` | 识图模式 | ✅ | ❌ | ✅ |

### 核心能力

- **会话持久化** — 首次手动登录后，登录状态自动保存，重启无需重新登录
- **DeepThink 深度思考** — 所有模式均支持深度思考推理
- **Smart Search 联网搜索** — 快速模式下可开启联网搜索获取实时信息
- **Edge 浏览器** — 使用系统已安装的 Edge，无需额外下载
- **完整的 TypeScript 类型定义**

## 安装

### 前置条件

- Node.js >= 18.0.0
- Microsoft Edge 浏览器（Windows 自带）

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

## 配置

在 Claude Desktop App 的配置文件中添加 MCP 服务器：

**Windows：** `%APPDATA%\Claude\claude_desktop_config.json`
**macOS：** `~/Library/Application Support/Claude/claude_desktop_config.json`

### 开发模式（使用源码）：

```json
{
  "mcpServers": {
    "deepseek": {
      "command": "npx",
      "args": ["tsx", "C:/path/to/deepseek-mcp/src/index.ts"]
    }
  }
}
```

### 生产模式（使用构建后的代码）：

```json
{
  "mcpServers": {
    "deepseek": {
      "command": "node",
      "args": ["C:/path/to/deepseek-mcp/dist/index.js"]
    }
  }
}
```

配置完成后，重启 Claude Desktop App 即可使用。

### 首次使用

1. 首次调用工具时，会自动弹出 Edge 浏览器窗口
2. 在浏览器中手动登录 DeepSeek（手机号 + 验证码）
3. 登录成功后，会话自动保存到 `~/.deepseek-mcp/browser-data/`
4. 之后重启服务器会**自动恢复登录状态**，无需再手动登录（无头模式运行）

## 使用示例

### 1. 通用对话

```json
{
  "name": "deepseek_chat",
  "arguments": {
    "prompt": "请用 Python 实现一个快速排序算法"
  }
}
```

使用深度思考 + 联网搜索：

```json
{
  "name": "deepseek_chat",
  "arguments": {
    "prompt": "2024年诺贝尔物理学奖授予了谁？",
    "mode": "quick",
    "deepthink": true,
    "smartSearch": true
  }
}
```

使用专家模式 + 深度思考：

```json
{
  "name": "deepseek_chat",
  "arguments": {
    "prompt": "请详细分析黎曼猜想的意义和当前进展",
    "mode": "expert",
    "deepthink": true
  }
}
```

### 2. 代码审查

```json
{
  "name": "deepseek_code_review",
  "arguments": {
    "code": "function fibonacci(n) {\n  if (n <= 1) return n;\n  return fibonacci(n-1) + fibonacci(n-2);\n}",
    "language": "javascript",
    "deepthink": true
  }
}
```

### 3. 创意评估

```json
{
  "name": "deepseek_evaluate_idea",
  "arguments": {
    "idea": "使用多模态大语言模型进行跨语言代码迁移",
    "context": "目标是面向数据科学领域",
    "deepthink": true
  }
}
```

### 4. 概念解释

```json
{
  "name": "deepseek_explain",
  "arguments": {
    "text": "Transformer 架构中的自注意力机制",
    "level": "beginner"
  }
}
```

`level` 可选值：`beginner`（初级）、`intermediate`（中级，默认）、`expert`（专家）。

### 5. 文本摘要

```json
{
  "name": "deepseek_summarize",
  "arguments": {
    "text": "（此处填入需要摘要的长文本内容）...",
    "max_length": 500
  }
}
```

### 6. 调试辅助

```json
{
  "name": "deepseek_debug",
  "arguments": {
    "error": "TypeError: Cannot read properties of undefined (reading 'map')",
    "code": "const items = await fetchItems();\nreturn items.map(item => item.name);",
    "context": "fetchItems() 在网络请求失败时返回 undefined",
    "deepthink": true
  }
}
```

## 开发

### 可用脚本

| 命令 | 说明 |
|------|------|
| `npm run build` | 编译 TypeScript 到 `dist/` |
| `npm run dev` | 使用 ts-node 启动开发服务器 |
| `npm start` | 运行构建后的生产版本 |
| `npm test` | 运行所有测试 |
| `npm run test:watch` | 以 watch 模式运行测试 |
| `npm run typecheck` | 运行 TypeScript 类型检查 |
| `npm run lint` | 检查代码风格 |

### 项目结构

```
deepseek-mcp/
├── src/
│   ├── index.ts                 # MCP 服务器入口
│   ├── browser-manager.ts       # Playwright 浏览器管理（会话持久化）
│   ├── types/
│   │   └── index.ts             # TypeScript 类型定义
│   └── tools/
│       ├── deepseek-client.ts   # 核心浏览器自动化客户端
│       ├── chat.ts              # 通用对话工具
│       ├── code-review.ts       # 代码审查工具
│       ├── evaluate-idea.ts     # 创意评估工具
│       ├── explain.ts           # 概念解释工具
│       ├── summarize.ts         # 文本摘要工具
│       └── debug.ts             # 调试辅助工具
├── dist/                        # 编译输出
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## 故障排除

### 问题：浏览器启动失败

**解决：** 确认系统已安装 Microsoft Edge 浏览器。Windows 10/11 自带 Edge。

### 问题：登录状态丢失

**解决：** 删除 `~/.deepseek-mcp/browser-data/` 目录，重新启动服务器并手动登录。

### 问题：工具调用超时

**原因：** DeepSeek 响应过慢或网络问题。

**解决：** 检查网络连接，确认 `chat.deepseek.com` 可以正常访问。

### 问题：选择器找不到元素

**原因：** DeepSeek 更新了前端 UI。

**解决：** 这是浏览器自动化的固有局限。请更新 `deepseek-client.ts` 中的选择器常量。

## 技术栈

| 技术 | 用途 |
|------|------|
| [Node.js](https://nodejs.org/) >= 18 | 运行时环境 |
| [TypeScript](https://www.typescriptlang.org/) 5.x | 类型安全的开发语言 |
| [Model Context Protocol SDK](https://www.npmjs.com/package/@modelcontextprotocol/sdk) | MCP 服务器实现 |
| [Playwright](https://playwright.dev/) | 浏览器自动化 |
| [Vitest](https://vitest.dev/) | 单元测试框架 |

## 许可证

[MIT License](LICENSE)
