import assert from "node:assert/strict";
import path from "node:path";

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

export function getFixturePaths(projectRoot = process.cwd()): {
  workspaceRoot: string;
  appRoot: string;
  appFile: string;
  rootTsconfig: string;
  appTsconfig: string;
} {
  const workspaceRoot = path.resolve(projectRoot, "fixtures", "monorepo");
  const appRoot = path.join(workspaceRoot, "packages", "app");

  return {
    workspaceRoot,
    appRoot,
    appFile: path.join(appRoot, "src", "index.ts"),
    rootTsconfig: path.join(workspaceRoot, "tsconfig.json"),
    appTsconfig: path.join(appRoot, "tsconfig.json"),
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

export async function collectFixtureContract(client: Client, projectRoot = process.cwd()): Promise<ToolContractPayload> {
  const fixture = getFixturePaths(projectRoot);
  const tools = await client.listTools();
  const diagnostics = await callToolExpectSuccess(client, "get_diagnostics", {
    workspaceRoot: fixture.workspaceRoot,
    file: fixture.appFile,
  });
  const definitions = await callToolExpectSuccess(client, "get_definition", {
    workspaceRoot: fixture.workspaceRoot,
    file: fixture.appFile,
    line: 1,
    column: 10,
  });
  const references = await callToolExpectSuccess(client, "get_references", {
    workspaceRoot: fixture.workspaceRoot,
    file: fixture.appFile,
    line: 1,
    column: 10,
  });
  const symbol = await callToolExpectSuccess(client, "get_symbol_summary", {
    workspaceRoot: fixture.workspaceRoot,
    file: fixture.appFile,
    line: 1,
    column: 10,
  });
  const repository = await callToolExpectSuccess(client, "discover_repository_structure", {
    root: fixture.workspaceRoot,
  });
  const webContext = await callToolExpectSuccess(client, "get_web_project_context", {
    root: fixture.workspaceRoot,
  });
  const reload = await callToolExpectSuccess(client, "reload_project", {
    workspaceRoot: fixture.workspaceRoot,
    file: fixture.appFile,
  });
  const overrideDiagnostics = await callToolExpectSuccess(client, "get_diagnostics", {
    workspaceRoot: fixture.workspaceRoot,
    projectTsconfigPath: fixture.rootTsconfig,
    file: fixture.appFile,
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

export function assertFixtureContract(payload: ToolContractPayload, projectRoot = process.cwd()): void {
  const fixture = getFixturePaths(projectRoot);
  assert.deepEqual([...payload.toolNames].sort(), [...EXPECTED_TOOL_NAMES].sort());

  assert.equal(payload.diagnostics.file, fixture.appFile);
  assert.deepEqual(payload.diagnostics.diagnostics, []);
  assert.equal(payload.diagnostics.project.workspaceRoot, fixture.workspaceRoot);
  assert.equal(payload.diagnostics.project.packageRoot, fixture.appRoot);
  assert.equal(payload.diagnostics.project.tsconfigPath, fixture.appTsconfig);

  assert.equal(payload.definitions.file, fixture.appFile);
  assert.equal(payload.definitions.line, 1);
  assert.equal(payload.definitions.column, 10);
  assert.ok(payload.definitions.definitions.some((item) => normalizeSeparators(item.file).endsWith(normalizeSeparators(sharedMathPathFragment))));
  assert.equal(payload.definitions.project.tsconfigPath, fixture.appTsconfig);

  assert.equal(payload.references.file, fixture.appFile);
  assert.equal(payload.references.line, 1);
  assert.equal(payload.references.column, 10);
  assert.ok(payload.references.references.some((item) => item.isDefinition));
  assert.ok(payload.references.references.some((item) => normalizeSeparators(item.file).endsWith(normalizeSeparators(sharedMathPathFragment))));
  assert.equal(payload.references.project.tsconfigPath, fixture.appTsconfig);

  assert.equal(payload.symbol.file, fixture.appFile);
  assert.equal(payload.symbol.line, 1);
  assert.equal(payload.symbol.column, 10);
  assert.equal(payload.symbol.symbol?.kind, "alias");
  assert.match(payload.symbol.symbol?.name ?? "", /add/);
  assert.equal(payload.symbol.project.tsconfigPath, fixture.appTsconfig);

  assert.equal(payload.repository.root, fixture.workspaceRoot);
  assert.equal(payload.repository.packages.length, 3);
  assert.ok(payload.repository.workspaceFiles.some((file) => normalizeSeparators(file).endsWith("pnpm-workspace.yaml")));
  assert.ok(payload.repository.tsconfigPaths.some((file) => normalizeSeparators(file).endsWith(normalizeSeparators(path.join("packages", "app", "tsconfig.json")))));

  assert.equal(payload.webContext.root, fixture.workspaceRoot);
  assert.equal(payload.webContext.packageRoot, fixture.appRoot);
  assert.equal(payload.webContext.kind, "application");
  assert.equal(payload.webContext.confidence, "high");
  assert.ok(payload.webContext.frameworkHints.includes("react"));
  assert.ok(payload.webContext.entryPoints.some((file) => normalizeSeparators(file).endsWith(normalizeSeparators(path.join("src", "main.tsx")))));

  assert.equal(payload.reload.workspaceRoot, fixture.workspaceRoot);
  assert.equal(payload.reload.packageRoot, fixture.appRoot);
  assert.equal(payload.reload.tsconfigPath, fixture.appTsconfig);
  assert.ok(Number(payload.reload.fileCount) >= 1);

  assert.equal(payload.overrideDiagnostics.file, fixture.appFile);
  assert.deepEqual(payload.overrideDiagnostics.diagnostics, []);
  assert.equal(payload.overrideDiagnostics.project.tsconfigPath, fixture.rootTsconfig);
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
