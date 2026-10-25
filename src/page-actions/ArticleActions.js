import LlmTagProd from "../apps/llm-tag-prod.vue";
import AuthorHighlight from "../apps/author-highlight.vue";

import {
  create_app,
  get_case_origin,
  get_case_username,
  wgPageName,
} from "../shared.js";
import { createMwApp, h } from "vue";
import { CdxMessage } from "@wikimedia/codex";

const EDIT_TEXT_KEY = "ainb-author-highlight-edit-text";

export function init_llm_tag_prod_portlet() {
  const portlet = mw.util.addPortletLink(
    "p-cactions",
    "#",
    "LLM tag/prod",
    "t-llm-tag-prod",
    "LLM tag/prod helper",
  );
  $(portlet).on("click", (e) => {
    e.preventDefault();
    create_app(LlmTagProd);
  });
}

export function init_highlight_author_portlet() {
  const origin = get_case_origin(wgPageName);
  const initial_username = origin ? get_case_username(origin) : "";
  const portlet_link = mw.util.addPortletLink(
    "p-cactions",
    "#",
    "Highlight author",
    "t-ainb-author-highlight",
    "Highlight content by an author",
  );

  $(portlet_link).on("click", function (e) {
    e.preventDefault();
    const username = window.prompt(
      "Enter a username to highlight the content of:",
      initial_username || "",
    );
    if (!username?.trim()) return;

    create_app(AuthorHighlight, {
      article: wgPageName,
      username: username.trim(),
    });
  });
}

export function replace_edittext_with_session() {
  const pending = sessionStorage.getItem(EDIT_TEXT_KEY);
  if (!pending) return;

  try {
    const { title, text, username, summary } = JSON.parse(pending);
    if (title !== wgPageName) return;

    const $textarea = $("#wpTextbox1");
    if (!$textarea.length) return;

    sessionStorage.removeItem(EDIT_TEXT_KEY);
    if (typeof $textarea.textSelection === "function") {
      $textarea.textSelection("setContents", text);
    } else {
      $textarea.val(text).trigger("input").trigger("change");
    }

    if (summary) $("#wpSummary").val(summary);

    $("#wpDiff").trigger("click");

    const message_mount = document.createElement("div");
    $("#editpage-copywarn").append(message_mount);
    createMwApp({
      render() {
        return h(
          CdxMessage,
          { type: "warning" },
          {
            default: () => [
              "ALL content authored by ",
              h("strong", `User:${username}`),
              " has been removed; please review the changes carefully if you decide to save this page.",
            ],
          },
        );
      },
    }).mount(message_mount);
  } catch (error) {
    sessionStorage.removeItem(EDIT_TEXT_KEY);
    console.error("Could not prefill article edit text:", error);
  }
}
