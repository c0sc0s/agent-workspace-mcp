import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export interface CodexServerConfig {
  sectionName: string;
  command: string;
  args: string[];
}

export interface CodexSetupResult {
  backupPath: string | null;
  configPath: string;
  updated: boolean;
}

export async function applyCodexConfig(server: CodexServerConfig): Promise<CodexSetupResult> {
  const codexDir = getCodexDir();
  const configPath = path.join(codexDir, "config.toml");

  await fs.mkdir(codexDir, { recursive: true });

  let originalConfig = "";
  try {
    originalConfig = await fs.readFile(configPath, "utf8");
  } catch (error: unknown) {
    const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code) : "";
    if (code !== "ENOENT") {
      throw error;
    }
  }

  const backupPath = await writeBackupIfNeeded(configPath, originalConfig);
  const serverBlock = createServerBlock(server);
  const nextConfig = upsertSection(originalConfig, `[mcp_servers.${server.sectionName}]`, serverBlock);

  if (nextConfig !== originalConfig) {
    await fs.writeFile(configPath, nextConfig, "utf8");
  }

  return {
    backupPath,
    configPath,
    updated: nextConfig !== originalConfig,
  };
}

export function detectNpxCommand(): string {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}

export function getCodexDir(): string {
  const explicit = process.env.CODEX_HOME?.trim();
  if (explicit) {
    return explicit;
  }

  return path.join(os.homedir(), ".codex");
}

export function formatTomlArray(values: string[]): string {
  return `[${values.map((value) => `"${escapeTomlString(value)}"`).join(", ")}]`;
}

function createServerBlock(server: CodexServerConfig): string {
  return [
    `[mcp_servers.${server.sectionName}]`,
    `command = "${escapeTomlString(server.command)}"`,
    `args = ${formatTomlArray(server.args)}`,
  ].join("\n");
}

async function writeBackupIfNeeded(configPath: string, contents: string): Promise<string | null> {
  if (!contents) {
    return null;
  }

  const timestamp = new Date().toISOString().replaceAll(":", "-");
  const backupPath = `${configPath}.bak-${timestamp}`;
  await fs.writeFile(backupPath, contents, "utf8");
  return backupPath;
}

function upsertSection(existingConfig: string, header: string, block: string): string {
  const normalized = existingConfig.replace(/\r\n/g, "\n");
  const lines = normalized === "" ? [] : normalized.split("\n");
  const start = lines.findIndex((line) => line.trim() === header);

  if (start === -1) {
    return appendBlock(normalized, block);
  }

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^\[/.test(lines[index] ?? "")) {
      end = index;
      break;
    }
  }

  const before = lines.slice(0, start).join("\n").trimEnd();
  const after = lines.slice(end).join("\n").trimStart();
  return [before, block, after].filter((part) => part.length > 0).join("\n\n");
}

function appendBlock(existingConfig: string, block: string): string {
  const trimmed = existingConfig.trimEnd();
  return trimmed.length > 0 ? `${trimmed}\n\n${block}\n` : `${block}\n`;
}

function escapeTomlString(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"");
}
