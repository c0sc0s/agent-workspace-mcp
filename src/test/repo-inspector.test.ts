import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { getWebProjectContext, inspectRepository } from "../repo-inspector.js";

const fixtureRoot = path.resolve("fixtures/monorepo");

test("inspectRepository discovers monorepo packages and tsconfig files", () => {
  const result = inspectRepository(fixtureRoot);

  assert.equal(result.root, fixtureRoot);
  assert.ok(result.workspaceFiles.some((file) => file.endsWith("pnpm-workspace.yaml")));
  assert.equal(result.packages.length, 3);
  assert.ok(result.tsconfigPaths.some((file) => file.includes("/packages/app/tsconfig.json") || file.includes("\\packages\\app\\tsconfig.json")));
});

test("getWebProjectContext identifies the fixture app package as an application", () => {
  const appRoot = path.join(fixtureRoot, "packages", "app");
  const result = getWebProjectContext(appRoot);

  assert.equal(result.packageRoot, appRoot);
  assert.equal(result.kind, "application");
  assert.equal(result.confidence, "high");
  assert.ok(result.entryPoints.some((file) => file.includes("/src/main.tsx") || file.includes("\\src\\main.tsx")));
});

test("getWebProjectContext prefers the best matching nested package for a workspace root", () => {
  const result = getWebProjectContext(fixtureRoot);

  assert.equal(result.packageRoot, path.join(fixtureRoot, "packages", "app"));
  assert.equal(result.kind, "application");
});
