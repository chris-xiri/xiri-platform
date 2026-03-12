import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    format: ["cjs", "esm"],
    dts: false,
    clean: true,
    splitting: false,
    external: ["jspdf"],
    onSuccess: "tsc --declaration --emitDeclarationOnly --outDir dist",
});
