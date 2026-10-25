import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";
import pluginVue from "eslint-plugin-vue";

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs,vue}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: {
      globals: {
        ...globals.browser,
        $: "readonly",
        mw: "readonly",
      },
    },
  },
  pluginVue.configs["flat/recommended"],
]);
