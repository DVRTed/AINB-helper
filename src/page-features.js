// for nicely formatted CSS, see [[User:DVRTed/AINB-helper.css]]
// BUILD:DEV
mw.loader.load(
  "http://localhost:1212/AINB-helper/dist/AINB-helper.css",
  "text/css",
);
// END:BUILD

// BUILD:PROD
mw.loader.load(
  "//en.wikipedia.org/w/index.php?title=User:DVRTed/AINB-helper.css&action=raw&ctype=text/css",
  "text/css",
);
// END:BUILD

// workaround to fix flash of unstyled content on progress bar
mw.util.addCSS(`
    .ainb-progress-wrap { margin-bottom: 1em; padding: 8px 12px; border: 1px solid var(--border-color-base, #a2a9b1); border-radius: 4px; }
    .ainb-progress-top { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
    .ainb-progress-percent { font-size: 1.8em; font-weight: 700; line-height: 1; color: var(--color-base, #202122); }
    .ainb-progress-top-text { display: flex; flex-direction: column; }
    .ainb-progress-title { font-weight: 600; font-size: 0.9em; }
    .ainb-progress-stats { font-size: 0.85em; color: var(--color-subtle, #54595d); }
    .ainb-progress-bar { display: flex; height: 8px; border-radius: 4px; overflow: hidden; background: #eaecf0; }
    .ainb-seg { height: 100%; }
    .ainb-progress-legend { display: flex; gap: 10px; margin-top: 6px; font-size: 0.8em; color: var(--color-subtle, #54595d); text-transform: capitalize; }
    .ainb-progress-legend i.ainb-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 3px; }
    .ainb-progress-credit { font-size: 0.75em; color: var(--color-subtle, #54595d); font-weight: normal; text-align: right; }
    .ainb-progress-hide-row { margin-top: 6px; font-size: 0.85em; }
    .ainb-hide-resolved .ainb-row-resolved { display: none; }
  `);

function init_row_editing() {
  $("table")
    .has('tr[class*="aic-row-"]')
    .each(function () {
      const $table = $(this);
      const $thead = $table.find("thead");
      $thead.find("tr").prepend('<th class="ainb-action-header">Action</th>');

      // batch edit button; populate array of { article, is_new } objects.
      const articles = $table
        .find('tr[class*="aic-row-"]')
        .map(function () {
          const $link = $(this).find("a").first();
          const title = $link.text().trim();
          if (!title) return null;
          return { article: title, is_new: $link.hasClass("new") };
        })
        .get()
        .filter(Boolean);

      if (articles.length) {
        const $button = $(
          '<button type="button" class="cdx-button cdx-button--action-progressive">',
        )
          .text("Batch edit")
          .on("click", (e) => {
            e.preventDefault();
            create_edit_table_app(articles);
          });
        $table.before($button);
      }

      // single-row edit buttons
      $table.find('tr[class*="aic-row-"]').each(function () {
        const $row = $(this);
        const $first_cell = $row.find("td").first();
        const $link = $first_cell.find("a").first();
        if (!$link.length) return;

        const $edit_td = $("<td>").addClass("ainb-action-cell");
        $first_cell.before($edit_td);

        const $edit_button = $("<button>")
          .addClass("ainb-edit-btn")
          .text("✎")
          .attr("title", "Edit this row")
          .on("click", (e) => {
            e.preventDefault();
            create_edit_table_app({
              article: $link.text().trim(),
              is_new: $link.hasClass("new"),
            });
          });

        $edit_td.append($edit_button);
      });
    });
}

function get_row_status($row) {
  const match = $row.attr("class")?.match(/\baic-row-(\S+)/);
  return match ? match[1] : "unknown";
}

function init_check_affected() {
  const wikiwho_API =
    "https://wikiwho.wmcloud.org/en/api/v1.0.0-beta/latest_rev_content/";
  const username = wgPageName
    .split("/")
    .pop()
    .replace(/_/g, " ")
    .replace(/^\d{4}-\d{2}-\d{2} /, "") // rm date prefix
    .replace(/ \(\d+\)$/, "") // rm (1), (2) etc from title
    .trim();

  let checking = false;

  $('tr[class*="aic-row-"]').each(function () {
    const $row = $(this);
    const article = $row.find("a").first().text();
    const $notes = $row.find("td").last();

    const $link = $("<a>")
      .addClass("ainb-check-pct")
      .attr("href", "#")
      .text("check affected % (beta)")
      .on("click", async function (e) {
        e.preventDefault();
        if (checking) return;
        checking = true;
        $("a.ainb-check-pct").addClass("ainb-disabled");

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
            await fetch(`${wikiwho_API}${encodeURIComponent(article)}/?${wq}`)
          ).json();
          if (!wdata.success) {
            $span.text("WikiWho API error");
            return;
          }

          const rev_obj = wdata.revisions[0];
          const tokens = rev_obj[Object.keys(rev_obj)[0]].tokens;
          const rel_user_tokens = tokens.filter(
            (t) => t.editor === userid,
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
            .text(username); // to prevent (impossible) xss through username
        } catch (err) {
          $span.text("lookup failed");
        } finally {
          checking = false;
          $("a.ainb-check-pct").removeClass("ainb-disabled");
        }
      });

    $notes.append($("<div>").addClass("ainb-check-pct-wrap").append($link));
  });
}

function init_progress_bar() {
  const STATUS_KEYS = [
    "completed",
    "unnecessary",
    "ongoing",
    "tagged",
    "todo",
    "unknown",
  ];

  $("table")
    .has('tr[class*="aic-row-"]')
    .each(function () {
      const $table = $(this);
      const stats = Object.fromEntries(STATUS_KEYS.map((k) => [k, 0]));

      const $rows = $table.find('tr[class*="aic-row-"]');

      $rows.each(function () {
        const status = get_row_status($(this));
        const key = status in stats ? status : "unknown";
        stats[key]++;
        if (key === "completed" || key === "unnecessary" || key === "tagged") {
          $(this).addClass("ainb-row-resolved");
        }
      });

      const total = Object.values(stats).reduce((a, b) => a + b, 0);
      if (!total) return;

      const resolved = stats.completed + stats.unnecessary + stats.tagged;
      const percent = Math.round((resolved / total) * 100);
      const active = STATUS_KEYS.filter((key) => stats[key] > 0);

      const segments = active
        .map((key) => {
          const width = (stats[key] / total) * 100;
          return `<div class="ainb-seg ainb-seg-${key}" style="width:${width}%" title="${stats[key]} ${key}"></div>`;
        })
        .join("");

      const legend = active
        .map(
          (key) =>
            `<span><i class="ainb-dot ainb-seg-${key}"></i>${key} (${stats[key]})</span>`,
        )
        .join("");

      const $bar = $(`
      <div class="ainb-progress-wrap">
        <div class="ainb-progress-top">
          <span class="ainb-progress-percent">${percent}%</span>
          <div class="ainb-progress-top-text">
            <div class="ainb-progress-title">Progress</div>
            <div class="ainb-progress-stats">${resolved} / ${total} resolved</div>
          </div>
        </div>
        <div class="ainb-progress-bar">${segments}</div>
        <div class="ainb-progress-legend">${legend}</div>
        <div class="ainb-progress-credit">Generated by <a href="${mw.util.getUrl(
          "User:DVRTed/AINB-helper",
        )}">AINB-helper</a></div>
        <div class="ainb-progress-hide-row">
          <label><input type="checkbox" class="ainb-hide-resolved-cb"> Hide resolved entries</label>
        </div>
      </div>
    `);

      $bar.find(".ainb-hide-resolved-cb").on("change", function () {
        $table.toggleClass("ainb-hide-resolved", $(this).is(":checked"));
      });

      $table.before($bar);
    });
}

const portlet_link = mw.util.addPortletLink(
  "p-tb",
  "#",
  "New AINB tracking",
  "t-ainb-tracking",
  "Generate tracking subpage for AINB",
);

$(portlet_link).on("click", function (e) {
  e.preventDefault();
  create_main_app();
});

const wgPageName = mw.config.get("wgPageName");

// if we're on an AINB tracking subpage, or the debug page,
// enable editing rows
if (
  wgPageName.startsWith("Wikipedia:AI_noticeboard/") ||
  wgPageName === DEBUG_PAGE
) {
  init_progress_bar();
  init_row_editing();
  init_check_affected();
}

if ([0, 118].includes(mw.config.get("wgNamespaceNumber")) || DEBUG_MODE) {
  const llm_portlet_link = mw.util.addPortletLink(
    "p-cactions",
    "#",
    "LLM tag/prod",
    "t-llm-tag-prod",
    "LLM tag/prod helper",
  );

  $(llm_portlet_link).on("click", function (e) {
    e.preventDefault();
    create_llm_tag_prod_app();
  });
}
