module.exports = {
  root: true,
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
    "vue/max-attributes-per-line": "off",
    "vue/singleline-html-element-content-newline": "off",
    "vue/html-self-closing": "off",
    "vue/prop-name-casing": "off",
    "vue/no-v-model-argument": "off",
  },
};
