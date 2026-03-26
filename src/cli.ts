import { startServer } from "./server.js";
import { PACKAGE_NAME, PACKAGE_VERSION } from "./version.js";

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command === "setup-codex" || command === "--setup-codex") {
    const { runSetupCodexPublished } = await import("./scripts/setup-codex-published.js");
    await runSetupCodexPublished();
    return;
  }

  if (command === "--version" || command === "-v") {
    console.log(PACKAGE_VERSION);
    return;
  }

  if (command === "--help" || command === "-h") {
    console.log([
      `${PACKAGE_NAME} ${PACKAGE_VERSION}`,
      "",
      "Usage:",
      `  ${PACKAGE_NAME}`,
      `  ${PACKAGE_NAME} --setup-codex`,
      `  ${PACKAGE_NAME} setup-codex`,
      `  ${PACKAGE_NAME} --version`,
      "",
      "Commands:",
      "  --setup-codex, setup-codex  Write a Codex MCP config entry and exit.",
      "  --version, -v               Print the package version and exit.",
      "  --help, -h                  Print this help text and exit.",
      "",
    ].join("\n"));
    return;
  }

  await startServer();
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
