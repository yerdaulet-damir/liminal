import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const tracked = execFileSync("git", ["ls-files", "-co", "--exclude-standard", "-z"], {
  cwd: root,
  encoding: "utf8",
}).split("\0").filter(Boolean);

const tokenPatterns = [
  /-----BEGIN (?:EC |OPENSSH |RSA )?PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bAIza[0-9A-Za-z_-]{30,}\b/,
  /\bgh[pousr]_[0-9A-Za-z]{30,}\b/,
  /\bgithub_pat_[0-9A-Za-z_]{40,}\b/,
  /\bsk-(?:proj-)?[0-9A-Za-z_-]{20,}\b/,
];
const assignment = /\b(?:api[_-]?key|auth[_-]?token|client[_-]?secret|password|private[_-]?key)\b\s*[:=]\s*["']([^"']{8,})["']/i;
const safeValue = /(?:example|placeholder|changeme|your[-_]|process\.env|import\.meta\.env|\$\{|<[^>]+>)/i;
const findings = [];

for (const path of tracked) {
  let buffer;
  try {
    buffer = await readFile(new URL(path, root));
  } catch {
    continue;
  }
  if (buffer.length > 2_000_000 || buffer.includes(0)) continue;
  const lines = buffer.toString("utf8").split("\n");
  lines.forEach((line, index) => {
    if (tokenPatterns.some((pattern) => pattern.test(line))) {
      findings.push(`${path}:${index + 1}: token or private key pattern`);
    }
    const match = line.match(assignment);
    if (match && !safeValue.test(match[1])) {
      findings.push(`${path}:${index + 1}: secret-like assignment`);
    }
  });
}

if (findings.length) {
  console.error("Potential secrets found:\n" + findings.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Secret scan checked ${tracked.length} tracked files.`);
}
