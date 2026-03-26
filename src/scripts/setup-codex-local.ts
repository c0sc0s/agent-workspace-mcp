import path from "node:path";

import { applyCodexConfig } from "./codex-config.js";

const SECTION_NAME = "agent_workspace_mcp_local";

async function main(): Promise<void> {
  const projectRoot = process.cwd();
  const distCliPath = path.join(projectRoot, "dist", "cli.js");
  await assertFileExists(distCliPath, "Build output not found. Run `npm run build` first.");

  const { backupPath, configPath } = await applyCodexConfig({
    sectionName: SECTION_NAME,
    command: "node",
    args: [toTomlPath(distCliPath)],
  });

  process.stdout.write([
    `Updated Codex MCP config: ${configPath}`,
    backupPath ? `Backup written to: ${backupPath}` : "No backup needed: config file did not exist yet.",
    "",
    "Configured server:",
    `  ${SECTION_NAME} -> ${distCliPath}`,
    "",
    "Next steps:",
    "1. Restart Codex so it reloads MCP config.",
    "2. Open this repository in Codex.",
    "3. Paste one of the prompts below to validate the local MCP server.",
    "",
    "Suggested prompts:",
    `- Use the local MCP server to inspect ${path.join(projectRoot, "fixtures", "monorepo")} and tell me which package looks like the main app.`,
    `- Use the local MCP server to get diagnostics for ${path.join(projectRoot, "fixtures", "monorepo", "packages", "app", "src", "index.ts")}.`,
    `- Use the local MCP server to find the definition and references for the symbol at ${path.join(projectRoot, "fixtures", "monorepo", "packages", "app", "src", "index.ts")}:1:10.`,
    `- Use the local MCP server to get web project context for ${path.join(projectRoot, "fixtures", "monorepo")}.`,
    "",
  ].join("\n"));
}

async function assertFileExists(filePath: string, message: string): Promise<void> {
  try {
    await fs.access(filePath);
  } catch {
    throw new Error(message);
  }
}

function toTomlPath(filePath: string): string {
  return filePath.replaceAll("\\", "/");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
