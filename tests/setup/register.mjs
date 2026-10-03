// Lets Node's built-in test runner load the app's TypeScript directly:
// maps "@/x" to the project root and resolves extensionless imports to .ts files.
// (Node 24 strips TypeScript types natively, so no bundler or native binary is needed.)

import { existsSync } from "node:fs";
import { registerHooks } from "node:module";

const root = new URL("../../", import.meta.url);
const EXTS = [".ts", ".tsx", "/index.ts"];

registerHooks({
  resolve(specifier, context, next) {
    let spec = specifier.startsWith("@/") ? new URL(specifier.slice(2), root).href : specifier;
    const isLocal = spec.startsWith("file:") || spec.startsWith("./") || spec.startsWith("../");
    if (isLocal && !/\.[cm]?[jt]sx?$/.test(spec)) {
      const base = new URL(spec, context.parentURL).href;
      const hit = EXTS.map((ext) => new URL(base + ext)).find((u) => existsSync(u));
      if (hit) spec = hit.href;
    }
    return next(spec, context);
  },
});
