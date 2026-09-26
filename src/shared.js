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
// that registers a bunch of components and handles dups
function create_app(App) {
  const { createMwApp } = Vue;
  const codex = require("@wikimedia/codex");

  close_app();

  const mount_point = document.createElement("div");
  mount_point.id = APP_ID;
  document.body.appendChild(mount_point);

  const app = createMwApp({
    ...App,
    mixins: [
      {
        methods: {
          handle_dialog_close() {
            close_app();
          },
        },
      },
      ...(App.mixins || []),
    ],
  });

  const {
    CdxButton,
    CdxCheckbox,
    CdxCombobox,
    CdxDialog,
    CdxField,
    CdxMenuButton,
    CdxProgressBar,
    CdxRadio,
    CdxSelect,
    CdxTextArea,
    CdxTextInput,
  } = codex;
  Object.entries({
    CdxButton,
    CdxCheckbox,
    CdxCombobox,
    CdxDialog,
    CdxField,
    CdxMenuButton,
    CdxProgressBar,
    CdxRadio,
    CdxSelect,
    CdxTextArea,
    CdxTextInput,
  }).forEach(([name, c]) => app.component(name, c));

  app.mount(mount_point);
  current_app = app;
}
