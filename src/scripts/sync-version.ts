import fs from "node:fs/promises";
import path from "node:path";

interface PackageJsonShape {
  name: string;
  version: string;
}

async function main(): Promise<void> {
  const projectRoot = process.cwd();
  const packageJsonPath = path.join(projectRoot, "package.json");
  const versionModulePath = path.join(projectRoot, "src", "version.ts");

  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8")) as PackageJsonShape;
  const nextContents = [
    `export const PACKAGE_NAME = ${JSON.stringify(packageJson.name)};`,
    `export const PACKAGE_VERSION = ${JSON.stringify(packageJson.version)};`,
    "",
  ].join("\n");

  const currentContents = await readIfExists(versionModulePath);
  if (currentContents !== nextContents) {
    await fs.writeFile(versionModulePath, nextContents, "utf8");
  }
}

async function readIfExists(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error: unknown) {
    const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code) : "";
    if (code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
