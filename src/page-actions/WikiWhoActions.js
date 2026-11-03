import {
  create_app,
  get_case_username,
  set_case_origin,
  wgPageName,
} from "../shared.js";
import AuthorHighlight from "../apps/author-highlight.vue";

const WIKIWHO_API =
  "https://wikiwho.wmcloud.org/en/api/v1.0.0-beta/latest_rev_content/";
const MAX_AFFECTED_LOOKUPS = 5;
let active_affected_lookups = 0;

// returns { error:... } for excepted failures and throws for unexpected
export async function get_authorship_data(article, username) {
  const user_query = new URLSearchParams({
    action: "query",
    list: "users",
    ususers: username,
    format: "json",
    origin: "*",
  });
  const user_response = await fetch(`/w/api.php?${user_query}`);
  const user_data = await user_response.json();
  const userid = String(user_data.query.users[0]?.userid || "");
  if (!userid) return { error: `user "${username}" not found` };

  const wikiwho_query = new URLSearchParams({
    o_rev_id: false,
    editor: true,
    token_id: false,
    str: true,
    out: false,
    in: false,
  });
  const wikiwho_response = await fetch(
    `${WIKIWHO_API}${encodeURIComponent(article)}/?${wikiwho_query}`,
  );
  const wikiwho_data = await wikiwho_response.json();
  if (!wikiwho_data.success) return { error: "WikiWho API error" };

  const rev_obj = wikiwho_data.revisions[0];
  const rev_id = Object.keys(rev_obj)[0];
  const total_tokens = rev_obj[rev_id].tokens;
  const total_tokens_size = total_tokens.length;

  const user_tokens = total_tokens.filter((token) => token.editor === userid);
  const user_tokens_size = user_tokens.length;

  const user_tokens_percentage = user_tokens_size
    ? ((user_tokens_size / total_tokens_size) * 100).toFixed(1)
    : "0";

  const user_chars_size = user_tokens.reduce(
    (n, token) => n + token.str.length,
    0,
  );
  const total_chars_size = total_tokens.reduce(
    (n, token) => n + token.str.length,
    0,
  );

  return {
    userid,
    rev_id,
    total_tokens,
    total_tokens_size,

    user_tokens,
    user_tokens_size,
    user_tokens_percentage,

    user_chars_size,
    total_chars_size,
  };
}

export function init_check_affected() {
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
          // rm existing result
          $link.next("span.ainb-check-pct").remove();
          $link.hide().after($span);

          try {
            const username = await get_case_username();
            if (!username) {
              $span.remove();
              $link.show();
              return;
            }

            const data = await get_authorship_data(article, username);
            if (data.error) {
              $span.text(data.error);
              return;
            }

            $span
              .html(
                `<b>${data.user_tokens_percentage}%</b> (${data.user_tokens_size}/${data.total_tokens_size} tokens, ${data.user_chars_size} characters) of the current revision's content was authored by <b class="ww-ainb-uname"></b>` +
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
            if ($span.parent().length) $link.text("[recheck] ").show();
          }
        });

      const $highlight_link = $("<a>")
        .addClass("ainb-check-pct")
        .text("highlight")
        .on("click", async (e) => {
          e.preventDefault();
          const username = await get_case_username();
          if (!username) return;

          set_case_origin(article, wgPageName);
          create_app(AuthorHighlight, { article, username });
        });

      $notes.append(
        $("<div>")
          .addClass("ainb-check-pct-wrap")
          .append($link, $("<span>").text(" · "), $highlight_link),
      );
    });
}
