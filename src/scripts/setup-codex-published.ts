import { applyCodexConfig, detectNpxCommand, getCodexDir } from "./codex-config.js";

const SECTION_NAME = "agent_workspace_mcp";

export async function runSetupCodexPublished(): Promise<void> {
  const command = detectNpxCommand();
  const args = ["-y", "agent-workspace-mcp"];
  const { backupPath, configPath } = await applyCodexConfig({
    sectionName: SECTION_NAME,
    command,
    args,
  });

  process.stdout.write([
    `Updated Codex MCP config: ${configPath}`,
    backupPath ? `Backup written to: ${backupPath}` : "No backup needed: config file did not exist yet.",
    "",
    "Configured server:",
    `  ${SECTION_NAME} -> ${command} ${args.join(" ")}`,
    "",
    "Next steps:",
    "1. Restart Codex so it reloads MCP config.",
    "2. Open your repository in Codex.",
    "3. Ask Codex to call discover_repository_structure or get_web_project_context.",
    "",
  ].join("\n"));

  process.stdout.write(`\nUsing Codex config directory: ${getCodexDir()}\n`);
}
