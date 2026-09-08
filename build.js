#!/usr/bin/env node
// concatenate src/ modules into dist/AINB-helper.js, copy CSS

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const src = path.join(__dirname, "src");
const dist = path.join(__dirname, "dist");
const dist_js = path.join(dist, "AINB-helper.js");
const dist_css = path.join(dist, "AINB-helper.css");
const build_mode = process.argv.includes("--prod") ? "prod" : "dev";

const modules = [
  "shared.js",
  "main-app.js",
  "edit-table-app.js",
  "edit-table-batch-app.js",
  "llm-tag-prod-app.js",
  "category-stats-app.js",
  "page-features.js",
];

function strip_conditional_blocks(content, mode) {
  const inactive = mode === "prod" ? "DEV" : "PROD";

  content = content.replace(
    new RegExp(
      String.raw`^\s*//\s*BUILD:${inactive}\s*\n[\s\S]*?^\s*//\s*END:BUILD\s*\n?`,
      "gm",
    ),
    "",
  );

  content = content.replace(
    new RegExp(String.raw`^\s*//\s*BUILD:(DEV|PROD)\s*$\n?`, "gm"),
    "",
  );
  content = content.replace(
    new RegExp(String.raw`^\s*//\s*END:BUILD\s*$\n?`, "gm"),
    "",
  );
  content = content.replace(
    new RegExp(String.raw`\s*//\s*BUILD:(DEV|PROD)\s*`, "g"),
    "",
  );
  content = content.replace(
    new RegExp(String.raw`\s*//\s*END:BUILD\s*`, "g"),
    "",
  );

  return content;
}

function strip_module_wrapper(content) {
  let next = content;

  next = next.replace(/^\s*\$\(async\s*\(\)\s*=>\s*\{\s*/m, "");
  next = next.replace(/\n?\s*\/\/\s*<\/nowiki>\s*\n\s*\}\);?\s*$/m, "");
  return next.trimStart();
}

const parts = modules.map((name) => {
  const file = path.join(src, name);
  const content = fs.readFileSync(file, "utf8");
  return strip_module_wrapper(strip_conditional_blocks(content, build_mode));
});

const output_js = `$(async () => {\n${parts.join("\n")}\n});\n// </nowiki>`;

fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(dist_js, output_js, "utf8");

execFileSync("npx", ["--yes", "prettier@2", "--write", dist_js], {
  stdio: "inherit",
  cwd: __dirname,
});

const css_source = path.join(src, "AINB-helper.css");
fs.copyFileSync(css_source, dist_css);

console.log(`Built ${dist_js} (${fs.statSync(dist_js).size} bytes)`);
console.log(`Copied ${dist_css}`);
