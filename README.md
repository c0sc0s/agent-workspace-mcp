# agent-workspace-mcp

<div align="center">

TypeScript-aware MCP server for repository discovery, code intelligence, and web workspace context.

[![CI](https://github.com/c0sc0s/agent-workspace-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/c0sc0s/agent-workspace-mcp/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/c0sc0s/agent-workspace-mcp)](./LICENSE)
[![Stars](https://img.shields.io/github/stars/c0sc0s/agent-workspace-mcp?style=social)](https://github.com/c0sc0s/agent-workspace-mcp/stargazers)
[![Forks](https://img.shields.io/github/forks/c0sc0s/agent-workspace-mcp?style=social)](https://github.com/c0sc0s/agent-workspace-mcp/network/members)
[![Issues](https://img.shields.io/github/issues/c0sc0s/agent-workspace-mcp)](https://github.com/c0sc0s/agent-workspace-mcp/issues)
[![Last Commit](https://img.shields.io/github/last-commit/c0sc0s/agent-workspace-mcp)](https://github.com/c0sc0s/agent-workspace-mcp/commits/main)
[![Node](https://img.shields.io/badge/node-%3E%3D18.20-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-Model%20Context%20Protocol-111827)](https://modelcontextprotocol.io/)

English | [简体中文](#简体中文)

</div>

## English

### Overview

`agent-workspace-mcp` is a local stdio MCP server for coding agents that need project-aware answers from real TypeScript repositories.

It focuses on a practical middle ground:

- richer than raw file search
- lighter than booting a full IDE integration
- safer than guessing repository structure from prompts alone

It is especially useful for monorepos, frontend applications, and local agent workflows that need definitions, references, diagnostics, and repository context with explicit project boundaries.

### Highlights

- Project-aware TypeScript diagnostics for a single file
- Definition lookup, references, and symbol summaries from 1-based source positions
- Repository discovery for workspaces, packages, and `tsconfig` files
- Web project context detection for entrypoints, routing surfaces, config files, and framework hints
- Explicit `workspaceRoot` and `projectTsconfigPath` controls for non-standard repositories
- Fast warm-path performance by keeping TypeScript language service state in memory

### Quick Start

#### Run with `npx`

```bash
npx agent-workspace-mcp
```

#### Install globally

```bash
npm install -g agent-workspace-mcp
agent-workspace-mcp
```

### MCP Client Configuration

#### Codex

Add this to `~/.codex/config.toml`:

```toml
[mcp_servers.agent_workspace_mcp]
command = "npx"
args = ["-y", "agent-workspace-mcp"]
```

#### Generic JSON-style clients

```json
{
  "mcpServers": {
    "agent-workspace-mcp": {
      "command": "npx",
      "args": ["-y", "agent-workspace-mcp"]
    }
  }
}
```

If you want to run from a local checkout instead of `npx`:

```json
{
  "mcpServers": {
    "agent-workspace-mcp": {
      "command": "node",
      "args": ["C:/path/to/agent-workspace-mcp/dist/index.js"]
    }
  }
}
```

### Tooling Surface

| Tool | Purpose |
| --- | --- |
| `get_diagnostics` | Return TypeScript syntactic and semantic diagnostics for a file |
| `get_definition` | Resolve symbol definitions from a file position |
| `get_references` | Resolve definition and usage references from a file position |
| `get_symbol_summary` | Return symbol kind, display text, docs, and declaration metadata |
| `discover_repository_structure` | Inspect a workspace root for packages, workspace files, and `tsconfig` files |
| `get_web_project_context` | Infer entrypoints, routing surfaces, config files, and framework hints |
| `reload_project` | Invalidate cached TypeScript project state and reload project metadata |

### When This Server Is Useful

- You are building an agent that needs repository-aware context without an IDE dependency
- You want TypeScript navigation and diagnostics from local files and explicit workspace roots
- You need lightweight monorepo discovery before deciding which package to inspect
- You want frontend-oriented hints such as `app/`, `pages/`, `src/main.tsx`, or `vite`/`next`/`rsbuild` signals

### Local Development

```bash
npm install
npm run build
npm test
```

Run the included smoke validation against the fixture monorepo:

```bash
npm run smoke -- "./fixtures/monorepo" "./fixtures/monorepo/packages/app/src/index.ts" 1 10
```

### Design Notes

- The server fails fast on invalid input instead of returning fake success.
- Repository and web discovery use filesystem and package metadata heuristics, not deep framework-specific AST analysis.
- Web context selection prefers the best matching package inside a workspace instead of blindly choosing the workspace root.
- Cold TypeScript program creation can be slower in large monorepos; repeated calls are much faster once the language service is warm.

### Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

### Security

See [SECURITY.md](./SECURITY.md).

### License

MIT. See [LICENSE](./LICENSE).

---

## 简体中文

### 项目简介

`agent-workspace-mcp` 是一个本地 `stdio` MCP Server，面向需要理解真实 TypeScript 仓库结构的编码 Agent。

它解决的是一个很实际的问题：

- 只靠文件搜索，语义不够
- 直接依赖 IDE，集成太重
- 仅靠提示词猜项目结构，稳定性太差

这个项目提供一层足够轻量、但又具备 TypeScript 工程感知能力的中间能力，特别适合 monorepo、前端项目和本地 Agent 工作流。

### 核心能力

- 基于真实项目配置的 TypeScript 单文件诊断
- 基于 1-based 行列号的定义跳转、引用查找、符号摘要
- 仓库结构发现，包括 workspace 文件、包、`tsconfig` 列表
- Web 项目上下文识别，包括入口文件、路由面、配置文件和框架线索
- 支持通过 `workspaceRoot` 和 `projectTsconfigPath` 显式约束项目边界
- 利用 TypeScript Language Service 做进程内缓存，热路径更快

### 快速开始

#### 用 `npx` 直接运行

```bash
npx agent-workspace-mcp
```

#### 全局安装

```bash
npm install -g agent-workspace-mcp
agent-workspace-mcp
```

### MCP 客户端配置

#### Codex

在 `~/.codex/config.toml` 中加入：

```toml
[mcp_servers.agent_workspace_mcp]
command = "npx"
args = ["-y", "agent-workspace-mcp"]
```

#### 通用 JSON 配置示例

```json
{
  "mcpServers": {
    "agent-workspace-mcp": {
      "command": "npx",
      "args": ["-y", "agent-workspace-mcp"]
    }
  }
}
```

如果希望从本地源码构建产物启动：

```json
{
  "mcpServers": {
    "agent-workspace-mcp": {
      "command": "node",
      "args": ["C:/path/to/agent-workspace-mcp/dist/index.js"]
    }
  }
}
```

### 工具列表

| 工具名 | 作用 |
| --- | --- |
| `get_diagnostics` | 返回指定文件的 TypeScript 语法和语义诊断 |
| `get_definition` | 从文件位置解析符号定义 |
| `get_references` | 从文件位置解析定义和引用 |
| `get_symbol_summary` | 返回符号类型、显示文本、文档和声明信息 |
| `discover_repository_structure` | 扫描工作区中的包、workspace 文件和 `tsconfig` |
| `get_web_project_context` | 推断入口、路由面、配置文件和框架线索 |
| `reload_project` | 清理缓存并重新加载 TypeScript 项目元数据 |

### 适用场景

- 你在做一个不想依赖 IDE 的代码 Agent
- 你需要对本地 TypeScript 项目做更可靠的语义分析
- 你要先识别 monorepo 结构，再决定深入哪个 package
- 你想给 Agent 提供前端语境线索，例如 `app/`、`pages/`、`src/main.tsx`、`vite`、`next`、`rsbuild`

### 本地开发

```bash
npm install
npm run build
npm test
```

使用仓库内置 fixture 做冒烟验证：

```bash
npm run smoke -- "./fixtures/monorepo" "./fixtures/monorepo/packages/app/src/index.ts" 1 10
```

### 设计说明

- 对非法输入会直接失败，不伪造成功结果。
- 仓库识别和 Web 上下文识别基于文件系统和包元数据启发式，而不是重型 AST 框架分析。
- 在 workspace 根目录调用时，会优先挑选更像真实应用的包，而不是盲目返回根包。
- 大型 monorepo 的首次加载会偏慢，但热启动后的调用会快很多。

### 参与贡献

见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

### 安全问题

见 [SECURITY.md](./SECURITY.md)。

### 许可证

MIT，见 [LICENSE](./LICENSE)。
