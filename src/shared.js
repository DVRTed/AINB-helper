import { createMwApp } from "vue";
import Option_picker from "./apps/components/option_picker.vue";

export const APP_ID = "ainb-helper";
export const APP_AD = "(using [[User:DVRTed/AINB-helper|AINB-helper]])";
// eslint-disable-next-line no-undef
export const DEBUG_MODE = __DEV__;
export const DEBUG_PAGE = "User:DVRTed/sandbox2";
if (DEBUG_MODE) console.clear();

export const api = new mw.Api();

let current_app = null;

export const wgPageName = mw.config.get("wgPageName");
export const wgNamespaceNumber = mw.config.get("wgNamespaceNumber");
export const wgAction = mw.config.get("wgAction");

export const CASE_ORIGIN_KEY = "ainb-case-origin";
const CASE_ORIGIN_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const CASE_ORIGIN_MAX_CASES = 10;
const CASE_ORIGIN_MAX_ARTICLES = 500;

export function get_article_row_regex(
  article,
  global = false,
  no_escape = false,
) {
  const escaped_article = no_escape ? article : mw.util.escapeRegExp(article);
  return new RegExp(
    `\\{\\{[aA]IC article row\\s*\\|\\s*(?:article=)?\\s*${escaped_article}\\s*(?:\\|\\s*(?:status=)?\\s*([^|}]*))?(?:\\|\\s*(?:notes=)?\\s*([^}]*))?\\s*\\}\\}`,
    global ? "g" : "",
  );
}

// [1] = article, [2] = status, [3] = notes
export function get_all_article_row_regex() {
  return get_article_row_regex("([^|}]+?)", true, true);
}

export const script_url = mw.util.getUrl("User:DVRTed/AINB-helper");

export function rm_underscores(value) {
  return value.replace(/_/g, " ");
}

export function format_number(number) {
  return number.toLocaleString();
}

export function get_article_url(title) {
  return mw.util.getUrl(title);
}

export function get_history_url(title) {
  return mw.util.getUrl(title, { action: "history" });
}

export function normalize_title(t) {
  const title = new mw.Title(t);
  return title.getPrefixedText();
}

// async to await the select component when there are multiple usernames
export async function get_case_username(page, return_multiple = false) {
  // ".ainb-userlinks" is added by {{User-ainb}}, [[special:diff/1382279612]]
  const ainb_userlinks = $(".ainb-userlinks");

  const legacy = () => {
    // no ainb userlinks or a page name is given, fallback to legacy

    // e.g., "Wikipedia:AI noticeboard/DVRTed/1"
    // select the first subpage
    // e.g., "DVRTed"
    const subpage = normalize_title(page || wgPageName).split("/")[1];
    if (!subpage) return null;

    const username = subpage
      .replace(/^\d{4}-\d{2}-\d{2} /, "") // rm date prefix
      .replace(/ \(\d+\)$/, "") // rm (1), (2) etc from title
      .trim();
    return username;
  };

  if (page || !ainb_userlinks.length) return legacy();

  // page has ainb userlinks
  const all_usernames = ainb_userlinks
    .map((_, el) => {
      const href = $(el).find('a[href*="/wiki/User:"]').first().attr("href");
      if (!href) return null;

      try {
        // "/wiki/User:DVRTed_bot#top" -> "User:DVRTed bot"
        const title = normalize_title(
          decodeURIComponent(href.split("/wiki/")[1].split("#")[0]),
        );
        // drop "User:" prefix and any subpage
        return title.split("/")[0].replace(/^user:/i, "");
      } catch (e) {
        console.error(e);
        return null;
      }
    })
    .get();

  const unique_usernames = new Set(all_usernames);
  const usernames = [...unique_usernames];

  // something went wrong while selecting/parsing ainb userlinks, fallback to legacy
  if (!usernames.length) return legacy();

  // only one unique userlink, return it
  if (usernames.length <= 1) return usernames[0];

  // multiple usernames:
  // if `return_multiple` is true, return all usernames
  // separated by "|"
  // otherwise prompt the user
  if (return_multiple) {
    return usernames.map((u) => `User:${u}`).join(" | ");
  }
  const options = usernames.map((name) => {
    return { label: `User:${name}`, value: name };
  });

  const choice = await open_component(
    Option_picker,
    {
      title: "Pick a username",
      description:
        "There are multiple user-ainb links on this case page. Select one:",
      options,
    },
    ["select", "cancel"],
  );

  return choice?.value ?? null;
}

export function get_case_page_name(page) {
  // e.g., "Wikipedia:AI noticeboard/DVRTed/1"
  // turns to "DVRTed/1"
  const page_name = normalize_title(page).split("/").slice(1).join("/");

  return page_name;
}

// called when an article link is clicked on a tracker page
export function set_case_origin(article, tracker) {
  const now = Date.now();
  const map = mw.storage.getObject(CASE_ORIGIN_KEY) || {};
  // remove expired cases
  for (const k of Object.keys(map)) {
    const time_diff = now - map[k].ts;

    if (Number.isNaN(time_diff) || time_diff > CASE_ORIGIN_TTL_MS)
      delete map[k];
  }

  const case_name = normalize_title(tracker);
  const title = normalize_title(article);
  const articles = map[case_name]?.articles || [];
  if (!articles.includes(title)) articles.push(title);
  map[case_name] = {
    articles: articles.slice(-CASE_ORIGIN_MAX_ARTICLES),
    ts: now,
  };

  Object.keys(map)
    .sort((a, b) => map[b].ts - map[a].ts)
    .slice(CASE_ORIGIN_MAX_CASES)
    .forEach((k) => delete map[k]);

  mw.storage.setObject(CASE_ORIGIN_KEY, map);
}

export function get_case_origin(article) {
  const map = mw.storage.getObject(CASE_ORIGIN_KEY) || {};
  const title = normalize_title(article);
  const now = Date.now();

  const rel_case = Object.entries(map)
    .filter(([, e]) => {
      return now - e.ts <= CASE_ORIGIN_TTL_MS && e.articles?.includes(title);
    })
    .sort((a, b) => b[1].ts - a[1].ts)[0]; // pick the most recent clicked case

  const [case_name] = rel_case || [];
  return case_name ?? null;
}

export function find_template_ranges(text, template_name) {
  const opening = new RegExp(`\\{\\{\\s*${template_name}\\s*\\|`, "gi");
  const ranges = [];
  let match;

  while ((match = opening.exec(text))) {
    let depth = 0;
    let cursor = match.index;
    while (cursor < text.length) {
      if (text.startsWith("{{", cursor)) {
        depth++;
        cursor += 2;
      } else if (text.startsWith("}}", cursor)) {
        depth--;
        cursor += 2;
        if (depth === 0) break;
      } else {
        cursor++;
      }
    }

    if (depth === 0) ranges.push({ start: match.index, end: cursor });
    opening.lastIndex = cursor;
  }

  return ranges;
}

export function splice(text, { start, end }, replacement) {
  return text.slice(0, start) + replacement + text.slice(end);
}

export async function get_page_info(title, revid = null) {
  const params = {
    action: "query",
    prop: "revisions",
    rvprop: "ids|timestamp|content",
    rvslots: "main",
    formatversion: 2,
    curtimestamp: true,
  };
  if (revid) params.revids = revid;
  else params.titles = title;

  const res = await api.get(params);
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

// mounts a component, returns the function to remove it
export function mount_component(Component, props = {}) {
  const mount_point = document.createElement("div");
  document.body.appendChild(mount_point);

  const app = createMwApp(Component, props);
  app.mount(mount_point);

  return function unmount() {
    app.unmount();
    mount_point.remove();
  };
}

// returns a promise that resolves when the component emits
// one of the given events.
// resolves with the event's payload (or null).
export function open_component(Component, props = {}, close_events = []) {
  return new Promise((resolve) => {
    const handlers = {};

    for (const event of close_events) {
      // "select" -> "onSelect"
      const handler_name = "on" + event[0].toUpperCase() + event.slice(1);
      handlers[handler_name] = (payload) => {
        unmount();
        resolve(payload ?? null);
      };
    }

    const unmount = mount_component(Component, { ...props, ...handlers });
  });
}
