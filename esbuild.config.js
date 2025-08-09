import esbuild from "esbuild";
import { execSync } from "child_process";
import fs from "fs";

async function build() {
  // Clean dist directory
  if (fs.existsSync("dist")) {
    fs.rmSync("dist", { recursive: true });
  }
  fs.mkdirSync("dist", { recursive: true });

  // Generate TypeScript declarations
  console.log("Generating TypeScript declarations...");
  execSync("tsc --emitDeclarationOnly", { stdio: "inherit" });

  // Build CommonJS version
  console.log("Building CommonJS version...");
  await esbuild.build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    minify: false,
    sourcemap: true,
    platform: "node",
    target: ["node18", "node20", "node22"],
    format: "cjs",
    outfile: "dist/index.js",
    external: [],
    banner: {
      js: "/* playwright-results-parser - MIT License */",
    },
  });

  // Build ESM version
  console.log("Building ESM version...");
  await esbuild.build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    minify: false,
    sourcemap: true,
    platform: "node",
    target: ["node18", "node20", "node22"],
    format: "esm",
    outfile: "dist/index.mjs",
    external: [],
    banner: {
      js: "/* playwright-results-parser - MIT License */",
    },
  });

  console.log("Build completed successfully!");
}

build().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
