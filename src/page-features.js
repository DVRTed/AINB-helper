import {
  DEBUG_MODE,
  DEBUG_PAGE,
  create_app,
  get_case_username,
  set_case_origin,
} from "./shared.js";
import {
  apply_author_highlight_edit_text,
  init_check_affected,
  init_highlight_author,
} from "./page-actions/WikiWhoActions.js";
import CategoryStats from "./category-stats.vue";
import EditTable from "./edit-table.vue";
import EditBanner from "./edit-banner.vue";
import LlmTagProd from "./llm-tag-prod.vue";
import Main from "./main.vue";
import UpdateTable from "./rebuild-table.vue";
import styles from "./AINB-helper.css?inline";

mw.util.addCSS(styles);

function get_table_actions($table) {
  let $actions = $table.prev(".ainb-table-actions");
  if (!$actions.length) {
    $actions = $('<div class="ainb-table-actions">');
    $table.before($actions);
  }
  return $actions;
}

function init_row_editing() {
  $("table")
    .has('tr[class*="aic-row-"]')
    .not(".ainb-row-editing-done")
    .each(function () {
      const $table = $(this).addClass("ainb-row-editing-done");
      const $header_tr = $table.find("tr").has("th").first();
      $header_tr.prepend('<th class="ainb-action-header">Action</th>');

      // batch edit button; populate array of { article, is_new } objects.
      const articles = $table
        .find('tr[class*="aic-row-"]')
        .map(function () {
          const $link = $(this).find("a").first();
          const title = $link.text().trim();
          if (!title) return null;

          $link.on("click auxclick contextmenu", () =>
            set_case_origin(title, wgPageName),
          );

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
            create_app(EditTable, { articles_input: articles });
          });
        get_table_actions($table).append($button);
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
            create_app(EditTable, {
              articles_input: {
                article: $link.text().trim(),
                is_new: $link.hasClass("new"),
              },
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
    .not(".ainb-progress-done")
    .each(function () {
      $(this).addClass("ainb-progress-done");
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
function init_banner_edit() {
  if ($(".ainb-page-actions").length) return;
  const $banner = $(".ainb-b-top").first();
  const $case_button = $(
    '<button type="button" class="cdx-button cdx-button--action-progressive">',
  )
    .text("Edit case banner")
    .on("click", (e) => {
      e.preventDefault();
      create_app(EditBanner);
    });

  const $tracking_button = $('<button type="button" class="cdx-button">')
    .text("Add tracking table")
    .on("click", (e) => {
      e.preventDefault();
      create_app(Main, {
        initial_username: get_case_username(wgPageName),
      });
    });

  const $actions = $('<div class="ainb-page-actions">').append(
    $case_button,
    $tracking_button,
  );
  if ($banner.length) $banner.after($actions);
}

function init_infocard_updates() {
  const $items = $('.wiki-template-infocard, table:has(tr[class*="aic-row-"])');

  let infocard = null;
  let table_index = 0;

  $items.each((_, el) => {
    if (el.matches("table") && $(el).hasClass("ainb-infocard-update-done")) {
      table_index++;
      infocard = null;
      return;
    }
    if (el.matches(".wiki-template-infocard")) {
      // set the most recent infocard;
      // replacing cards that don't have a table after them.
      infocard = el;
      return; // goes back to the loop until we find table
    }

    const index = table_index++; // count unpaird tables in the index too
    if (!infocard) return;

    const text = $(infocard).text();
    const start_date =
      text.match(/Start date:\s*(\d{4}-\d{2}-\d{2})/i)?.[1] ?? "";
    const end_date = text.match(/End date:\s*(\d{4}-\d{2}-\d{2})/i)?.[1] ?? "";

    const $button = $(
      '<button type="button" class="cdx-button cdx-button--action-destructive">',
    )
      .text("Rebuild table")
      .on("click", (e) => {
        e.preventDefault();
        create_app(UpdateTable, {
          initial_username: get_case_username(wgPageName),
          initial_anchor_date: start_date,
          initial_end_date: end_date,
          target_page_title: wgPageName,
          target_table_index: index,
        });
      });

    $(el).addClass("ainb-infocard-update-done");
    get_table_actions($(el)).append($button);
    infocard = null;
  });
}

const wgPageName = mw.config.get("wgPageName");
const wgNamespaceNumber = mw.config.get("wgNamespaceNumber");
const wgAction = mw.config.get("wgAction");

export function init_page_features() {
  init_progress_bar();
  init_row_editing();
  init_check_affected();
  init_banner_edit();
  init_infocard_updates();
}

$(() => {
  apply_author_highlight_edit_text();

  if (
    wgPageName === "Category:AI_noticeboard_open_cleanup_cases" &&
    wgAction === "view"
  ) {
    const target = document.querySelector("#mw-content-text");
    if (target) {
      create_app(CategoryStats, { mount_target: target });
    }
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
    create_app(Main);
  });

  if (
    (wgPageName.startsWith("Wikipedia:AI_noticeboard/") ||
      wgPageName === DEBUG_PAGE) &&
    wgAction === "view"
  ) {
    init_page_features();
    mw.hook("wikipage.content").add(($content) => {
      if (!$content.is("#mw-content-text")) return;
      init_page_features();
    });
  }

  if ([0, 118].includes(wgNamespaceNumber) || DEBUG_MODE) {
    const llm_portlet_link = mw.util.addPortletLink(
      "p-cactions",
      "#",
      "LLM tag/prod",
      "t-llm-tag-prod",
      "LLM tag/prod helper",
    );

    $(llm_portlet_link).on("click", function (e) {
      e.preventDefault();
      create_app(LlmTagProd);
    });
  }

  if (wgNamespaceNumber === 0) init_highlight_author();
});
