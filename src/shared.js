// Userscript to help generating tracking subpages at [[WP:AINB]]

/* globals mw, $ */
// <nowiki>
const APP_ID = "ainb-helper";
const APP_AD = "(using [[User:DVRTed/AINB-helper|AINB-helper]])";
// BUILD:DEV
const DEBUG_MODE = true;
// END:BUILD
// BUILD:PROD
const DEBUG_MODE = false;
// END:BUILD
const DEBUG_PAGE = "User:DVRTed/sandbox2";

const require = mw.loader.require;
await mw.loader.using([
  "vue",
  "@wikimedia/codex",
  "mediawiki.api",
  "mediawiki.util",
]);
const api = new mw.Api();
const Vue = require("vue");

let current_app = null;

function close_app() {
  if (current_app) {
    current_app.unmount();
    current_app = null;
  }
  document.getElementById(APP_ID)?.remove();
}

// reuseable function to create and mount the app
// that handles dups
function create_app(App) {
  const { createMwApp } = Vue;

  close_app();

  const mount_point = document.createElement("div");
  mount_point.id = APP_ID;
  document.body.appendChild(mount_point);

  const app = createMwApp(App);
  app.mount(mount_point);
  current_app = app;
}
