import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const html = await readFile(new URL("client/dist/index.html", root), "utf8");
const headers = await readFile(new URL("client/dist/_headers", root), "utf8");
const csp = headers.match(/^\s*Content-Security-Policy:\s*(.+)$/m)?.[1];

if (!csp) {
  console.error("The built _headers file has no Content-Security-Policy header.");
  process.exit(1);
}

const scriptPolicy = csp.match(/(?:^|;\s*)script-src\s+([^;]+)/)?.[1] ?? "";
if (scriptPolicy.includes("'unsafe-inline'")) {
  console.error("script-src must not allow unsafe-inline.");
  process.exit(1);
}

const inlineScripts = Array.from(html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)).filter(
  ([, attributes]) => !/\bsrc\s*=/i.test(attributes ?? ""),
);
const unauthorized = inlineScripts
  .map(([, , content]) => `'sha256-${createHash("sha256").update(content ?? "").digest("base64")}'`)
  .filter((hash) => !scriptPolicy.split(/\s+/).includes(hash));

if (unauthorized.length) {
  console.error("Inline scripts missing from script-src:", unauthorized);
  process.exit(1);
}

console.log(`CSP authorizes all ${inlineScripts.length} inline scripts by SHA-256 hash.`);
