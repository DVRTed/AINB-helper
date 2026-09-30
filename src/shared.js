import { createMwApp } from "vue";

export const APP_ID = "ainb-helper";
export const APP_AD = "(using [[User:DVRTed/AINB-helper|AINB-helper]])";
export const DEBUG_MODE = __DEV__;
export const DEBUG_PAGE = "User:DVRTed/sandbox2";

export const api = new mw.Api();

let current_app = null;

export function get_article_row_regex(article, global = false) {
  const escaped_article = mw.util.escapeRegExp(article);
  return new RegExp(
    `\\{\\{AIC article row\\s*\\|\\s*(?:article=)?\\s*${escaped_article}\\s*(?:\\|\\s*(?:status=)?\\s*([^|}]*))?(?:\\|\\s*(?:notes=)?\\s*([^}]*))?\\s*\\}\\}`,
    global ? "ig" : "i",
  );
}

export function rm_underscores(value) {
  return value.replace(/_/g, " ");
}

export function format_number(number) {
  return number.toLocaleString();
}

export function get_article_url(title) {
  return mw.util.getUrl(title);
}

export async function get_page_wikitext(title) {
  const res = await api.get({
    action: "query",
    prop: "revisions",
    titles: title,
    rvprop: "content",
    rvslots: "main",
    formatversion: 2,
  });
  const page = res.query?.pages?.[0];
  if (!page || page.missing) return null;
  return page.revisions?.[0]?.slots?.main?.content ?? "";
}

export function close_app() {
  if (current_app) {
    current_app.unmount();
    current_app = null;
  }
  document.getElementById(APP_ID)?.remove();
}

// will yank out existing mounted apps
export function create_app(App, props = {}) {
  const { mount_target, ...app_props } = props;
  if (!mount_target) {
    close_app();
  }

  const mount_point = document.createElement("div");
  if (!mount_target) {
    mount_point.id = APP_ID;
  }
  if (mount_target) {
    mount_target.prepend(mount_point);
  } else {
    document.body.appendChild(mount_point);
  }

  const app = createMwApp(App, app_props);

  app.mount(mount_point);
  if (!mount_target) {
    current_app = app;
  }
}
