import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  assertFixtureContract,
  callToolExpectError,
  closeClient,
  collectFixtureContract,
  createClientForLocalCli,
  getFixturePaths,
} from "../testing/mcp-contract.js";

const projectRoot = path.resolve(".");

test("stdio MCP server exposes the expected tool catalog and contract outputs", async () => {
  const { client, transport } = await createClientForLocalCli(projectRoot);

  try {
    const payload = await collectFixtureContract(client);
    assertFixtureContract(payload);
  } finally {
    await closeClient(transport);
  }
});

test("reload_project refreshes project metadata after workspace changes", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-workspace-mcp-reload-"));

  try {
    await fs.mkdir(path.join(tempRoot, "src"), { recursive: true });
    await fs.writeFile(
      path.join(tempRoot, "package.json"),
      JSON.stringify({
        name: "reload-fixture",
        private: true,
      }, null, 2),
    );
    await fs.writeFile(
      path.join(tempRoot, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            target: "ES2022",
            module: "NodeNext",
            moduleResolution: "NodeNext",
            strict: true,
          },
          include: ["src/**/*.ts"],
        },
        null,
        2,
      ),
    );
    const entryFile = path.join(tempRoot, "src", "a.ts");
    await fs.writeFile(entryFile, "export const alpha = 1;\n");

    const { client, transport } = await createClientForLocalCli(projectRoot);

    try {
      const initial = await client.callTool({
        name: "reload_project",
        arguments: {
          workspaceRoot: tempRoot,
          file: entryFile,
        },
      });

      assert.equal(initial.isError, undefined);
      assert.equal((initial.structuredContent as { fileCount: number }).fileCount, 1);

      await fs.writeFile(path.join(tempRoot, "src", "b.ts"), "export const beta = 2;\n");

      const reloaded = await client.callTool({
        name: "reload_project",
        arguments: {
          workspaceRoot: tempRoot,
          file: entryFile,
        },
      });

      assert.equal(reloaded.isError, undefined);
      const project = reloaded.structuredContent as { workspaceRoot: string; packageRoot: string | null; fileCount: number };
      assert.equal(project.workspaceRoot, tempRoot);
      assert.equal(project.packageRoot, tempRoot);
      assert.equal(project.fileCount, 2);
    } finally {
      await closeClient(transport);
    }
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("tool failures are surfaced as MCP tool errors with actionable messages", async () => {
  const { workspaceRoot } = getFixturePaths();
  const { client, transport } = await createClientForLocalCli(projectRoot);

  try {
    await callToolExpectError(
      client,
      "get_diagnostics",
      {
        workspaceRoot,
        file: path.join(workspaceRoot, "packages", "app", "src", "missing.ts"),
      },
      /File not found|ENOENT|no such file or directory/i,
    );

    await callToolExpectError(
      client,
      "get_definition",
      {
        workspaceRoot,
        file: path.join(workspaceRoot, "packages", "app", "src", "index.ts"),
        line: 99,
        column: 1,
      },
      /outside the bounds|out of range|position|outside file range/i,
    );

    await callToolExpectError(
      client,
      "discover_repository_structure",
      {
        root: path.join(workspaceRoot, "does-not-exist"),
      },
      /Path not found/i,
    );
  } finally {
    await closeClient(transport);
  }
});
