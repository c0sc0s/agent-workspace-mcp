import path from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

function assertArgument(value: string | undefined, label: string): string {
  if (!value) {
    throw new Error(`Missing required argument: ${label}`);
  }

  return value;
}

async function main(): Promise<void> {
  const workspaceRoot = assertArgument(process.argv[2], "workspaceRoot");
  const file = assertArgument(process.argv[3], "file");
  const line = Number(process.argv[4] ?? "1");
  const column = Number(process.argv[5] ?? "1");

  const client = new Client({
    name: "agent-workspace-mcp-smoke",
    version: "0.1.0",
  });

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.resolve("dist/cli.js")],
    cwd: process.cwd(),
    stderr: "inherit",
  });

  await client.connect(transport);

  const tools = await client.listTools();
  const diagnostics = await client.callTool({
    name: "get_diagnostics",
    arguments: {
      workspaceRoot,
      file,
    },
  });

  const definitions = await client.callTool({
    name: "get_definition",
    arguments: {
      workspaceRoot,
      file,
      line,
      column,
    },
  });

  const references = await client.callTool({
    name: "get_references",
    arguments: {
      workspaceRoot,
      file,
      line,
      column,
    },
  });

  const symbol = await client.callTool({
    name: "get_symbol_summary",
    arguments: {
      workspaceRoot,
      file,
      line,
      column,
    },
  });

  const repository = await client.callTool({
    name: "discover_repository_structure",
    arguments: {
      root: workspaceRoot,
    },
  });

  const webContext = await client.callTool({
    name: "get_web_project_context",
    arguments: {
      root: workspaceRoot,
    },
  });

  const payload = {
    tools: tools.tools.map((tool) => tool.name),
    diagnostics: diagnostics.structuredContent,
    definitions: definitions.structuredContent,
    references: references.structuredContent,
    symbol: symbol.structuredContent,
    repository: repository.structuredContent,
    webContext: webContext.structuredContent,
  };

  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  await transport.close();
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
