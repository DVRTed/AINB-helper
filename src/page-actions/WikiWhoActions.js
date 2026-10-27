import { create_app, get_case_username, wgPageName } from "../shared.js";
import AuthorHighlight from "../apps/author-highlight.vue";

const WIKIWHO_API =
  "https://wikiwho.wmcloud.org/en/api/v1.0.0-beta/latest_rev_content/";
const MAX_AFFECTED_LOOKUPS = 5;
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
        .text("check affected %")
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
            console.log(err);
          } finally {
            active_affected_lookups--;
            if (active_affected_lookups < MAX_AFFECTED_LOOKUPS) {
              $("a.ainb-check-pct").removeClass("ainb-disabled");
            }
          }
        });

      const $highlight_link = $("<a>")
        .addClass("ainb-check-pct")
        .attr("href", "#")
        .text("highlight")
        .on("click", (e) => {
          e.preventDefault();
          create_app(AuthorHighlight, { article, username });
        });

      $notes.append(
        $("<div>")
          .addClass("ainb-check-pct-wrap")
          .append($link, $("<span>").text(" · "), $highlight_link),
      );
    });
}
