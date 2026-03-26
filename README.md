# agent-workspace-mcp

<div align="center">

<img src="./assets/logo.png" alt="agent-workspace-mcp logo" width="360" />

TypeScript-aware MCP server for repository discovery, code intelligence, and web workspace context.

[![CI](https://github.com/c0sc0s/agent-workspace-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/c0sc0s/agent-workspace-mcp/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/c0sc0s/agent-workspace-mcp)](./LICENSE)
[![Stars](https://img.shields.io/github/stars/c0sc0s/agent-workspace-mcp?style=social)](https://github.com/c0sc0s/agent-workspace-mcp/stargazers)
[![Node](https://img.shields.io/badge/node-%3E%3D18.20-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

English | [简体中文](#简体中文)

</div>

## English

`agent-workspace-mcp` is a local `stdio` MCP server that provides TypeScript-aware project context for local codebases without requiring a full IDE integration. It sits between raw file search and heavyweight editor tooling, helping MCP clients read repositories with explicit project boundaries.

It exposes a focused set of tools. `get_diagnostics` returns TypeScript syntactic and semantic diagnostics for a file. `get_definition`, `get_references`, and `get_symbol_summary` provide code navigation and symbol insight from 1-based source positions. `discover_repository_structure` scans a workspace for packages, workspace files, and `tsconfig` files. `get_web_project_context` adds frontend-oriented context such as entrypoints, routing surfaces, config files, and framework hints. `reload_project` clears cached TypeScript state and refreshes project metadata.

It is especially useful for monorepos, frontend applications, and local repository workflows where you want reliable answers to questions such as "which package should I inspect", "where is this symbol defined", or "does this repository look like a web app".

### Quick Start

Run directly with `npx`:

```bash
npx -y agent-workspace-mcp@0.1.4
```

To configure Codex automatically without editing `~/.codex/config.toml` by hand:

```bash
npx -y agent-workspace-mcp@0.1.4 --setup-codex
```

To print the installed package version:

```bash
npx -y agent-workspace-mcp@0.1.4 --version
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

On Windows, if your MCP client struggles to resolve `npx` reliably, prefer:

```toml
[mcp_servers.agent_workspace_mcp]
command = "npx.cmd"
args = ["-y", "agent-workspace-mcp"]
```

If you use the one-shot setup command above, the package writes this entry for you automatically and uses `npx.cmd` on Windows.

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
      "args": ["C:/path/to/agent-workspace-mcp/dist/cli.js"]
    }
  }
}
```

The server fails fast on invalid input, uses filesystem and package metadata heuristics for repository classification, and keeps TypeScript language service state in memory so repeated calls are much faster after the initial load.

For development and contribution details, see [CONTRIBUTING.md](./CONTRIBUTING.md). For vulnerability reporting, see [SECURITY.md](./SECURITY.md). License terms are in [LICENSE](./LICENSE).

---

## 简体中文

`agent-workspace-mcp` 是一个本地 `stdio` MCP Server，用于在不依赖完整 IDE 集成的前提下，为本地代码仓库提供 TypeScript 感知的项目上下文。它介于简单文件搜索和重量级编辑器工具之间，适合为各类 MCP Client 提供更稳定的仓库级理解能力。

它提供一组收敛的工具能力。`get_diagnostics` 用于返回单文件的 TypeScript 语法和语义诊断；`get_definition`、`get_references`、`get_symbol_summary` 用于基于 1-based 行列号做定义跳转、引用查找和符号摘要；`discover_repository_structure` 用于扫描 workspace、package 和 `tsconfig` 结构；`get_web_project_context` 用于补充前端语境，比如入口文件、路由面、配置文件和框架线索；`reload_project` 用于清空缓存并重新加载 TypeScript 项目状态。

这个项目尤其适合 monorepo、前端应用和本地仓库分析场景。比如你想先判断应该查看哪个 package、某个符号真正定义在哪里，或者当前仓库是否更像一个 web app。

### 快速开始

直接通过 `npx` 运行：

```bash
npx -y agent-workspace-mcp@0.1.4
```

如果你不想手动编辑 `~/.codex/config.toml`，可以直接执行：

```bash
npx -y agent-workspace-mcp@0.1.4 --setup-codex
```

如果你想查看当前包版本：

```bash
npx -y agent-workspace-mcp@0.1.4 --version
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

如果你使用上面的自动配置命令，包会帮你写入这段配置；在 Windows 上会自动改用 `npx.cmd`。

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
      "args": ["C:/path/to/agent-workspace-mcp/dist/cli.js"]
    }
  }
}
```

这个服务对非法输入会直接失败，仓库和 Web 项目识别主要依赖文件系统与包元数据启发式，并且会在进程内缓存 TypeScript Language Service，所以首次加载后，后续调用会快很多。

如果你想参与开发或贡献代码，见 [CONTRIBUTING.md](./CONTRIBUTING.md)；安全问题处理方式见 [SECURITY.md](./SECURITY.md)；许可证见 [LICENSE](./LICENSE)。
