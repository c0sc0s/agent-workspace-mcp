# agent-workspace-mcp

`agent-workspace-mcp` is a local stdio MCP server that exposes agent-oriented TypeScript analysis, repository discovery, and frontend workspace context without requiring an IDE or a full-project `tsc -p` run.

It is designed for coding agents and local tooling that need fast project-aware answers inside real repositories, especially monorepos and web applications.

## Features

- TypeScript diagnostics for a single file with resolved project metadata
- Definition lookup, references, and symbol summaries from 1-based source positions
- Repository discovery for workspaces, packages, and `tsconfig` files
- Web project context detection for entrypoints, routing surfaces, config files, and framework hints
- Explicit `workspaceRoot` and `projectTsconfigPath` support for large or non-standard repositories

## Installation

### Run directly with `npx`

```bash
npx agent-workspace-mcp
```

### Install globally

```bash
npm install -g agent-workspace-mcp
agent-workspace-mcp
```

## Codex configuration

Add the server to `~/.codex/config.toml`:

```toml
[mcp_servers.agent_workspace_mcp]
command = "npx"
args = ["-y", "agent-workspace-mcp"]
```

If you prefer a pinned local checkout:

```toml
[mcp_servers.agent_workspace_mcp]
command = "node"
args = ["C:/path/to/agent-workspace-mcp/dist/index.js"]
```

## Tools

### `get_diagnostics`

Input:

- `file`
- optional `workspaceRoot`
- optional `projectTsconfigPath`

Returns syntactic and semantic diagnostics anchored to the requested file, plus resolved project metadata.

### `get_definition`

Input:

- `file`
- `line`
- `column`
- optional `workspaceRoot`
- optional `projectTsconfigPath`

Returns definition locations with file path, 1-based line and column, length, symbol summary, and resolved project metadata.

### `get_references`

Input:

- `file`
- `line`
- `column`
- optional `workspaceRoot`
- optional `projectTsconfigPath`

Returns definition and usage references for the symbol at the requested position, plus resolved project metadata.

### `get_symbol_summary`

Input:

- `file`
- `line`
- `column`
- optional `workspaceRoot`
- optional `projectTsconfigPath`

Returns symbol kind, display text, declaration location, and resolved project metadata.

### `discover_repository_structure`

Input:

- `root`

Returns workspace files, discovered packages, package-level `tsconfig` files, and lightweight classification hints.

### `get_web_project_context`

Input:

- `root`

Returns frontend-oriented package context including likely entrypoints, routing surfaces, config files, framework hints, and classification evidence.

### `reload_project`

Input:

- optional `file`
- optional `workspaceRoot`
- optional `projectTsconfigPath`

Invalidates cached TypeScript project state and returns refreshed project metadata.

## Local development

```bash
npm install
npm run build
npm test
```

Run the smoke script against the included fixture monorepo:

```bash
npm run smoke -- "./fixtures/monorepo" "./fixtures/monorepo/packages/app/src/index.ts" 1 10
```

## Design notes

- The server favors explicit project boundaries and fails fast on invalid inputs.
- Repository and web discovery use file-system and package metadata heuristics, not framework-specific AST analysis.
- Web entrypoint detection intentionally prefers explicit frontend signals such as `src/main.tsx`, `src/index.tsx`, `app/`, and `pages/`.
- Cold TypeScript program creation can be slow in large monorepos; warm requests are substantially faster because the process keeps language service state in memory.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Security

See [SECURITY.md](./SECURITY.md).

## License

MIT
