import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

import { canonicalPath, isSupportedSourceFile, isWithinPath, toAbsolutePath } from "./path-utils.js";
import { toLineColumn, toOffset } from "./position.js";
import { getPackageRootForPath } from "./repo-inspector.js";
import type { DefinitionItem, DiagnosticItem, ProjectInfo, ProjectMetadata, ReferenceItem, SymbolSummary } from "./types.js";

interface FileVersionEntry {
  version: number;
  modifiedTimeMs: number;
}

interface ResolvedProject {
  workspaceRoot: string;
  packageRoot: string | null;
  tsconfigPath: string;
  parsedConfig: ts.ParsedCommandLine;
}

export interface ProjectLookupOptions {
  file?: string;
  workspaceRoot?: string;
  projectTsconfigPath?: string;
}

class ProjectService {
  private readonly workspaceRoot: string;
  private packageRoot: string | null;
  private tsconfigPath: string;
  private parsedConfig: ts.ParsedCommandLine;
  private readonly fileVersions = new Map<string, FileVersionEntry>();
  private languageServiceHost: ts.LanguageServiceHost;
  private languageService: ts.LanguageService;
  private tsconfigModifiedTimeMs: number;

  constructor(project: ResolvedProject) {
    this.workspaceRoot = project.workspaceRoot;
    this.packageRoot = project.packageRoot;
    this.tsconfigPath = project.tsconfigPath;
    this.parsedConfig = project.parsedConfig;
    this.tsconfigModifiedTimeMs = getModifiedTimeMs(this.tsconfigPath);

    this.seedFileVersions(this.parsedConfig.fileNames);
    this.languageServiceHost = this.createLanguageServiceHost();
    this.languageService = ts.createLanguageService(this.languageServiceHost, ts.createDocumentRegistry());
  }

  public getProjectInfo(): ProjectInfo {
    return {
      workspaceRoot: this.workspaceRoot,
      packageRoot: this.packageRoot,
      tsconfigPath: this.tsconfigPath,
      compilerOptions: this.parsedConfig.options as Record<string, unknown>,
      fileCount: this.getScriptFileNames().length,
    };
  }

  public reload(project?: ResolvedProject): ProjectInfo {
    if (project) {
      this.packageRoot = project.packageRoot;
      this.tsconfigPath = project.tsconfigPath;
      this.parsedConfig = project.parsedConfig;
    } else {
      this.parsedConfig = parseTsConfig(this.tsconfigPath);
    }

    this.tsconfigModifiedTimeMs = getModifiedTimeMs(this.tsconfigPath);
    this.fileVersions.clear();
    this.seedFileVersions(this.parsedConfig.fileNames);
    this.languageService.cleanupSemanticCache();
    this.languageServiceHost = this.createLanguageServiceHost();
    this.languageService.dispose();
    this.languageService = ts.createLanguageService(this.languageServiceHost, ts.createDocumentRegistry());

    return this.getProjectInfo();
  }

  public getDiagnostics(filePath: string): DiagnosticItem[] {
    const normalizedFile = this.prepareFile(filePath);
    const diagnostics = [
      ...this.languageService.getSyntacticDiagnostics(normalizedFile),
      ...this.languageService.getSemanticDiagnostics(normalizedFile),
    ];

    return diagnostics
      .filter((diagnostic) => canonicalPath(diagnostic.file?.fileName ?? normalizedFile) === canonicalPath(normalizedFile))
      .map((diagnostic) => toDiagnosticItem(normalizedFile, diagnostic));
  }

  public getDefinition(filePath: string, line: number, column: number): DefinitionItem[] {
    const normalizedFile = this.prepareFile(filePath);
    const sourceFile = this.languageService.getProgram()?.getSourceFile(normalizedFile);
    if (!sourceFile) {
      throw new Error(`TypeScript program did not include ${normalizedFile}`);
    }

    const offset = toOffset(sourceFile, line, column);
    const definitions = this.languageService.getDefinitionAtPosition(normalizedFile, offset) ?? [];

    return definitions.map((definition) => {
      return this.toDefinitionItem(definition.fileName, definition.textSpan.start, definition.textSpan.length);
    });
  }

  public getReferences(filePath: string, line: number, column: number): ReferenceItem[] {
    const normalizedFile = this.prepareFile(filePath);
    const sourceFile = this.languageService.getProgram()?.getSourceFile(normalizedFile);
    if (!sourceFile) {
      throw new Error(`TypeScript program did not include ${normalizedFile}`);
    }

    const offset = toOffset(sourceFile, line, column);
    const references = this.languageService.getReferencesAtPosition(normalizedFile, offset) ?? [];
    const definitionKeys = new Set(
      (this.languageService.getDefinitionAtPosition(normalizedFile, offset) ?? [])
        .map((definition) => this.toDefinitionItem(definition.fileName, definition.textSpan.start, definition.textSpan.length))
        .map((definition) => `${canonicalPath(definition.file)}:${definition.line}:${definition.column}`),
    );

    return references.map((reference) => {
      const item = this.toDefinitionItem(reference.fileName, reference.textSpan.start, reference.textSpan.length);
      return {
        ...item,
        isDefinition: definitionKeys.has(`${canonicalPath(item.file)}:${item.line}:${item.column}`),
      };
    });
  }

  public getSymbolSummary(filePath: string, line: number, column: number): SymbolSummary | null {
    const normalizedFile = this.prepareFile(filePath);
    const sourceFile = this.languageService.getProgram()?.getSourceFile(normalizedFile);
    if (!sourceFile) {
      throw new Error(`TypeScript program did not include ${normalizedFile}`);
    }

    const offset = toOffset(sourceFile, line, column);
    const quickInfo = this.languageService.getQuickInfoAtPosition(normalizedFile, offset);
    if (!quickInfo) {
      return null;
    }

    const definition = (this.languageService.getDefinitionAtPosition(normalizedFile, offset) ?? [])[0];

    return {
      name: ts.displayPartsToString(quickInfo.displayParts),
      kind: quickInfo.kind,
      display: quickInfo.displayParts ? ts.displayPartsToString(quickInfo.displayParts) : null,
      documentation: quickInfo.documentation ? ts.displayPartsToString(quickInfo.documentation) : null,
      declaration: definition ? this.toDefinitionItem(definition.fileName, definition.textSpan.start, definition.textSpan.length) : null,
    };
  }

  public getProjectMetadata(): ProjectMetadata {
    return {
      workspaceRoot: this.workspaceRoot,
      packageRoot: this.packageRoot,
      tsconfigPath: this.tsconfigPath,
    };
  }

  private prepareFile(filePath: string): string {
    this.refreshProjectIfNeeded();

    const normalizedFile = toAbsolutePath(filePath);
    if (!fs.existsSync(normalizedFile)) {
      throw new Error(`File not found: ${normalizedFile}`);
    }

    if (!isSupportedSourceFile(normalizedFile)) {
      throw new Error(`Unsupported file extension for ${normalizedFile}`);
    }

    if (!isWithinPath(this.workspaceRoot, normalizedFile)) {
      throw new Error(`File ${normalizedFile} is outside workspace root ${this.workspaceRoot}`);
    }

    if (!this.fileVersions.has(canonicalPath(normalizedFile))) {
      this.fileVersions.set(canonicalPath(normalizedFile), createFileVersion(normalizedFile));
    }

    this.bumpVersionIfChanged(normalizedFile);
    return normalizedFile;
  }

  private refreshProjectIfNeeded(): void {
    const currentTsconfigMtime = getModifiedTimeMs(this.tsconfigPath);
    if (currentTsconfigMtime !== this.tsconfigModifiedTimeMs) {
      this.reload();
      return;
    }

    for (const scriptFileName of this.getScriptFileNames()) {
      this.bumpVersionIfChanged(scriptFileName);
    }
  }

  private bumpVersionIfChanged(filePath: string): void {
    const key = canonicalPath(filePath);
    const existing = this.fileVersions.get(key);
    const modifiedTimeMs = getModifiedTimeMs(filePath);

    if (!existing) {
      this.fileVersions.set(key, { version: 1, modifiedTimeMs });
      return;
    }

    if (modifiedTimeMs !== existing.modifiedTimeMs) {
      this.fileVersions.set(key, {
        version: existing.version + 1,
        modifiedTimeMs,
      });
    }
  }

  private seedFileVersions(fileNames: string[]): void {
    for (const fileName of fileNames.filter(isSupportedSourceFile)) {
      this.fileVersions.set(canonicalPath(fileName), createFileVersion(fileName));
    }
  }

  private getScriptFileNames(): string[] {
    return [...new Set(this.parsedConfig.fileNames.filter(isSupportedSourceFile).map(toAbsolutePath))];
  }

  private createLanguageServiceHost(): ts.LanguageServiceHost {
    return {
      getCompilationSettings: () => this.parsedConfig.options,
      getCurrentDirectory: () => this.workspaceRoot,
      getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
      getProjectVersion: () => String(this.tsconfigModifiedTimeMs),
      getScriptFileNames: () => this.getScriptFileNames(),
      getScriptSnapshot: (fileName) => {
        if (!fs.existsSync(fileName)) {
          return undefined;
        }

        return ts.ScriptSnapshot.fromString(fs.readFileSync(fileName, "utf8"));
      },
      getScriptVersion: (fileName) => String(this.fileVersions.get(canonicalPath(fileName))?.version ?? 1),
      fileExists: fs.existsSync,
      readFile: (fileName) => (fs.existsSync(fileName) ? fs.readFileSync(fileName, "utf8") : undefined),
      readDirectory: ts.sys.readDirectory,
      directoryExists: ts.sys.directoryExists,
      getDirectories: ts.sys.getDirectories,
      realpath: ts.sys.realpath ?? ((fileName) => fileName),
      useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
    };
  }

  private toDefinitionItem(fileName: string, start: number, length: number): DefinitionItem {
    const definitionSource = this.languageService.getProgram()?.getSourceFile(fileName);
    if (!definitionSource) {
      throw new Error(`Unable to load definition source file: ${fileName}`);
    }

    const position = toLineColumn(definitionSource, start);
    const quickInfo = this.languageService.getQuickInfoAtPosition(fileName, start);

    return {
      file: fileName,
      line: position.line,
      column: position.column,
      length,
      symbol: quickInfo ? ts.displayPartsToString(quickInfo.displayParts) : null,
    };
  }
}

export class ProjectServiceCache {
  private readonly services = new Map<string, ProjectService>();

  public getProjectInfo(options: ProjectLookupOptions): ProjectInfo {
    return this.getOrCreate(options).getProjectInfo();
  }

  public getDiagnostics(filePath: string, options: ProjectLookupOptions): DiagnosticItem[] {
    return this.getOrCreate({ ...options, file: filePath }).getDiagnostics(filePath);
  }

  public getDiagnosticsWithMetadata(filePath: string, options: ProjectLookupOptions): { diagnostics: DiagnosticItem[]; project: ProjectMetadata } {
    const service = this.getOrCreate({ ...options, file: filePath });
    return {
      diagnostics: service.getDiagnostics(filePath),
      project: service.getProjectMetadata(),
    };
  }

  public getDefinition(filePath: string, line: number, column: number, options: ProjectLookupOptions): DefinitionItem[] {
    return this.getOrCreate({ ...options, file: filePath }).getDefinition(filePath, line, column);
  }

  public getDefinitionWithMetadata(
    filePath: string,
    line: number,
    column: number,
    options: ProjectLookupOptions,
  ): { definitions: DefinitionItem[]; project: ProjectMetadata } {
    const service = this.getOrCreate({ ...options, file: filePath });
    return {
      definitions: service.getDefinition(filePath, line, column),
      project: service.getProjectMetadata(),
    };
  }

  public getReferences(
    filePath: string,
    line: number,
    column: number,
    options: ProjectLookupOptions,
  ): { references: ReferenceItem[]; project: ProjectMetadata } {
    const service = this.getOrCreate({ ...options, file: filePath });
    return {
      references: service.getReferences(filePath, line, column),
      project: service.getProjectMetadata(),
    };
  }

  public getSymbolSummary(
    filePath: string,
    line: number,
    column: number,
    options: ProjectLookupOptions,
  ): { symbol: SymbolSummary | null; project: ProjectMetadata } {
    const service = this.getOrCreate({ ...options, file: filePath });
    return {
      symbol: service.getSymbolSummary(filePath, line, column),
      project: service.getProjectMetadata(),
    };
  }

  public reloadProject(options: ProjectLookupOptions): ProjectInfo {
    const project = resolveProject(options);
    const key = this.getCacheKey(project);
    const existing = this.services.get(key);
    if (!existing) {
      const created = new ProjectService(project);
      this.services.set(key, created);
      return created.getProjectInfo();
    }

    return existing.reload(project);
  }

  private getOrCreate(options: ProjectLookupOptions): ProjectService {
    const project = resolveProject(options);
    const key = this.getCacheKey(project);
    const existing = this.services.get(key);
    if (existing) {
      return existing;
    }

    const created = new ProjectService(project);
    this.services.set(key, created);
    return created;
  }

  private getCacheKey(project: ResolvedProject): string {
    const packageRoot = project.packageRoot ? canonicalPath(project.packageRoot) : "no-package-root";
    return `${packageRoot}::${canonicalPath(project.workspaceRoot)}::${canonicalPath(project.tsconfigPath)}`;
  }
}

function resolveProject(options: ProjectLookupOptions): ResolvedProject {
  const explicitTsconfig = options.projectTsconfigPath ? toAbsolutePath(options.projectTsconfigPath) : undefined;
  const explicitWorkspaceRoot = options.workspaceRoot ? toAbsolutePath(options.workspaceRoot) : undefined;
  const explicitFile = options.file ? toAbsolutePath(options.file) : undefined;

  if (explicitTsconfig) {
    if (!fs.existsSync(explicitTsconfig)) {
      throw new Error(`projectTsconfigPath not found: ${explicitTsconfig}`);
    }

    const workspaceRoot = explicitWorkspaceRoot ?? path.dirname(explicitTsconfig);
    return {
      workspaceRoot,
      packageRoot: getPackageRootForPath(explicitFile ?? explicitTsconfig, workspaceRoot),
      tsconfigPath: explicitTsconfig,
      parsedConfig: parseTsConfig(explicitTsconfig),
    };
  }

  const startDirectory = explicitFile ? path.dirname(explicitFile) : explicitWorkspaceRoot;
  if (!startDirectory) {
    throw new Error("Either file, workspaceRoot, or projectTsconfigPath is required");
  }

  const searchLimit = explicitWorkspaceRoot ?? path.parse(startDirectory).root;
  const tsconfigPath = findNearestTsconfig(startDirectory, searchLimit);
  if (!tsconfigPath) {
    throw new Error(`Unable to find tsconfig.json from ${startDirectory}`);
  }

  return {
    workspaceRoot: explicitWorkspaceRoot ?? path.dirname(tsconfigPath),
    packageRoot: getPackageRootForPath(explicitFile ?? startDirectory, explicitWorkspaceRoot ?? path.dirname(tsconfigPath)),
    tsconfigPath,
    parsedConfig: parseTsConfig(tsconfigPath),
  };
}

function parseTsConfig(tsconfigPath: string): ts.ParsedCommandLine {
  const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  if (configFile.error) {
    throw new Error(ts.formatDiagnostic(configFile.error, formatHost));
  }

  const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.dirname(tsconfigPath), undefined, tsconfigPath);
  if (parsed.errors.length > 0) {
    const formatted = ts.formatDiagnosticsWithColorAndContext(parsed.errors, formatHost);
    throw new Error(`Failed to parse tsconfig ${tsconfigPath}\n${formatted}`);
  }

  return parsed;
}

function findNearestTsconfig(startDirectory: string, stopDirectory: string): string | null {
  let current = toAbsolutePath(startDirectory);
  const stop = toAbsolutePath(stopDirectory);

  while (true) {
    const tsconfigPath = path.join(current, "tsconfig.json");
    if (fs.existsSync(tsconfigPath)) {
      return tsconfigPath;
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

function createFileVersion(fileName: string): FileVersionEntry {
  return {
    version: 1,
    modifiedTimeMs: getModifiedTimeMs(fileName),
  };
}

function getModifiedTimeMs(fileName: string): number {
  try {
    return fs.statSync(fileName).mtimeMs;
  } catch {
    return 0;
  }
}

function toDiagnosticItem(filePath: string, diagnostic: ts.Diagnostic): DiagnosticItem {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
  const file = diagnostic.file?.fileName ?? filePath;
  const sourceFile = diagnostic.file;
  const position = sourceFile && diagnostic.start !== undefined ? toLineColumn(sourceFile, diagnostic.start) : { line: 1, column: 1 };

  return {
    code: diagnostic.code,
    category: ts.DiagnosticCategory[diagnostic.category] as keyof typeof ts.DiagnosticCategory,
    message,
    file,
    line: position.line,
    column: position.column,
    length: diagnostic.length ?? 0,
  };
}

const formatHost: ts.FormatDiagnosticsHost = {
  getCanonicalFileName: (value) => value,
  getCurrentDirectory: () => process.cwd(),
  getNewLine: () => ts.sys.newLine,
};
