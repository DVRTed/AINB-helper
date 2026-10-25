import {
  create_app,
  wgAction,
  wgPageName,
  wgNamespaceNumber,
} from "./shared.js";

import styles from "./AINB-helper.css?inline";

import { add_page_buttons } from "./register-actions.js";

import {
  init_highlight_author_portlet,
  init_llm_tag_prod_portlet,
  replace_edittext_with_session,
} from "./page-actions/ArticleActions.js";

import CategoryStats from "./category-stats.vue";
import Main from "./main.vue";

mw.util.addCSS(styles);

// categories to enable the "overall progress" bar in
const cases_categories = ["Category:AI_noticeboard_open_cleanup_cases"];

// case pages to initialize many buttons in
const cases_pages = ["Category:AI_noticeboard_open_cleanup_cases"];

// main app's portlet
const portlet_link = mw.util.addPortletLink(
  "p-tb",
  "#",
  "New AINB tracking",
  "t-ainb-tracking",
  "Generate tracking subpage for AINB",
);
$(portlet_link).on("click", (e) => {
  e.preventDefault();
  create_app(Main);
});

if (wgAction === "view") {
  if (wgPageName in cases_categories) create_app(CategoryStats);

  if (wgPageName in cases_pages) {
    add_page_buttons();
    mw.hook("wikipage.content").add(($content) => {
      if (!$content.is("#mw-content-text")) return;
      add_page_buttons();
    });
  }
}

if (wgNamespaceNumber === 0) {
  if (wgAction === "edit") replace_edittext_with_session();

  init_highlight_author_portlet();
}

// article or draft
if (wgNamespaceNumber === 0 || wgNamespaceNumber === 118)
  init_llm_tag_prod_portlet();
