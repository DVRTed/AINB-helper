import {
  create_app,
  get_case_page_name,
  get_case_username,
  set_case_origin,
} from "../shared.js";
import EditTable from "../apps/edit-table.vue";
import UpdateTable from "../apps/rebuild-table.vue";

const wgPageName = mw.config.get("wgPageName");
const saved_filters = {};

export function get_table_actions($table) {
  let $actions = $table.prev(".ainb-table-actions");
  if (!$actions.length) {
    $actions = $('<div class="ainb-table-actions">');
    $table.before($actions);
  }
  return $actions;
}

export function init_row_editing() {
  $(".ainb-cleanup-table")
    .has('tr[class*="aic-row-"]')
    .not(".ainb-row-editing-done")
    .each(function () {
      const $table = $(this).addClass("ainb-row-editing-done");
      const table_index = $($table).data("table-index");
      const $header_tr = $table.find("tr").has("th").first();
      $header_tr.prepend('<th class="ainb-action-header">Action</th>');

      // elements in the row to trigger set_case_origin
      const origin_trigger_selector = [
        "a:first",
        'a[href*="Special:Diff"]',
        'a[href*="Special:History"]',
        'a[href*="diff="]',
        'a[href*="oldid="]',
      ].join(", ");

      // populate array of { article, is_new } objects.
      const articles = $table
        .find('tr[class*="aic-row-"]')
        .map(function () {
          const $row = $(this);
          const $link = $row.find("a").first();
          const title = $link.text().trim();
          if (!title) return null;

          $row.on("click auxclick contextmenu", origin_trigger_selector, () =>
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
            create_app(EditTable, { table_index, articles_input: articles });
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
              table_index,
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

export function get_row_status($row) {
  const match = $row.attr("class")?.match(/\baic-row-(\S+)/);
  return match ? match[1] : "unknown";
}

export function init_progress_bar() {
  const STATUS_KEYS = [
    "completed",
    "unnecessary",
    "ongoing",
    "tagged",
    "todo",
    "unknown",
  ];

  $(".ainb-cleanup-table")
    .not(".ainb-progress-done")
    .each(function () {
      $(this).addClass("ainb-progress-done");
      const $table = $(this);
      const stats = Object.fromEntries(STATUS_KEYS.map((k) => [k, 0]));
      let created_count = 0;

      const $rows = $table.find('tr[class*="aic-row-"]');

      $rows.each(function () {
        const $row = $(this);
        const status = get_row_status($row);
        const key = status in stats ? status : "unknown";
        stats[key]++;
        $row.addClass("ainb-row");
        if (key === "completed" || key === "unnecessary" || key === "tagged") {
          $row.addClass("ainb-row-resolved");
        }
        // matches "(page created)" in notes, so obv can be wrong if it's been modified
        if ($row.text().includes("(page created)")) {
          $row.addClass("ainb-row-created");
          created_count++;
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
        .map((key) => {
          return `<span><i class="ainb-dot ainb-seg-${key}"></i>${key} (${stats[key]})</span>`;
        })
        .join("");

      const resolved_filter = resolved
        ? `<label><input type="checkbox" class="ainb-hide-resolved-cb"> Hide resolved entries (<b>${resolved}</b>)</label>`
        : "";

      const created_filter = created_count
        ? `<label title='Matches rows whose note contains "(page created)".'>
            <input type="checkbox" class="ainb-hide-non-creation-cb"> Show only page creations (<b>${created_count}</b>)
          </label>`
        : "";

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
        <div class="ainb-table-filters">
          ${resolved_filter}
          ${created_filter}
        </div>
      </div>
    `);

      $bar.find(".ainb-hide-resolved-cb").on("change", function () {
        $table.toggleClass("ainb-hide-resolved", $(this).is(":checked"));
      });

      $bar.find(".ainb-hide-non-creation-cb").on("change", function () {
        $table.toggleClass("ainb-only-created", $(this).is(":checked"));
      });

      const table_key = $(".ainb-cleanup-table").index($table);
      $bar
        .find("input")
        .each(function () {
          $(this)
            .prop("checked", !!saved_filters[table_key + this.className])
            .trigger("change");
        })
        .on("change", function () {
          saved_filters[table_key + this.className] = this.checked;
        });

      $table.before($bar);
    });
}

export function init_infocard_updates() {
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
      .on("click", async (e) => {
        e.preventDefault();

        const initial_username = await get_case_username();
        if (!initial_username) return;
        const initial_case_page = get_case_page_name(wgPageName);
        const initial_is_custom_case_page =
          initial_case_page !== initial_username;

        create_app(UpdateTable, {
          initial_username,
          initial_case_page,
          initial_is_custom_case_page,

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
