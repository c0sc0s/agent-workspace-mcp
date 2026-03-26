import { defineConfig } from "@rslib/core";

export default defineConfig({
  source: {
    entry: {
      index: "./src/index.ts",
      cli: "./src/cli.ts",
    },
  },
  lib: [
    {
      format: "esm",
      syntax: "es2022",
      bundle: true,
      dts: true,
    },
  ],
  output: {
    target: "node",
    cleanDistPath: true,
    sourceMap: true,
  },
});
