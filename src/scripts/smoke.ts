import path from "node:path";

import { assertFixtureContract, closeClient, collectFixtureContract, createClientForBuiltCli } from "../testing/mcp-contract.js";

function assertArgument(value: string | undefined, label: string): string {
  if (!value) {
    throw new Error(`Missing required argument: ${label}`);
  }

  return value;
}

async function main(): Promise<void> {
  const workspaceRoot = path.resolve(assertArgument(process.argv[2], "workspaceRoot"));
  const file = path.resolve(assertArgument(process.argv[3], "file"));
  const line = Number(process.argv[4] ?? "1");
  const column = Number(process.argv[5] ?? "1");

  const expectedWorkspaceRoot = path.resolve("fixtures/monorepo");
  const expectedFile = path.resolve(path.join(expectedWorkspaceRoot, "packages", "app", "src", "index.ts"));
  if (workspaceRoot !== expectedWorkspaceRoot || file !== expectedFile || line !== 1 || column !== 10) {
    throw new Error(
      `Smoke script expects fixture inputs ${expectedWorkspaceRoot} ${expectedFile} 1 10, received ${workspaceRoot} ${file} ${line} ${column}`,
    );
  }

  const { client, transport } = await createClientForBuiltCli(process.cwd());

  try {
    const payload = await collectFixtureContract(client);
    assertFixtureContract(payload);
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } finally {
    await closeClient(transport);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
