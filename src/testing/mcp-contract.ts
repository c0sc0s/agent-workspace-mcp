import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import type {
  DefinitionItem,
  DiagnosticItem,
  ProjectInfo,
  ProjectMetadata,
  ReferenceItem,
  RepositoryDiscoveryResult,
  SymbolSummary,
  WebProjectContextResult,
} from "../types.js";

export const EXPECTED_TOOL_NAMES = [
  "discover_repository_structure",
  "get_definition",
  "get_diagnostics",
  "get_references",
  "get_symbol_summary",
  "get_web_project_context",
  "reload_project",
];

const fixtureRoot = path.resolve("fixtures/monorepo");
const fixtureAppRoot = path.join(fixtureRoot, "packages", "app");
const fixtureAppFile = path.join(fixtureAppRoot, "src", "index.ts");
const fixtureRootTsconfig = path.join(fixtureRoot, "tsconfig.json");
const fixtureAppTsconfig = path.join(fixtureAppRoot, "tsconfig.json");
const sharedMathPathFragment = path.join("packages", "shared", "src", "math.ts");

export interface ToolContractPayload {
  toolNames: string[];
  diagnostics: { file: string; diagnostics: DiagnosticItem[]; project: ProjectMetadata };
  definitions: { file: string; line: number; column: number; definitions: DefinitionItem[]; project: ProjectMetadata };
  references: { file: string; line: number; column: number; references: ReferenceItem[]; project: ProjectMetadata };
  symbol: { file: string; line: number; column: number; symbol: SymbolSummary | null; project: ProjectMetadata };
  repository: RepositoryDiscoveryResult;
  webContext: WebProjectContextResult;
  reload: ProjectInfo;
  overrideDiagnostics: { file: string; diagnostics: DiagnosticItem[]; project: ProjectMetadata };
}

export function getFixturePaths(): {
  workspaceRoot: string;
  appRoot: string;
  appFile: string;
  rootTsconfig: string;
  appTsconfig: string;
} {
  return {
    workspaceRoot: fixtureRoot,
    appRoot: fixtureAppRoot,
    appFile: fixtureAppFile,
    rootTsconfig: fixtureRootTsconfig,
    appTsconfig: fixtureAppTsconfig,
  };
}

export async function createClientForLocalCli(cwd: string): Promise<{
  client: Client;
  transport: StdioClientTransport;
}> {
  return createClientForCommand({
    command: process.execPath,
    args: ["--import", "tsx", path.resolve(cwd, "src/cli.ts")],
    cwd,
  });
}

export async function createClientForBuiltCli(cwd: string): Promise<{
  client: Client;
  transport: StdioClientTransport;
}> {
  return createClientForCommand({
    command: process.execPath,
    args: [path.resolve(cwd, "dist/cli.js")],
    cwd,
  });
}

export async function createClientForInstalledCli(installedCliPath: string, cwd: string): Promise<{
  client: Client;
  transport: StdioClientTransport;
}> {
  return createClientForCommand({
    command: process.execPath,
    args: [installedCliPath],
    cwd,
  });
}

export async function collectFixtureContract(client: Client): Promise<ToolContractPayload> {
  const tools = await client.listTools();
  const diagnostics = await callToolExpectSuccess(client, "get_diagnostics", {
    workspaceRoot: fixtureRoot,
    file: fixtureAppFile,
  });
  const definitions = await callToolExpectSuccess(client, "get_definition", {
    workspaceRoot: fixtureRoot,
    file: fixtureAppFile,
    line: 1,
    column: 10,
  });
  const references = await callToolExpectSuccess(client, "get_references", {
    workspaceRoot: fixtureRoot,
    file: fixtureAppFile,
    line: 1,
    column: 10,
  });
  const symbol = await callToolExpectSuccess(client, "get_symbol_summary", {
    workspaceRoot: fixtureRoot,
    file: fixtureAppFile,
    line: 1,
    column: 10,
  });
  const repository = await callToolExpectSuccess(client, "discover_repository_structure", {
    root: fixtureRoot,
  });
  const webContext = await callToolExpectSuccess(client, "get_web_project_context", {
    root: fixtureRoot,
  });
  const reload = await callToolExpectSuccess(client, "reload_project", {
    workspaceRoot: fixtureRoot,
    file: fixtureAppFile,
  });
  const overrideDiagnostics = await callToolExpectSuccess(client, "get_diagnostics", {
    workspaceRoot: fixtureRoot,
    projectTsconfigPath: fixtureRootTsconfig,
    file: fixtureAppFile,
  });

  return {
    toolNames: tools.tools.map((tool) => tool.name),
    diagnostics: asObject(diagnostics),
    definitions: asObject(definitions),
    references: asObject(references),
    symbol: asObject(symbol),
    repository: asObject(repository),
    webContext: asObject(webContext),
    reload: asObject(reload),
    overrideDiagnostics: asObject(overrideDiagnostics),
  };
}

export function assertFixtureContract(payload: ToolContractPayload): void {
  assert.deepEqual([...payload.toolNames].sort(), [...EXPECTED_TOOL_NAMES].sort());

  assert.equal(payload.diagnostics.file, fixtureAppFile);
  assert.deepEqual(payload.diagnostics.diagnostics, []);
  assert.equal(payload.diagnostics.project.workspaceRoot, fixtureRoot);
  assert.equal(payload.diagnostics.project.packageRoot, fixtureAppRoot);
  assert.equal(payload.diagnostics.project.tsconfigPath, fixtureAppTsconfig);

  assert.equal(payload.definitions.file, fixtureAppFile);
  assert.equal(payload.definitions.line, 1);
  assert.equal(payload.definitions.column, 10);
  assert.ok(payload.definitions.definitions.some((item) => normalizeSeparators(item.file).endsWith(normalizeSeparators(sharedMathPathFragment))));
  assert.equal(payload.definitions.project.tsconfigPath, fixtureAppTsconfig);

  assert.equal(payload.references.file, fixtureAppFile);
  assert.equal(payload.references.line, 1);
  assert.equal(payload.references.column, 10);
  assert.ok(payload.references.references.some((item) => item.isDefinition));
  assert.ok(payload.references.references.some((item) => normalizeSeparators(item.file).endsWith(normalizeSeparators(sharedMathPathFragment))));
  assert.equal(payload.references.project.tsconfigPath, fixtureAppTsconfig);

  assert.equal(payload.symbol.file, fixtureAppFile);
  assert.equal(payload.symbol.line, 1);
  assert.equal(payload.symbol.column, 10);
  assert.equal(payload.symbol.symbol?.kind, "alias");
  assert.match(payload.symbol.symbol?.name ?? "", /add/);
  assert.equal(payload.symbol.project.tsconfigPath, fixtureAppTsconfig);

  assert.equal(payload.repository.root, fixtureRoot);
  assert.equal(payload.repository.packages.length, 3);
  assert.ok(payload.repository.workspaceFiles.some((file) => normalizeSeparators(file).endsWith("pnpm-workspace.yaml")));
  assert.ok(payload.repository.tsconfigPaths.some((file) => normalizeSeparators(file).endsWith(normalizeSeparators(path.join("packages", "app", "tsconfig.json")))));

  assert.equal(payload.webContext.root, fixtureRoot);
  assert.equal(payload.webContext.packageRoot, fixtureAppRoot);
  assert.equal(payload.webContext.kind, "application");
  assert.equal(payload.webContext.confidence, "high");
  assert.ok(payload.webContext.frameworkHints.includes("react"));
  assert.ok(payload.webContext.entryPoints.some((file) => normalizeSeparators(file).endsWith(normalizeSeparators(path.join("src", "main.tsx")))));

  assert.equal(payload.reload.workspaceRoot, fixtureRoot);
  assert.equal(payload.reload.packageRoot, fixtureAppRoot);
  assert.equal(payload.reload.tsconfigPath, fixtureAppTsconfig);
  assert.ok(Number(payload.reload.fileCount) >= 1);

  assert.equal(payload.overrideDiagnostics.file, fixtureAppFile);
  assert.deepEqual(payload.overrideDiagnostics.diagnostics, []);
  assert.equal(payload.overrideDiagnostics.project.tsconfigPath, fixtureRootTsconfig);
}

export async function callToolExpectSuccess(client: Client, name: string, args: Record<string, unknown>): Promise<unknown> {
  const result = await client.callTool({
    name,
    arguments: args,
  });

  assert.equal(result.isError, undefined, `${name} unexpectedly returned an MCP tool error`);
  return result.structuredContent;
}

export async function callToolExpectError(client: Client, name: string, args: Record<string, unknown>, messagePattern: RegExp): Promise<void> {
  const result = await client.callTool({
    name,
    arguments: args,
  });

  assert.equal(result.isError, true, `${name} should surface a tool error`);
  const textParts = (result.content ?? [])
    .filter((item): item is { type: "text"; text: string } => item.type === "text")
    .map((item) => item.text)
    .join("\n");
  assert.match(textParts, messagePattern);
}

export async function closeClient(transport: StdioClientTransport): Promise<void> {
  await transport.close();
}

function asObject<T>(value: unknown): T {
  return value as T;
}

function createClientForCommand(params: {
  command: string;
  args: string[];
  cwd: string;
}): Promise<{
  client: Client;
  transport: StdioClientTransport;
}> {
  const client = new Client({
    name: "agent-workspace-mcp-contract-test",
    version: "0.1.0",
  });
  const transport = new StdioClientTransport({
    command: params.command,
    args: params.args,
    cwd: params.cwd,
    stderr: "inherit",
  });

  return client.connect(transport).then(() => ({ client, transport }));
}

function normalizeSeparators(value: string): string {
  return value.replaceAll("\\", "/");
}

export function createModulePathFromHere(relativePath: string): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), relativePath);
}
