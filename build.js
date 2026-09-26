#!/usr/bin/env node
// concatenate src/ modules into dist/AINB-helper.js, copy CSS

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const HEADER =
  "// Userscript to help generating tracking subpages at [[WP:AINB]]\n" +
  "// For readable source code, see: https://github.com/DVRTed/AINB-helper\n" +
  "// <nowiki>\n\n";

const USYNC_HEADER =
  "// {{Wikipedia:USync |repo=https://github.com/DVRTed/AINB-helper |ref=refs/heads/production |path=AINB-helper.js}}\n\n";
const FOOTER = "\n// </nowiki>";

const src = path.join(__dirname, "src");
const dist = path.join(__dirname, "dist");
const dist_js = path.join(dist, "AINB-helper.js");
const dist_css = path.join(dist, "AINB-helper.css");
const build_mode = process.argv.includes("--prod") ? "prod" : "dev";
const build_with_usync = process.argv.includes("--with-usync");

const modules = [
  "shared.js",
  "main-app.js",
  "edit-table-app.js",
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
  const build_content = strip_conditional_blocks(content, build_mode);
  return strip_module_wrapper(build_content);
});

const output_js = `$(async () => {\n${parts.join("\n")}\n});\n// </nowiki>`;

fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(dist_js, output_js, "utf8");

execFileSync(
  process.execPath,
  [require.resolve("prettier/bin-prettier.js"), "--write", dist_js],
  {
    stdio: "inherit",
    cwd: __dirname,
  },
);

execFileSync(
  process.execPath,
  [
    require.resolve("terser/bin/terser"),
    dist_js,
    "--compress",
    "--name-cache names.json",
    "--mangle",
    "--output",
    dist_js,
  ],
  {
    stdio: "inherit",
    cwd: __dirname,
  },
);

const minified_js = fs.readFileSync(dist_js, "utf8");
const usync_header = build_with_usync ? USYNC_HEADER : "";
const final_js = usync_header + HEADER + minified_js + FOOTER;

fs.writeFileSync(dist_js, final_js, "utf8");

const css_source = path.join(src, "AINB-helper.css");
fs.copyFileSync(css_source, dist_css);

console.log(`Built ${dist_js} (${fs.statSync(dist_js).size} bytes)`);
console.log(`Copied ${dist_css}`);
