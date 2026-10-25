module.exports = {
  root: true,
  ignorePatterns: ["dist/", "node_modules/"],
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  extends: ["eslint:recommended", "plugin:vue/recommended"],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  globals: {
    $: "readonly",
    mw: "readonly",
  },
  rules: {
    "vue/no-undef-properties": "error",
    "vue/no-unused-vars": "error",
    "vue/no-undef-components": "error",
    "vue/require-v-for-key": "error",
    "vue/no-mutating-props": "error",
    "vue/max-attributes-per-line": "off",
    "vue/singleline-html-element-content-newline": "off",
    "vue/html-self-closing": "off",
    "vue/prop-name-casing": "off",
    "vue/no-v-model-argument": "off",
  },
};
