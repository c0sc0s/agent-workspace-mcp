import ts from "typescript";

export type DiagnosticCategory = keyof typeof ts.DiagnosticCategory;
export type PackageKind = "application" | "library" | "tooling" | "unknown";
export type ConfidenceLevel = "high" | "medium" | "low";

export interface DiagnosticItem {
  code: number;
  category: DiagnosticCategory;
  message: string;
  file: string;
  line: number;
  column: number;
  length: number;
}

export interface DefinitionItem {
  file: string;
  line: number;
  column: number;
  length: number;
  symbol: string | null;
}

export interface ReferenceItem {
  file: string;
  line: number;
  column: number;
  length: number;
  isDefinition: boolean;
  symbol: string | null;
}

export interface SymbolSummary {
  name: string;
  kind: string;
  display: string | null;
  documentation: string | null;
  declaration: DefinitionItem | null;
}

export interface ProjectMetadata {
  workspaceRoot: string;
  packageRoot: string | null;
  tsconfigPath: string;
}

export interface ProjectInfo {
  [key: string]: unknown;
  workspaceRoot: string;
  packageRoot: string | null;
  tsconfigPath: string;
  compilerOptions: Record<string, unknown>;
  fileCount: number;
}

export interface BaseToolArgs {
  file?: string | undefined;
  workspaceRoot?: string | undefined;
  projectTsconfigPath?: string | undefined;
}

export interface DefinitionArgs extends BaseToolArgs {
  file: string;
  line: number;
  column: number;
}

export interface DiagnosticsArgs extends BaseToolArgs {
  file: string;
}

export interface ReloadProjectArgs extends BaseToolArgs {
  file?: string | undefined;
}

export interface PositionArgs extends BaseToolArgs {
  file: string;
  line: number;
  column: number;
}

export interface InspectRepositoryArgs {
  root: string;
}

export interface WebProjectContextArgs {
  root: string;
}

export interface PackageClassificationSignal {
  [key: string]: unknown;
  label: string;
  reason: string;
}

export interface PackageInfo {
  [key: string]: unknown;
  packageRoot: string;
  packageJsonPath: string;
  packageName: string | null;
  tsconfigPath: string | null;
  kind: PackageKind;
  confidence: ConfidenceLevel;
  signals: PackageClassificationSignal[];
  entryPoints: string[];
  routeFiles: string[];
  configFiles: string[];
}

export interface RepositoryDiscoveryResult {
  [key: string]: unknown;
  root: string;
  workspaceFiles: string[];
  tsconfigPaths: string[];
  packages: PackageInfo[];
}

export interface WebProjectContextResult {
  [key: string]: unknown;
  root: string;
  packageRoot: string | null;
  kind: PackageKind;
  confidence: ConfidenceLevel;
  frameworkHints: string[];
  entryPoints: string[];
  routingSurfaces: string[];
  configFiles: string[];
  signals: PackageClassificationSignal[];
}
