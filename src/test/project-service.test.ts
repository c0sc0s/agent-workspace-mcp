import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { ProjectServiceCache } from "../project-service.js";

const fixtureRoot = path.resolve("fixtures/monorepo");
const appRoot = path.join(fixtureRoot, "packages", "app");
const appFile = path.join(appRoot, "src", "index.ts");

test("ProjectServiceCache returns diagnostics and resolved project metadata", () => {
  const cache = new ProjectServiceCache();
  const { diagnostics, project } = cache.getDiagnosticsWithMetadata(appFile, {
    workspaceRoot: fixtureRoot,
  });

  assert.deepEqual(diagnostics, []);
  assert.equal(project.workspaceRoot, fixtureRoot);
  assert.equal(project.packageRoot, appRoot);
  assert.equal(project.tsconfigPath, path.join(appRoot, "tsconfig.json"));
});

test("ProjectServiceCache resolves definitions, references, and symbol summaries", () => {
  const cache = new ProjectServiceCache();

  const definitions = cache.getDefinition(appFile, 1, 10, {
    workspaceRoot: fixtureRoot,
  });
  const { references } = cache.getReferences(appFile, 1, 10, {
    workspaceRoot: fixtureRoot,
  });
  const { symbol } = cache.getSymbolSummary(appFile, 1, 10, {
    workspaceRoot: fixtureRoot,
  });

  assert.ok(definitions.some((item) => item.file.includes("/shared/src/math.ts") || item.file.includes("\\shared\\src\\math.ts")));
  assert.ok(references.some((item) => item.isDefinition));
  assert.equal(symbol?.kind, "alias");
  assert.match(symbol?.name ?? "", /add/);
});
