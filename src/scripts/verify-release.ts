import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const execAsync = promisify(exec);

async function main(): Promise<void> {
  const projectRoot = process.cwd();
  const packageJson = JSON.parse(await fs.readFile(path.join(projectRoot, "package.json"), "utf8")) as { name: string };
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-workspace-mcp-release-"));
  let tarballPath: string | null = null;

  try {
    tarballPath = await packProject(projectRoot);
    const installRoot = path.join(tempRoot, "install-check");
    await fs.mkdir(installRoot, { recursive: true });

    await runNpm("init -y", installRoot);
    await runNpm(`install "${tarballPath}"`, installRoot);

    const installedCli = path.join(installRoot, "node_modules", packageJson.name, "dist", "cli.js");
    const client = new Client({
      name: "agent-workspace-mcp-release-check",
      version: "0.1.0",
    });

    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [installedCli],
      cwd: installRoot,
      stderr: "inherit",
    });

    await client.connect(transport);
    const tools = await client.listTools();
    const repository = await client.callTool({
      name: "discover_repository_structure",
      arguments: {
        root: path.join(projectRoot, "fixtures", "monorepo"),
      },
    });

    if (!tools.tools.some((tool) => tool.name === "discover_repository_structure")) {
      throw new Error("Installed package did not expose discover_repository_structure");
    }

    const structured = repository.structuredContent as { packages?: unknown[] } | undefined;
    if (!structured?.packages || structured.packages.length === 0) {
      throw new Error("Installed package did not return repository discovery results");
    }

    await transport.close();
  } finally {
    if (tarballPath) {
      await fs.rm(tarballPath, { force: true });
    }
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

async function packProject(projectRoot: string): Promise<string> {
  const { stdout } = await runNpm("pack --json", projectRoot);
  const parsed = JSON.parse(stdout) as Array<{ filename: string }>;
  const filename = parsed[0]?.filename;
  if (!filename) {
    throw new Error("npm pack did not return a tarball filename");
  }

  return path.join(projectRoot, filename);
}

async function runNpm(args: string, cwd: string): Promise<{ stdout: string; stderr: string }> {
  const command = process.platform === "win32" ? `npm.cmd ${args}` : `npm ${args}`;
  return execAsync(command, { cwd });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
