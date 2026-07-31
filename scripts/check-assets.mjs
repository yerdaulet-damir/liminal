import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const publicDir = fileURLToPath(new URL("client/public/", root));
const manifest = JSON.parse(await readFile(new URL("assets-manifest.json", root), "utf8"));
const ignoredReleaseFiles = new Set(["_headers"]);

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? walk(path) : path;
    }),
  );
  return files.flat();
}

const actual = (await walk(publicDir))
  .map((path) => relative(publicDir, path))
  .filter((path) => !ignoredReleaseFiles.has(path))
  .sort();
const declared = manifest.assets.map((asset) => asset.path).sort();
const duplicatePaths = declared.filter((path, index) => declared[index - 1] === path);
const missingFromManifest = actual.filter((path) => !declared.includes(path));
const missingFromDisk = declared.filter((path) => !actual.includes(path));
const incomplete = manifest.assets.filter(
  (asset) => !asset.path || !asset.source || !asset.license || !asset.sourceUrl,
);

if (duplicatePaths.length || missingFromManifest.length || missingFromDisk.length || incomplete.length) {
  if (duplicatePaths.length) console.error("Duplicate manifest paths:", duplicatePaths);
  if (missingFromManifest.length) console.error("Public files missing from manifest:", missingFromManifest);
  if (missingFromDisk.length) console.error("Manifest paths missing from public:", missingFromDisk);
  if (incomplete.length) console.error("Incomplete manifest entries:", incomplete);
  process.exitCode = 1;
} else {
  console.log(`Asset manifest covers all ${actual.length} shipped assets.`);
}
