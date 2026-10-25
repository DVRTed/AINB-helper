import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import fs from "node:fs";
import { ESLint } from "eslint";

const HEADER =
  "// Userscript to manage the AI noticeboard's cases and tracking tables\n" +
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
  },
});

const eslint_watch = () => {
  const eslint = new ESLint();
  return {
    name: "eslint-watch",
    async buildStart() {
      try {
        const results = await eslint.lintFiles(["src/**/*.{js,mjs,cjs}"]);
        const formatter = await eslint.loadFormatter("stylish");
        const resultText = await formatter.format(results);
        if (resultText.trim()) {
          console.log(resultText);
        }
      } catch (err) {
        console.error("ESLint watch error:", err);
      }
    },
  };
};

export default defineConfig(({ mode }) => {
  // const prod = true;
  const prod = mode === "production";

  return {
    // eslint-disable-next-line no-undef
    plugins: [vue(), eslint_watch(), wiki_wrap(process.env.USYNC === "1")],
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
