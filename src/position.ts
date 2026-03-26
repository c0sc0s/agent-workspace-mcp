import ts from "typescript";

export interface LineColumn {
  line: number;
  column: number;
}

export function toLineColumn(sourceFile: ts.SourceFile, position: number): LineColumn {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(position);
  return {
    line: line + 1,
    column: character + 1,
  };
}

export function toOffset(sourceFile: ts.SourceFile, line: number, column: number): number {
  if (line < 1 || column < 1) {
    throw new Error(`line and column must be >= 1, received ${line}:${column}`);
  }

  const lineStarts = sourceFile.getLineStarts();
  if (line > lineStarts.length) {
    throw new Error(`line ${line} is outside file range`);
  }

  const lineStart = lineStarts[line - 1]!;
  const nextLineStart = line < lineStarts.length ? lineStarts[line]! : sourceFile.end;
  const lineLength = nextLineStart - lineStart;
  const maxColumn = lineLength + 1;

  if (column > maxColumn) {
    throw new Error(`column ${column} is outside line ${line}; valid range is 1-${maxColumn}`);
  }

  return lineStart + (column - 1);
}
