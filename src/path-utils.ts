import path from "node:path";

const WINDOWS_PATH_PREFIX = /^[A-Za-z]:[\\/]/;

export function normalizeSlashes(value: string): string {
  return value.replace(/[\\/]+/g, path.sep);
}

export function toAbsolutePath(value: string): string {
  return path.resolve(normalizeSlashes(value));
}

export function canonicalPath(value: string): string {
  const absolute = path.normalize(toAbsolutePath(value));
  return process.platform === "win32" ? absolute.toLowerCase() : absolute;
}

export function isWithinPath(parentPath: string, candidatePath: string): boolean {
  const parent = canonicalPath(parentPath);
  const candidate = canonicalPath(candidatePath);
  return candidate === parent || candidate.startsWith(`${parent}${path.sep}`);
}

export function isSupportedSourceFile(filePath: string): boolean {
  return /\.(tsx?|jsx?|d\.ts)$/i.test(filePath);
}

export function maybeFilePath(value: string): boolean {
  return WINDOWS_PATH_PREFIX.test(value) || value.startsWith(".") || value.startsWith(path.sep);
}
