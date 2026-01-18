const fs = require("fs");
const path = require("path");

const badgesFile = path.join(__dirname, "..", "app", "lib", "badges", "index.ts");
const publicDir = path.join(__dirname, "..", "public", "badges");

const src = fs.readFileSync(badgesFile, "utf8");
const start = src.indexOf("export const BADGES");
if (start === -1) {
  console.error("BADGES registry not found.");
  process.exit(1);
}

const braceStart = src.indexOf("{", start);
const braceEnd = src.indexOf("};", braceStart);
if (braceStart === -1 || braceEnd === -1) {
  console.error("Could not parse BADGES registry block.");
  process.exit(1);
}

const block = src.slice(braceStart, braceEnd);
const ids = [];
const idRegex = /"([a-z0-9-]+)"\s*:/g;
let match = null;
while ((match = idRegex.exec(block))) {
  ids.push(match[1]);
}

const missing = [];
for (const id of ids) {
  const svgPath = path.join(publicDir, `${id}.svg`);
  const pngPath = path.join(publicDir, `${id}.png`);
  if (!fs.existsSync(svgPath) && !fs.existsSync(pngPath)) {
    missing.push(id);
  }
}

if (missing.length) {
  console.error("Missing badge assets:");
  for (const id of missing) {
    console.error(`- ${id}`);
  }
  process.exit(1);
}

console.log(`Badges OK: ${ids.length} assets found.`);
