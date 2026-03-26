import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { ProjectServiceCache } from "./project-service.js";
import { inspectRepository, getWebProjectContext } from "./repo-inspector.js";
import type {
  DefinitionArgs,
  DiagnosticsArgs,
  InspectRepositoryArgs,
  PositionArgs,
  ReloadProjectArgs,
  WebProjectContextArgs,
} from "./types.js";

const diagnosticsSchema = z.object({
  file: z.string().min(1),
  workspaceRoot: z.string().min(1).optional(),
  projectTsconfigPath: z.string().min(1).optional(),
});

const definitionSchema = diagnosticsSchema.extend({
  line: z.number().int().positive(),
  column: z.number().int().positive(),
});

const rootSchema = z.object({
  root: z.string().min(1),
});

const reloadProjectSchema = z.object({
  file: z.string().min(1).optional(),
  workspaceRoot: z.string().min(1).optional(),
  projectTsconfigPath: z.string().min(1).optional(),
});

export function createServer(cache = new ProjectServiceCache()): McpServer {
  const server = new McpServer({
    name: "agent-workspace-mcp",
    version: "0.1.0",
  });

  server.registerTool(
    "get_diagnostics",
    {
      title: "Get Diagnostics",
      description: "Return TypeScript syntactic and semantic diagnostics for a single file using project-aware configuration.",
      inputSchema: diagnosticsSchema,
    },
    async (args: DiagnosticsArgs) => {
      const { diagnostics, project } = cache.getDiagnosticsWithMetadata(args.file, args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ file: args.file, diagnostics, project }, null, 2),
          },
        ],
        structuredContent: {
          file: args.file,
          diagnostics,
          project,
        },
      };
    },
  );

  server.registerTool(
    "get_definition",
    {
      title: "Get Definition",
      description: "Resolve the definition locations for a symbol at a 1-based line and column in a file.",
      inputSchema: definitionSchema,
    },
    async (args: DefinitionArgs) => {
      const { definitions, project } = cache.getDefinitionWithMetadata(args.file, args.line, args.column, args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                file: args.file,
                line: args.line,
                column: args.column,
                definitions,
                project,
              },
              null,
              2,
            ),
          },
        ],
        structuredContent: {
          file: args.file,
          line: args.line,
          column: args.column,
          definitions,
          project,
        },
      };
    },
  );

  server.registerTool(
    "get_references",
    {
      title: "Get References",
      description: "Resolve project-aware definition and usage references for the symbol at a 1-based line and column in a file.",
      inputSchema: definitionSchema,
    },
    async (args: PositionArgs) => {
      const { references, project } = cache.getReferences(args.file, args.line, args.column, args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ file: args.file, line: args.line, column: args.column, references, project }, null, 2),
          },
        ],
        structuredContent: {
          file: args.file,
          line: args.line,
          column: args.column,
          references,
          project,
        },
      };
    },
  );

  server.registerTool(
    "get_symbol_summary",
    {
      title: "Get Symbol Summary",
      description: "Return symbol kind, display text, declaration location, and project metadata for a 1-based source position.",
      inputSchema: definitionSchema,
    },
    async (args: PositionArgs) => {
      const { symbol, project } = cache.getSymbolSummary(args.file, args.line, args.column, args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ file: args.file, line: args.line, column: args.column, symbol, project }, null, 2),
          },
        ],
        structuredContent: {
          file: args.file,
          line: args.line,
          column: args.column,
          symbol,
          project,
        },
      };
    },
  );

  server.registerTool(
    "discover_repository_structure",
    {
      title: "Discover Repository Structure",
      description: "Inspect a local root path and return workspace files, monorepo packages, tsconfig files, and package classification hints.",
      inputSchema: rootSchema,
    },
    async (args: InspectRepositoryArgs) => {
      const repository = inspectRepository(args.root);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(repository, null, 2),
          },
        ],
        structuredContent: repository,
      };
    },
  );

  server.registerTool(
    "get_web_project_context",
    {
      title: "Get Web Project Context",
      description: "Inspect a local root path and return frontend-oriented context such as entrypoints, routing surfaces, config files, and framework hints.",
      inputSchema: rootSchema,
    },
    async (args: WebProjectContextArgs) => {
      const context = getWebProjectContext(args.root);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(context, null, 2),
          },
        ],
        structuredContent: context,
      };
    },
  );

  server.registerTool(
    "reload_project",
    {
      title: "Reload Project",
      description: "Invalidate cached TypeScript project state and reload it from tsconfig.",
      inputSchema: reloadProjectSchema,
    },
    async (args: ReloadProjectArgs) => {
      const project = cache.reloadProject(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(project, null, 2),
          },
        ],
        structuredContent: project,
      };
    },
  );

  return server;
}

export async function startServer(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
