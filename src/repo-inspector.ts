import fs from "node:fs";
import path from "node:path";

import { canonicalPath, toAbsolutePath } from "./path-utils.js";
import type {
  ConfidenceLevel,
  PackageClassificationSignal,
  PackageInfo,
  PackageKind,
  RepositoryDiscoveryResult,
  WebProjectContextResult,
} from "./types.js";

const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".turbo",
  "coverage",
  "dist",
  "build",
  "node_modules",
  "out",
  "tmp",
]);

const WORKSPACE_FILES = ["pnpm-workspace.yaml", "turbo.json", "nx.json", "rush.json", "package.json"];
const PACKAGE_TSCONFIG_NAMES = ["tsconfig.json", "tsconfig.app.json", "tsconfig.build.json"];
const ENTRY_POINT_CANDIDATES = [
  "src/main.ts",
  "src/main.tsx",
  "src/index.tsx",
  "app/layout.tsx",
  "app/page.tsx",
  "pages/_app.tsx",
  "pages/index.tsx",
];
const ROUTE_SURFACE_CANDIDATES = [
  "app",
  "pages",
  "src/routes",
  "src/router.ts",
  "src/router.tsx",
  "src/routes.ts",
  "src/routes.tsx",
];
const CONFIG_FILE_CANDIDATES = [
  "next.config.js",
  "next.config.mjs",
  "next.config.ts",
  "vite.config.js",
  "vite.config.mjs",
  "vite.config.ts",
  "webpack.config.js",
  "webpack.config.ts",
  "rsbuild.config.ts",
  "rsbuild.config.js",
];

interface PackageJson {
  name?: string;
  private?: boolean;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export function inspectRepository(root: string): RepositoryDiscoveryResult {
  const normalizedRoot = toSearchRoot(root);
  const directories = collectDirectories(normalizedRoot);
  const workspaceFiles = collectWorkspaceFiles(normalizedRoot);
  const tsconfigPaths = directories.flatMap((directory) => findDirectChildren(directory, PACKAGE_TSCONFIG_NAMES));
  const packageJsonPaths = directories
    .map((directory) => path.join(directory, "package.json"))
    .filter((packageJsonPath) => fs.existsSync(packageJsonPath));
  const packages = packageJsonPaths.map((packageJsonPath) => inspectPackage(packageJsonPath)).sort(comparePackageInfo);

  return {
    root: normalizedRoot,
    workspaceFiles: workspaceFiles.sort(compareByPath),
    tsconfigPaths: uniquePaths(tsconfigPaths),
    packages,
  };
}

export function getPackageRootForPath(targetPath: string, workspaceRoot?: string): string | null {
  let current = fs.statSync(targetPath).isDirectory() ? toAbsolutePath(targetPath) : path.dirname(toAbsolutePath(targetPath));
  const stop = workspaceRoot ? toAbsolutePath(workspaceRoot) : path.parse(current).root;

  while (true) {
    if (fs.existsSync(path.join(current, "package.json"))) {
      return current;
    }

    if (canonicalPath(current) === canonicalPath(stop)) {
      return null;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }

    current = parent;
  }
}

export function getWebProjectContext(root: string): WebProjectContextResult {
  const discovery = inspectRepository(root);
  const candidate = selectBestContextPackage(discovery.packages, discovery.root);

  if (!candidate) {
    return {
      root: discovery.root,
      packageRoot: null,
      kind: "unknown",
      confidence: "low",
      frameworkHints: [],
      entryPoints: [],
      routingSurfaces: [],
      configFiles: [],
      signals: [],
    };
  }

  return {
    root: discovery.root,
    packageRoot: candidate.packageRoot,
    kind: candidate.kind,
    confidence: candidate.confidence,
    frameworkHints: deriveFrameworkHints(candidate),
    entryPoints: candidate.entryPoints,
    routingSurfaces: candidate.routeFiles,
    configFiles: candidate.configFiles,
    signals: candidate.signals,
  };
}

function selectBestContextPackage(packages: PackageInfo[], root: string): PackageInfo | null {
  const scopedPackages = packages.filter((pkg) => isWithin(root, pkg.packageRoot) || isWithin(pkg.packageRoot, root));
  if (scopedPackages.length === 0) {
    return null;
  }

  return [...scopedPackages].sort((left, right) => compareContextCandidate(left, right, root))[0] ?? null;
}

function inspectPackage(packageJsonPath: string): PackageInfo {
  const packageRoot = path.dirname(packageJsonPath);
  const packageJson = readPackageJson(packageJsonPath);
  const signals: PackageClassificationSignal[] = [];
  const entryPoints = findDirectChildren(packageRoot, ENTRY_POINT_CANDIDATES);
  const routeFiles = findDirectChildren(packageRoot, ROUTE_SURFACE_CANDIDATES);
  const configFiles = uniquePaths([
    ...findDirectChildren(packageRoot, CONFIG_FILE_CANDIDATES),
    ...findDirectChildren(packageRoot, PACKAGE_TSCONFIG_NAMES),
  ]);
  const tsconfigPath = findNearestExisting(packageRoot, PACKAGE_TSCONFIG_NAMES);
  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };
  const scripts = packageJson.scripts ?? {};

  if (entryPoints.length > 0) {
    signals.push({
      label: "web-entrypoint",
      reason: `Matched entry files: ${entryPoints.map((entryPoint) => path.relative(packageRoot, entryPoint)).join(", ")}`,
    });
  }

  if (routeFiles.length > 0) {
    signals.push({
      label: "routing-surface",
      reason: `Matched routing files: ${routeFiles.map((routeFile) => path.relative(packageRoot, routeFile)).join(", ")}`,
    });
  }

  if (matchDependency(dependencies, ["next"])) {
    signals.push({ label: "framework-next", reason: "Dependency graph includes next" });
  }

  if (matchDependency(dependencies, ["react", "react-dom"])) {
    signals.push({ label: "framework-react", reason: "Dependency graph includes react" });
  }

  if (matchDependency(dependencies, ["vite"])) {
    signals.push({ label: "bundler-vite", reason: "Dependency graph includes vite" });
  }

  if (matchDependency(dependencies, ["@rsbuild/core"])) {
    signals.push({ label: "bundler-rsbuild", reason: "Dependency graph includes @rsbuild/core" });
  }

  if ("dev" in scripts || "start" in scripts || "preview" in scripts) {
    signals.push({ label: "runtime-scripts", reason: "package.json exposes runtime-oriented scripts" });
  }

  if ("build" in scripts && !("dev" in scripts) && !("start" in scripts)) {
    signals.push({ label: "build-script-only", reason: "package.json exposes build-only scripting" });
  }

  if (matchDependency(dependencies, ["typescript", "tsup", "tsx"]) && entryPoints.length === 0 && routeFiles.length === 0) {
    signals.push({ label: "library-tooling", reason: "TypeScript tooling present without app entrypoints" });
  }

  const { kind, confidence } = classifyPackage(signals);

  return {
    packageRoot,
    packageJsonPath,
    packageName: packageJson.name ?? null,
    tsconfigPath,
    kind,
    confidence,
    signals,
    entryPoints,
    routeFiles,
    configFiles,
  };
}

function classifyPackage(signals: PackageClassificationSignal[]): { kind: PackageKind; confidence: ConfidenceLevel } {
  const labels = new Set(signals.map((signal) => signal.label));

  if (
    labels.has("web-entrypoint") ||
    labels.has("routing-surface") ||
    labels.has("framework-next") ||
    labels.has("bundler-vite") ||
    labels.has("bundler-rsbuild")
  ) {
    return { kind: "application", confidence: labels.has("web-entrypoint") || labels.has("routing-surface") ? "high" : "medium" };
  }

  if (labels.has("library-tooling")) {
    return { kind: "library", confidence: "medium" };
  }

  if (labels.has("build-script-only")) {
    return { kind: "tooling", confidence: "low" };
  }

  return { kind: "unknown", confidence: "low" };
}

function deriveFrameworkHints(pkg: PackageInfo): string[] {
  const hints = new Set<string>();

  for (const signal of pkg.signals) {
    if (signal.label === "framework-next") {
      hints.add("next");
    }
    if (signal.label === "framework-react") {
      hints.add("react");
    }
    if (signal.label === "bundler-vite") {
      hints.add("vite");
    }
    if (signal.label === "bundler-rsbuild") {
      hints.add("rsbuild");
    }
  }

  return [...hints].sort();
}

function collectWorkspaceFiles(root: string): string[] {
  return WORKSPACE_FILES.map((fileName) => path.join(root, fileName)).filter((filePath) => fs.existsSync(filePath));
}

function collectDirectories(root: string): string[] {
  const directories: string[] = [];
  const queue = [root];
  const seen = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    const key = canonicalPath(current);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    directories.push(current);

    const entries = safeReadDir(current);
    for (const entry of entries) {
      if (!entry.isDirectory() || IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }

      queue.push(path.join(current, entry.name));
    }
  }

  return directories;
}

function safeReadDir(directory: string): fs.Dirent[] {
  try {
    return fs.readdirSync(directory, { withFileTypes: true });
  } catch {
    return [];
  }
}

function findDirectChildren(directory: string, relativeCandidates: string[]): string[] {
  return relativeCandidates
    .map((candidate) => path.join(directory, candidate))
    .filter((candidatePath) => fs.existsSync(candidatePath));
}

function findNearestExisting(directory: string, fileNames: string[]): string | null {
  for (const fileName of fileNames) {
    const candidate = path.join(directory, fileName);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function readPackageJson(packageJsonPath: string): PackageJson {
  try {
    return JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as PackageJson;
  } catch {
    return {};
  }
}

function matchDependency(dependencies: Record<string, string> | undefined, names: string[]): boolean {
  if (!dependencies) {
    return false;
  }

  return names.some((name) => name in dependencies);
}

function uniquePaths(paths: string[]): string[] {
  return [...new Map(paths.map((value) => [canonicalPath(value), value])).values()].sort(compareByPath);
}

function toSearchRoot(root: string): string {
  const absolute = toAbsolutePath(root);
  if (!fs.existsSync(absolute)) {
    throw new Error(`Path not found: ${absolute}`);
  }

  const stat = fs.statSync(absolute);
  return stat.isDirectory() ? absolute : path.dirname(absolute);
}

function isWithin(parentPath: string, candidatePath: string): boolean {
  const parent = canonicalPath(parentPath);
  const candidate = canonicalPath(candidatePath);
  return candidate === parent || candidate.startsWith(`${parent}${path.sep}`);
}

function compareByPath(left: string, right: string): number {
  return left.localeCompare(right);
}

function comparePackageInfo(left: PackageInfo, right: PackageInfo): number {
  return compareByPath(left.packageRoot, right.packageRoot);
}

function compareContextCandidate(left: PackageInfo, right: PackageInfo, root: string): number {
  return scoreContextCandidate(right, root) - scoreContextCandidate(left, root) || comparePackageInfo(left, right);
}

function scoreContextCandidate(pkg: PackageInfo, root: string): number {
  const exactRoot = canonicalPath(pkg.packageRoot) === canonicalPath(root) ? 1 : 0;
  const kindScore = pkg.kind === "application" ? 40 : pkg.kind === "library" ? 20 : pkg.kind === "tooling" ? 10 : 0;
  const confidenceScore = pkg.confidence === "high" ? 6 : pkg.confidence === "medium" ? 3 : 0;

  return kindScore + confidenceScore + exactRoot;
}
