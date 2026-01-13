import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

// Tweak these to match your repo
const CSS_DIR = path.join(ROOT, "app/styles");
const SRC_DIRS = [
  path.join(ROOT, "app"),
  path.join(ROOT, "components"),
  path.join(ROOT, "lib"),
];

// Files to scan for class usage
const SRC_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mdx"]);

// CSS files to include
const CSS_EXT = new Set([".css"]);

// Classes we intentionally keep even if scanner can’t find them
// (Leaflet injects, runtime-only, etc.)
const SAFE_CLASSES = new Set([
  "leaflet-container",
  "leaflet-tooltip",
  "leaflet-pane",
  "leaflet-control",
  "leaflet-marker-icon",
  "leaflet-marker-shadow",
]);

function walk(dir, fn) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, fn);
    else fn(p);
  }
}

function readFileSafe(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

// Extract class selectors from CSS:
// - grabs `.foo` and `.foo-bar`
// - ignores `.5` or weird numeric things
function extractCssClasses(cssText) {
  const out = new Set();
  const re = /\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g;
  let m;
  while ((m = re.exec(cssText))) out.add(m[1]);
  return out;
}

// Collect source text where class names might appear
function collectSourceText() {
  let text = "";
  for (const dir of SRC_DIRS) {
    walk(dir, (p) => {
      const ext = path.extname(p);
      if (!SRC_EXT.has(ext)) return;
      // Avoid scanning huge build artifacts if any
      if (p.includes(`${path.sep}.next${path.sep}`)) return;
      if (p.includes(`${path.sep}node_modules${path.sep}`)) return;
      text += "\n" + readFileSafe(p);
    });
  }
  return text;
}

function collectCssClasses() {
  const cssClasses = new Set();
  walk(CSS_DIR, (p) => {
    const ext = path.extname(p);
    if (!CSS_EXT.has(ext)) return;
    const css = readFileSafe(p);
    for (const c of extractCssClasses(css)) cssClasses.add(c);
  });
  return cssClasses;
}

const sourceText = collectSourceText();
const cssClasses = collectCssClasses();

const unused = [];
for (const cls of cssClasses) {
  if (SAFE_CLASSES.has(cls)) continue;
  // We check for raw occurrence anywhere (covers: className="x", `x`, "x", etc.)
  if (!sourceText.includes(cls)) unused.push(cls);
}

unused.sort();

console.log(`\nCSS dead-code scan`);
console.log(`- CSS classes found: ${cssClasses.size}`);
console.log(`- Likely unused: ${unused.length}\n`);

for (const u of unused) console.log(u);

console.log(`\nNotes:
- This flags "likely unused", not guaranteed.
- Dynamic className usage (e.g. \`pigeonMarker \${state}\`) may look unused here.
- Leaflet runtime classes may also look unused unless safelisted.\n`);