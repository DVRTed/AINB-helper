import { create_app, get_case_origin, get_case_username } from "../shared.js";
import { createMwApp, h } from "vue";
import { CdxMessage } from "@wikimedia/codex";
import AuthorHighlight from "../author-highlight.vue";

const WIKIWHO_API =
  "https://wikiwho.wmcloud.org/en/api/v1.0.0-beta/latest_rev_content/";
const MAX_AFFECTED_LOOKUPS = 5;
const EDIT_TEXT_KEY = "ainb-author-highlight-edit-text";
const wgPageName = mw.config.get("wgPageName");
const wgAction = mw.config.get("wgAction");
let active_affected_lookups = 0;

export function init_check_affected() {
  const username = get_case_username(wgPageName);

  $('tr[class*="aic-row-"]')
    .not(".ainb-check-affected-done")
    .each(function () {
      $(this).addClass("ainb-check-affected-done");
      const $row = $(this);
      const $a = $row.find("a").first();
      if ($a.hasClass("new")) return;
      const article = $a.text();
      const $notes = $row.find("td").last();

      const $link = $("<a>")
        .addClass("ainb-check-pct")
        .attr("href", "#")
        .text("check affected % (beta)")
        .on("click", async function (e) {
          e.preventDefault();
          if (active_affected_lookups >= MAX_AFFECTED_LOOKUPS) return;
          active_affected_lookups++;
          if (active_affected_lookups >= MAX_AFFECTED_LOOKUPS) {
            $("a.ainb-check-pct").addClass("ainb-disabled");
          }

          const $span = $("<span>")
            .addClass("ainb-check-pct")
            .text("checking...");
          $link.replaceWith($span);

          try {
            const uq = new URLSearchParams({
              action: "query",
              list: "users",
              ususers: username,
              format: "json",
              origin: "*",
            });
            const udata = await (await fetch(`/w/api.php?${uq}`)).json();
            const userid = String(udata.query.users[0]?.userid || "");
            if (!userid) {
              $span.text(`user "${username}" not found`);
              return;
            }

            const wq = new URLSearchParams({
              o_rev_id: false,
              editor: true,
              token_id: false,
              out: false,
              in: false,
            });
            const wdata = await (
              await fetch(`${WIKIWHO_API}${encodeURIComponent(article)}/?${wq}`)
            ).json();
            if (!wdata.success) {
              $span.text("WikiWho API error");
              return;
            }

            const rev_obj = wdata.revisions[0];
            const tokens = rev_obj[Object.keys(rev_obj)[0]].tokens;
            const rel_user_tokens = tokens.filter(
              (token) => token.editor === userid,
            ).length;

            const pct = tokens.length
              ? ((rel_user_tokens / tokens.length) * 100).toFixed(1)
              : "0";
            $span
              .html(
                `<b>${pct}%</b> (${rel_user_tokens}/${tokens.length} tokens) of the current revision's content was authored by <b class="ww-ainb-uname"></b>` +
                  ` (using WikiWho API)`,
              )
              .find(".ww-ainb-uname")
              .text(username);
          } catch (err) {
            $span.text("lookup failed");
          } finally {
            active_affected_lookups--;
            if (active_affected_lookups < MAX_AFFECTED_LOOKUPS) {
              $("a.ainb-check-pct").removeClass("ainb-disabled");
            }
          }
        });

      $notes.append($("<div>").addClass("ainb-check-pct-wrap").append($link));
    });
}

export function init_highlight_author() {
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

export function apply_author_highlight_edit_text() {
  if (wgAction !== "edit") return;

  const pending = sessionStorage.getItem(EDIT_TEXT_KEY);
  if (!pending) return;

  try {
    const { title, text, username } = JSON.parse(pending);
    if (title !== wgPageName) return;

    const $textarea = $("#wpTextbox1");
    if (!$textarea.length) return;

    sessionStorage.removeItem(EDIT_TEXT_KEY);
    if (typeof $textarea.textSelection === "function") {
      $textarea.textSelection("setContents", text);
    } else {
      $textarea.val(text).trigger("input").trigger("change");
    }

    const message_mount = document.createElement("div");
    const $content = $("#mw-content-text");
    if ($content.length) $content.prepend(message_mount);
    else $textarea.before(message_mount);
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

    $("#wpDiff").trigger("click");
  } catch (error) {
    sessionStorage.removeItem(EDIT_TEXT_KEY);
    console.error("Could not prefill article edit text:", error);
  }
}
