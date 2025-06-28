const fs = require("fs");
const path = require("path");

const filesToCopy = ["package.json", "README.md"];
const distDir = path.join(__dirname, "..", "dist");

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

for (const file of filesToCopy) {
  const src = path.join(__dirname, "..", file);
  const dest = path.join(distDir, file);
  fs.copyFileSync(src, dest);
}

// Patch main field in dist/package.json
const pkgPath = path.join(distDir, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
if (pkg.main && pkg.main.startsWith("dist/")) {
  pkg.main = pkg.main.replace(/^dist\//, "");
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
}
