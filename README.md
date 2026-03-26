# agent-workspace-mcp

<div align="center">

TypeScript-aware MCP server for repository discovery, code intelligence, and web workspace context.

[![CI](https://github.com/c0sc0s/agent-workspace-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/c0sc0s/agent-workspace-mcp/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/c0sc0s/agent-workspace-mcp)](./LICENSE)
[![Stars](https://img.shields.io/github/stars/c0sc0s/agent-workspace-mcp?style=social)](https://github.com/c0sc0s/agent-workspace-mcp/stargazers)
[![Node](https://img.shields.io/badge/node-%3E%3D18.20-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

English | [简体中文](#简体中文)

</div>

## English

`agent-workspace-mcp` is a local `stdio` MCP server for coding agents that need real TypeScript project context without depending on a full IDE integration. It sits in the practical middle ground between raw file search and heavyweight editor tooling, giving agents repository-aware answers from local codebases with explicit project boundaries.

It exposes a focused set of tools. `get_diagnostics` returns TypeScript syntactic and semantic diagnostics for a file. `get_definition`, `get_references`, and `get_symbol_summary` provide code navigation and symbol insight from 1-based source positions. `discover_repository_structure` scans a workspace for packages, workspace files, and `tsconfig` files. `get_web_project_context` adds frontend-oriented context such as entrypoints, routing surfaces, config files, and framework hints. `reload_project` clears cached TypeScript state and refreshes project metadata.

This is especially useful for monorepos, frontend applications, and local agent workflows where the agent needs to answer questions like "which package should I inspect", "where is this symbol defined", or "does this repository look like a web app" without guessing from prompts alone.

### Quick Start

Run directly with `npx`:

```bash
npx agent-workspace-mcp
```

Or install globally:

```bash
npm install -g agent-workspace-mcp
agent-workspace-mcp
```

### MCP Client Configuration

For Codex, add this to `~/.codex/config.toml`:

```toml
[mcp_servers.agent_workspace_mcp]
command = "npx"
args = ["-y", "agent-workspace-mcp"]
```

For JSON-style MCP clients:

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

If you prefer a local checkout instead of `npx`:

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

### Development

```bash
npm install
npm run build
npm test
```

You can also run the included smoke check against the fixture monorepo:

```bash
npm run smoke -- "./fixtures/monorepo" "./fixtures/monorepo/packages/app/src/index.ts" 1 10
```

The server fails fast on invalid input, uses filesystem and package metadata heuristics for repository classification, and keeps TypeScript language service state in memory so repeated calls are much faster after the initial load.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution workflow, [SECURITY.md](./SECURITY.md) for vulnerability reporting, and [LICENSE](./LICENSE) for license terms.

---

## 简体中文

`agent-workspace-mcp` 是一个本地 `stdio` MCP Server，面向需要理解真实 TypeScript 工程上下文的编码 Agent。它不依赖完整 IDE 集成，但又比简单文件搜索更有工程语义，适合在本地代码仓库里给 Agent 提供更稳定的项目级判断能力。

它提供一组收敛的工具能力。`get_diagnostics` 用于返回单文件的 TypeScript 语法和语义诊断；`get_definition`、`get_references`、`get_symbol_summary` 用于基于 1-based 行列号做定义跳转、引用查找和符号摘要；`discover_repository_structure` 用于扫描 workspace、package 和 `tsconfig` 结构；`get_web_project_context` 用于补充前端语境，比如入口文件、路由面、配置文件和框架线索；`reload_project` 用于清空缓存并重新加载 TypeScript 项目状态。

这个项目尤其适合 monorepo、前端应用和本地 Agent 工作流。比如你需要先判断应该分析哪个 package、某个符号真正定义在哪里，或者当前仓库是否更像一个 web app，而不想让 Agent 仅靠提示词去猜。

### 快速开始

直接通过 `npx` 运行：

```bash
npx agent-workspace-mcp
```

或者全局安装：

```bash
npm install -g agent-workspace-mcp
agent-workspace-mcp
```

### MCP 客户端配置

如果你在用 Codex，可在 `~/.codex/config.toml` 中加入：

```toml
[mcp_servers.agent_workspace_mcp]
command = "npx"
args = ["-y", "agent-workspace-mcp"]
```

如果你使用通用 JSON 风格的 MCP 配置：

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

如果你希望直接从本地构建产物启动：

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

### 开发

```bash
npm install
npm run build
npm test
```

也可以使用仓库内置 fixture 做一次冒烟验证：

```bash
npm run smoke -- "./fixtures/monorepo" "./fixtures/monorepo/packages/app/src/index.ts" 1 10
```

这个服务对非法输入会直接失败，仓库和 Web 项目识别主要依赖文件系统与包元数据启发式，并且会在进程内缓存 TypeScript Language Service，所以首次加载后，后续调用会快很多。

贡献流程见 [CONTRIBUTING.md](./CONTRIBUTING.md)，安全问题处理方式见 [SECURITY.md](./SECURITY.md)，许可证见 [LICENSE](./LICENSE)。
