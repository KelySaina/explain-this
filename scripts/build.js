#!/usr/bin/env node
/*
 * Build per-browser packages for Explain This.
 *
 *   node scripts/build.js
 *
 * Produces, under dist/:
 *   chrome/   + explain-this-chrome-v<version>.zip   (Chrome, Edge, Brave, Arc, Opera)
 *   firefox/  + explain-this-firefox-v<version>.zip  (Firefox 121+)
 *
 * Same source, two manifests: Chrome uses background.service_worker and rejects
 * Firefox-only keys; Firefox uses background.scripts + browser_specific_settings.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
const VERSION = manifest.version;

// Files/dirs that ship inside every package.
const INCLUDE = ["icons", "src", "LICENSE"];

function rimraf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function copyInto(destDir) {
  for (const item of INCLUDE) {
    const from = path.join(ROOT, item);
    if (!fs.existsSync(from)) continue;
    fs.cpSync(from, path.join(destDir, item), { recursive: true });
  }
}

function writeManifest(destDir, target) {
  const m = JSON.parse(JSON.stringify(manifest));
  if (target === "chrome") {
    m.background = { service_worker: "src/background.js" };
    delete m.browser_specific_settings;
  } else {
    // Firefox MV3: event-page background via scripts; keep the gecko settings.
    m.background = { scripts: ["src/background.js"] };
  }
  fs.writeFileSync(path.join(destDir, "manifest.json"), JSON.stringify(m, null, 2) + "\n");
}

function zipDir(dir, zipPath) {
  rimraf(zipPath);
  // Zip the *contents* of dir (store must see manifest.json at the root).
  execFileSync("zip", ["-r", "-q", "-X", zipPath, "."], { cwd: dir });
}

function build(target) {
  const dir = path.join(DIST, target);
  rimraf(dir);
  fs.mkdirSync(dir, { recursive: true });
  copyInto(dir);
  writeManifest(dir, target);
  const zipPath = path.join(DIST, `explain-this-${target}-v${VERSION}.zip`);
  zipDir(dir, zipPath);
  const kb = (fs.statSync(zipPath).size / 1024).toFixed(1);
  console.log(`✔ ${target.padEnd(8)} → ${path.relative(ROOT, zipPath)} (${kb} KB)`);
}

fs.mkdirSync(DIST, { recursive: true });
build("chrome");
build("firefox");
console.log(`\nDone. Version ${VERSION}. Upload the .zip files to each store.`);
