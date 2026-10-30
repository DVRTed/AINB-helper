import {
  create_app,
  wgAction,
  wgPageName,
  wgNamespaceNumber,
  DEBUG_PAGE,
} from "./shared.js";

import styles from "./stylesheets/AINB-helper.css?inline";

import { add_page_buttons } from "./register-actions.js";

import {
  init_highlight_author_portlet,
  init_llm_tag_prod_portlet,
  replace_edittext_with_session,
} from "./page-actions/ArticleActions.js";

import NewCaseApp from "./apps/new-case-app.vue";

mw.util.addCSS(styles);

// main app's portlet
const portlet_link = mw.util.addPortletLink(
  "p-tb",
  "#",
  "New AINB case",
  "t-ainb-tracking",
  "File a new AINB case",
);
$(portlet_link).on("click", (e) => {
  e.preventDefault();
  create_app(NewCaseApp);
});

if (wgAction === "view") {
  if (
    wgPageName.startsWith("Wikipedia:AI_noticeboard/") ||
    wgPageName == DEBUG_PAGE
  ) {
    mw.hook("wikipage.content").add(($content) => {
      if (!$content.is("#mw-content-text")) return;
      add_page_buttons();
    });
  }
}

// article or draft
if (wgNamespaceNumber === 0 || wgNamespaceNumber === 118)
  init_llm_tag_prod_portlet();

if (wgNamespaceNumber === 0) {
  if (wgAction === "edit") replace_edittext_with_session();

  init_highlight_author_portlet();
}
