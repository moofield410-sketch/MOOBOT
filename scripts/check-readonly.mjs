// Fails if any source file uses a wallet-write API. Moofield v1 is read-only:
// no transactions, no token approvals, no wallet clients.
// Runs before every build (see package.json "build").

import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const ROOTS = ["app", "components", "lib", "config.ts", "netlify"];
const EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);

const FORBIDDEN = [
  /\bwriteContract\b/,
  /\bsendTransaction\b/,
  /\bsendRawTransaction\b/,
  /\bsignTransaction\b/,
  /\bcreateWalletClient\b/,
  /\bdeployContract\b/,
  /\buseWriteContract\b/,
  /\buseSendTransaction\b/,
  /\bincreaseAllowance\b/,
  /\bapprove\s*\(/,
  /functionName:\s*["'](approve|transfer|transferFrom|permit|setApprovalForAll)["']/,
  /eth_send(Raw)?Transaction/,
  /eth_signTransaction/,
];

function* walk(path) {
  const st = statSync(path, { throwIfNoEntry: false });
  if (!st) return;
  if (st.isFile()) {
    if (EXTS.has(extname(path))) yield path;
    return;
  }
  for (const entry of readdirSync(path)) yield* walk(join(path, entry));
}

const hits = [];
for (const root of ROOTS) {
  for (const file of walk(root)) {
    readFileSync(file, "utf8").split(/\r?\n/).forEach((line, i) => {
      for (const re of FORBIDDEN) {
        if (re.test(line)) hits.push(`${relative(".", file)}:${i + 1}  ${line.trim()}`);
      }
    });
  }
}

if (hits.length > 0) {
  console.error("Read-only check FAILED. Wallet-write APIs found:\n");
  for (const h of hits) console.error("  " + h);
  process.exit(1);
}
console.log("Read-only check passed: no transaction, approval or wallet-client calls found.");
