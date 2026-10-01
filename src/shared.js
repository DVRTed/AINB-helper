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

export const CASE_ORIGIN_KEY = "ainb-case-origin";
const CASE_ORIGIN_TTL_MS = 6 * 60 * 60 * 1000;

export function normalize_title(t) {
  const title = new mw.Title(t);
  return title.getPrefixedText();
}

export function get_case_username(page) {
  return normalize_title(page)
    .split("/")
    .pop()
    .replace(/^\d{4}-\d{2}-\d{2} /, "") // rm date prefix
    .replace(/ \(\d+\)$/, "") // rm (1), (2) etc from title
    .trim();
}

// called when an article link is clicked on a tracker page
export function set_case_origin(article, tracker) {
  const now = Date.now();
  const map = mw.storage.getObject(CASE_ORIGIN_KEY) || {};
  for (const k of Object.keys(map)) {
    if (now - map[k].ts > CASE_ORIGIN_TTL_MS) delete map[k];
  }
  map[normalize_title(article)] = { case: normalize_title(tracker), ts: now };
  mw.storage.setObject(CASE_ORIGIN_KEY, map);
}

export function get_case_origin(article) {
  const map = mw.storage.getObject(CASE_ORIGIN_KEY) || {};
  const entry = map[normalize_title(article)];
  if (!entry || Date.now() - entry.ts > CASE_ORIGIN_TTL_MS) return null;
  return entry.case;
}

export async function get_page_info(title) {
  const res = await api.get({
    action: "query",
    prop: "revisions",
    titles: title,
    rvprop: "ids|timestamp|content",
    rvslots: "main",
    formatversion: 2,
    curtimestamp: true,
  });
  const page = res.query?.pages?.[0];
  if (!page || page.missing) return null;
  const rev = page.revisions?.[0];
  return {
    text: rev?.slots?.main?.content ?? "",
    revid: rev?.revid,
    timestamp: rev?.timestamp,
    starttimestamp: res.curtimestamp,
  };
}

export async function get_page_wikitext(title) {
  const info = await get_page_info(title);
  return info ? info.text : null;
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
