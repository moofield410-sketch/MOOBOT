// Reports what is in data/orbio_agents.csv: row count and columns.
// Usage: npm run inspect:csv [-- path/to/file.csv]
//
// Later this file becomes the list of tokens to check on-chain for graduation.
// It is NOT used for the Masters list: graduation must come from the chain.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const file = resolve(process.argv[2] ?? "data/orbio_agents.csv");
const text = readFileSync(file, "utf8").replace(/^\uFEFF/, "");

/** Minimal RFC 4180 parser: handles quoted fields, escaped quotes and newlines inside quotes. */
function parseCsv(src) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

const [header, ...rows] = parseCsv(text);

console.log(`File:    ${file}`);
console.log(`Rows:    ${rows.length} (excluding header)`);
console.log(`Columns: ${header.length}`);
console.log("");

const width = Math.max(...header.map((h) => h.length));
header.forEach((name, i) => {
  const filled = rows.filter((r) => (r[i] ?? "").trim() !== "").length;
  console.log(`  ${String(i + 1).padStart(2)}. ${name.padEnd(width)}  ${filled}/${rows.length} filled`);
});

const ragged = rows.filter((r) => r.length !== header.length).length;
if (ragged > 0) console.log(`\nWarning: ${ragged} row(s) have a different number of fields than the header.`);
