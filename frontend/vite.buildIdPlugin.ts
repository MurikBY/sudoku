import { createHash, randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

export function buildIdPlugin(): Plugin {
  const buildId = createHash("sha256")
    .update(randomBytes(16))
    .update(String(Date.now()))
    .digest("hex")
    .slice(0, 16);

  return {
    name: "sudoku-build-id",
    config() {
      return {
        define: {
          "import.meta.env.VITE_BUILD_ID": JSON.stringify(buildId),
        },
      };
    },
    writeBundle(outputOptions) {
      const outDir = outputOptions.dir;
      if (!outDir) {
        throw new Error("Vite writeBundle did not provide output.dir");
      }
      writeFileSync(path.join(outDir, "version.json"), `${JSON.stringify({ buildId }, null, 2)}\n`);
    },
  };
}
