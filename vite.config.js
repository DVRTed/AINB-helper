import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import fs from "node:fs";

const HEADER =
  "// Userscript to help generating tracking subpages at [[WP:AINB]]\n" +
  "// For readable source code, see: https://github.com/DVRTed/AINB-helper\n" +
  "// <nowiki>\n\n";
const USYNC_HEADER =
  "// {{Wikipedia:USync |repo=https://github.com/DVRTed/AINB-helper |ref=refs/heads/production |path=AINB-helper.js}}\n\n";
const FOOTER = "\n// </nowiki>";

const wiki_wrap = (with_usync) => ({
  name: "wiki-wrap",
  writeBundle() {
    const file = "dist/AINB-helper.js";
    const code = fs.readFileSync(file, "utf8");
    fs.writeFileSync(
      file,
      (with_usync ? USYNC_HEADER : "") + HEADER + code + FOOTER,
    );
    fs.copyFileSync("src/AINB-helper.css", "dist/AINB-helper.css");
  },
});

export default defineConfig(({ mode }) => {
  // const prod = true;
  const prod = mode === "production";

  return {
    plugins: [vue(), wiki_wrap(process.env.USYNC === "1")],
    define: { __DEV__: JSON.stringify(!prod) },
    build: {
      outDir: "dist",
      minify: prod ? "terser" : false,
      lib: {
        entry: "src/index.js",
        formats: ["cjs"],
        fileName: () => "AINB-helper.js",
      },
      rollupOptions: {
        external: ["vue", "@wikimedia/codex"],
        output: {
          banner:
            "mw.loader.using(['vue', '@wikimedia/codex', 'mediawiki.api', 'mediawiki.util']).then(function (require) {",
          footer: "});",
        },
      },
    },
  };
});
