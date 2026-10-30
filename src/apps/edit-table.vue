<script>
import {
  CdxButton,
  CdxDialog,
  CdxMessage,
  CdxProgressBar,
  CdxSelect,
  CdxTextArea,
  CdxTextInput,
} from "@wikimedia/codex";

import {
  APP_AD,
  api,
  close_app,
  create_app,
  get_article_row_regex,
  get_article_url,
  get_history_url,
  get_page_info,
  find_template_ranges,
  splice,
} from "../shared.js";
import { add_page_buttons } from "../register-actions.js";
import { build_article_row } from "./main-app.vue";
import NoteEditor from "./components/note_editor.vue";
import Table_indexer from "./components/table_indexer.vue";

export default {
  name: "EditRow",

  components: {
    CdxButton,
    CdxDialog,
    CdxMessage,
    CdxProgressBar,
    CdxSelect,
    CdxTextArea,
    CdxTextInput,
    NoteEditor,
  },

  props: {
    articles_input: {
      type: [Array, Object],
      required: true,
    },

    table_index: {
      default: null,
      type: Number,
      required: false,
    },
  },

  data() {
    return {
      // meta
      app_open: true,
      app_loading: false,
      app_error: "",

      status_options: [
        {
          value: "completed",
          label: "Completed",
          description: "Cleanup completed.",
          aliases: ["c"],
        },
        {
          value: "ongoing",
          label: "Ongoing",
          description:
            "Cleanup is ongoing, or the article is tagged with {{LLMprod}}.",
          aliases: ["o"],
        },
        {
          value: "unnecessary",
          label: "Unnecessary",
          description: "Cleanup is not necessary.",
          aliases: ["u", "unneeded"],
        },
        {
          value: "tagged",
          label: "Tagged",
          description: "The article is tagged with {{AI-generated}}.",
          aliases: ["tg", "tag"],
        },
        {
          value: "requested",
          label: "Requested/To-do",
          description: "Cleanup requested.",
          aliases: ["r", "td", "todo", "to do", "t"],
        },
      ],

      hide_resolved: false,

      rows: [],
      original_rows: [],
      selected: [],

      custom_summary: "",
      wikitext: "",
      basetimestamp: null,
      starttimestamp: null,
    };
  },

  computed: {
    is_single() {
      return this.articles.length === 1;
    },
    dialog_title() {
      return this.is_single ? "Editing row" : "Batch edit";
    },
    dialog_class() {
      return this.is_single ? "ainb-edit-table" : "ainb-batch-edit-table";
    },
    cross_table_error() {
      return (
        `This entry appears in multiple tables, and the correct table couldn't be identified; ` +
        `please [LINKTOTABLEINDEXER] to fix.`
      );
    },
    duplicate_index_error() {
      return (
        `This entry appears in multiple tables, ` +
        `and this table's index is duplicated; ` +
        `please [LINKTOTABLEINDEXER] to fix.`
      );
    },

    articles() {
      const seen = new Set();
      return [].concat(this.articles_input).filter(({ article }) => {
        if (seen.has(article)) return false;
        seen.add(article);
        return true;
      });
    },

    changed_rows_original_data() {
      const current_by_article = new Map(
        this.rows.map((row) => [row.article, row]),
      );
      return this.original_rows.filter((row) => {
        // locked rows are ignored
        if (row.row_error) return false;
        const current_row = current_by_article.get(row.article);
        if (!current_row) return false;
        return (
          row.status !== current_row.status ||
          (row.notes || "") !== (current_row.notes || "")
        );
      });
    },

    num_changed_rows() {
      return this.changed_rows_original_data.length;
    },

    can_save() {
      return !this.app_loading && this.num_changed_rows > 0;
    },

    has_red_links() {
      return this.rows.some(
        (row) =>
          !row.row_error &&
          row.is_new &&
          row.status !== "completed" &&
          row.status !== "unnecessary",
      );
    },

    filtered_rows() {
      if (!this.hide_resolved) return this.rows;
      return this.rows.filter(
        (row) =>
          row.status !== "completed" &&
          row.status !== "unnecessary" &&
          row.status !== "tagged",
      );
    },

    // for the "select" checkbox
    selected_set() {
      return new Set(this.selected);
    },
    selectable_rows() {
      // - the no-index-duplicated rows
      return this.filtered_rows.filter((row) => !row.row_error);
    },
    selected_rows() {
      // only count rows that are still visible and editable
      return this.selectable_rows.filter((row) =>
        this.selected_set.has(row.article),
      );
    },
    all_selected() {
      return (
        this.selectable_rows.length > 0 &&
        this.selected_rows.length === this.selectable_rows.length
      );
    },
  },

  mounted() {
    this.load_row_data();
  },

  methods: {
    get_article_url,
    get_history_url,
    close_app() {
      close_app();
    },
    open_table_indexer() {
      create_app(Table_indexer);
    },

    normalize_status(value) {
      const trimmed = value?.trim().toLowerCase() || "";
      const status = this.status_options.find(
        (option) =>
          option.value === trimmed || option.aliases?.includes(trimmed),
      );
      return status ? status.value : "requested";
    },

    // ranges of all {{AIC article list |index=X |...}} templates
    // whose index matches this.table_index
    get_index_table_ranges(wikitext) {
      const index = Number(this.table_index);

      if (this.table_index == null || Number.isNaN(index)) {
        return [];
      }

      return find_template_ranges(wikitext, "AIC article list").filter(
        ({ start, end }) => {
          const template = wikitext.slice(start, end);
          const match = /\|\s*index\s*=\s*([^|}]+)/i.exec(template);
          return Number(match?.[1].trim()) === index;
        },
      );
    },

    /*
locate an article's row(s).

-> single match on the page: ok
-> multiple matches, all inside one table {{AIC article list}}: ok

-> multiple matches across different tables:
  -> narrow down using the table's unique "index" param
    -> error if the index is missing or duplicated
    -> otherwise: ok

returns { range, matches, row_regex }
-> `range` is the { start, end } of the match

returns { error: str } on error
*/
    find_row_matches(wikitext, article) {
      const row_regex = get_article_row_regex(article, true);
      const page_matches = [...wikitext.matchAll(row_regex)];

      // single match
      if (page_matches.length <= 1) {
        return {
          range: { start: 0, end: wikitext.length },
          matches: page_matches,
          row_regex,
        };
      }

      // check if matches are inside the same table
      const tables = find_template_ranges(wikitext, "AIC article list");
      const table_ids = page_matches.map((match) => {
        // for each match, returns the index of the table it's inside
        // note it's not from the "index" param
        return tables.findIndex((table) => {
          return match.index >= table.start && match.index < table.end;
        });
      });

      const first_table_id = table_ids[0];
      const is_inside_a_table = first_table_id !== -1;
      const all_in_same_table = table_ids.every((id) => id === first_table_id);

      if (is_inside_a_table && all_in_same_table) {
        return {
          range: tables[first_table_id],
          matches: page_matches,
          row_regex,
        };
      }

      // matches are across tables,
      // use the "index" param
      const index_ranges = this.get_index_table_ranges(wikitext);
      if (index_ranges.length === 0) return { error: this.cross_table_error };
      if (index_ranges.length > 1) {
        return { error: this.duplicate_index_error };
      }

      const range = index_ranges[0];
      return {
        range,
        matches: [
          ...wikitext.slice(range.start, range.end).matchAll(row_regex),
        ],
        row_regex,
      };
    },

    async load_row_data() {
      this.app_loading = true;
      this.app_error = "";

      try {
        const page_name = mw.config.get("wgPageName");
        const page_info = await get_page_info(page_name);
        if (!page_info) throw new Error("Page not found");

        const wikitext = page_info.text;
        this.wikitext = wikitext;
        this.basetimestamp = page_info.timestamp;
        this.starttimestamp = page_info.starttimestamp;

        const loaded_rows = [];
        for (const { article, is_new } of this.articles) {
          const found = this.find_row_matches(wikitext, article);
          if (found.error) {
            if (this.is_single) {
              this.app_error = found.error;
              break;
            }
            // batch edit: keep the row, but lock it
            loaded_rows.push({
              article,
              status: "requested",
              notes: "",
              match_count: 0,
              is_new,
              row_error: found.error,
            });
            continue;
          }

          const { matches } = found;
          if (matches.length > 0) {
            // multiple matches (in the same table), show the first one
            const match = matches[0];
            loaded_rows.push({
              article,
              status: this.normalize_status(match[1]?.trim()),
              notes: match[2]?.trim() || "",
              match_count: matches.length,
              is_new,
            });
          }
        }

        if (this.app_error) return;

        if (loaded_rows.length === 0) {
          this.app_error = "Could not find row data";
        } else {
          this.rows = loaded_rows;
          this.original_rows = structuredClone(loaded_rows);
        }
      } catch (e) {
        this.app_error = "Error loading row data: " + e.message;
        console.error(e);
      } finally {
        this.app_loading = false;
      }
    },

    mark_all_deleted_as_completed() {
      for (const row of this.rows) {
        if (row.is_new && !row.row_error) {
          row.status = "completed";
        }
      }
    },

    async save_changes() {
      this.app_error = "";

      const page_name = mw.config.get("wgPageName");
      let new_wikitext = this.wikitext;

      const changed_articles = new Set(
        this.changed_rows_original_data.map((r) => r.article),
      );

      for (const row of this.rows) {
        if (!changed_articles.has(row.article)) continue;

        const found = this.find_row_matches(new_wikitext, row.article);
        if (found.error) {
          this.app_error = found.error;
          return;
        }

        const { range, row_regex } = found;
        const new_row = build_article_row(row.article, row.status, row.notes);
        const scope = new_wikitext.slice(range.start, range.end);

        new_wikitext = splice(
          new_wikitext,
          range,
          scope.replace(row_regex, () => new_row),
        );
      }

      // rm one or more ./,/; punctuation marks at the end
      const custom = this.custom_summary.trim().replace(/[.,;]+$/, "");
      const is_batch_edit = this.num_changed_rows > 1;

      let auto_summary = "";

      if (is_batch_edit) {
        auto_summary = `Batch edited ${this.num_changed_rows} rows`;

        // group and count new statuses
        const status_counts = this.changed_rows_original_data.reduce(
          (counts, before) => {
            const after = this.rows.find((r) => r.article === before.article);
            if (after.status !== before.status) {
              counts[after.status] = (counts[after.status] || 0) + 1;
            }
            return counts;
          },
          {},
        );

        const status_parts = Object.entries(status_counts).map(
          ([status, count]) => `${count} ${status}`,
        );
        if (status_parts.length) {
          // e.g., this would give
          // "Batch edited 10 rows: 5 completed, 5 ongoing"
          auto_summary += `: ${status_parts.join(", ")}`;
        } else {
          // "Batch edited 3 rows: only notes changed"
          auto_summary += `: only notes changed`;
        }
      } else {
        const before = this.changed_rows_original_data[0];
        const after = this.rows.find((r) => r.article === before.article);

        const status_changed = after.status !== before.status;
        const notes_changed = (after.notes || "") !== (before.notes || "");

        // e.g., this would be
        // if status is changed
        // "Updated status for [[TestArticle]] to completed"
        //
        // if status and notes changed
        // "Updated status for [[TestArticle]] to completed, notes changed"
        //
        // if only notes changed
        // "Updated notes for [[TestArticle]]"

        if (status_changed) {
          auto_summary = `Updated status for [[${after.article}]] to ${after.status}`;
        }

        if (notes_changed) {
          if (auto_summary) auto_summary += ", notes changed";
          else {
            auto_summary = `Updated notes for [[${after.article}]]`;
          }
        }
      }

      if (custom) {
        // if there's custom summary, lowercase the first letter
        auto_summary = auto_summary.replace(/^./, (c) => c.toLowerCase());
      }

      // e.g., "Custom note; updated status for [[TestArticle]] to completed"
      const summary = custom
        ? `${custom}; ${auto_summary} ${APP_AD}`
        : `${auto_summary} ${APP_AD}`;

      const article_names = this.changed_rows_original_data.map(
        (r) => r.article,
      );
      $('tr[class*="aic-row-"]')
        .filter(function () {
          return article_names.includes(
            $(this).find("a").first().text().trim(),
          );
        })
        .each(function () {
          const $cells = $(this).find("td");
          $(this).addClass("ainb-row-updating");
          $cells.eq(2).addClass("ainb-updating-cell ainb-updating-label");
          $cells.eq(3).addClass("ainb-updating-cell");
          $(this).find(".ainb-edit-btn").prop("disabled", true);
        });
      const before_unload = (event) => {
        event.preventDefault();
        event.returnValue = "";
      };
      window.addEventListener("beforeunload", before_unload);
      this.close_app();

      // save and refresh w/out full reload
      try {
        await api.postWithEditToken({
          action: "edit",
          title: page_name,
          text: new_wikitext,
          summary,
          basetimestamp: this.basetimestamp,
          starttimestamp: this.starttimestamp,
        });

        await this.refresh_page_content(page_name);
        mw.notify("Row(s) saved successfully.", { type: "success" });
      } catch (e) {
        mw.notify("Error saving changes: " + e.message, {
          type: "error",
          autoHide: false,
        });
        console.error(e);
      } finally {
        window.removeEventListener("beforeunload", before_unload);
      }
    },
    async refresh_page_content(page_name) {
      // could re-use this for banners too
      const result = await api.get({
        action: "parse",
        page: page_name,
        prop: "text",
      });
      const content = document.querySelector(
        "#mw-content-text .mw-parser-output",
      );
      if (content) {
        content.innerHTML = result.parse.text["*"];
        add_page_buttons();
      }
    },

    // for the select checkbox
    toggle_all(event) {
      this.selected = event.target.checked
        ? this.selectable_rows.map((row) => row.article)
        : [];
    },
    toggle_row(article, checked) {
      this.selected = checked
        ? [...this.selected, article]
        : this.selected.filter((a) => a !== article);
    },
    apply_bulk_status(event) {
      const status = event.target.value;
      if (!status) return;
      for (const row of this.selected_rows) row.status = status;

      event.target.value = "";
    },
  },
};
</script>

<template>
  <div>
    <cdx-dialog
      v-model:open="app_open"
      :class="dialog_class"
      :title="dialog_title"
      :use-close-button="true"
      @update:open="close_app"
    >
      <div v-if="app_loading" class="ainb-loading">
        <p>Loading row data...</p>
        <cdx-progress-bar inline />
      </div>

      <template v-else>
        <cdx-message v-if="app_error" type="warning">
          <template v-if="app_error.includes('[LINKTOTABLEINDEXER]')">
            {{ app_error.split("[LINKTOTABLEINDEXER]")[0] }}
            <a href="#" @click.prevent="open_table_indexer"> reindex tables </a>
            {{ app_error.split("[LINKTOTABLEINDEXER]")[1] }}
          </template>
          <template v-else>{{ app_error }}</template>
        </cdx-message>

        <div v-else-if="is_single && rows.length === 1" class="ainb-edit-step">
          <cdx-message
            v-if="rows[0].match_count > 1"
            type="notice"
            class="ainb-form-field"
          >
            There are {{ rows[0].match_count }} entries for this article in this
            table. Updating this will update all of them.
          </cdx-message>

          <div class="ainb-form-field">
            Article:
            <strong>
              <a
                :href="get_article_url(rows[0].article)"
                :class="{ new: rows[0].is_new }"
                rel="mw:WikiLink"
                target="_blank"
              >
                {{ rows[0].article }}
              </a>
            </strong>
            <a
              :href="get_history_url(rows[0].article)"
              class="ainb-history-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              (hist)
            </a>
          </div>

          <div class="ainb-form-field">
            <div class="ainb-form-label">Status:</div>
            <div>
              <cdx-select
                v-model:selected="rows[0].status"
                :menu-items="status_options"
                class="ainb-edit-table-status-select"
              />
            </div>
          </div>

          <div class="ainb-form-field">
            <div class="ainb-form-label">Notes:</div>
            <cdx-text-area v-model="rows[0].notes" rows="4" />
          </div>
        </div>

        <div v-else>
          <div class="ainb-table-actions">
            <span>
              <label class="ainb-hide-resolved-label">
                <input v-model="hide_resolved" type="checkbox" />
                Hide resolved entries
              </label>
              <span v-if="num_changed_rows">
                &middot; {{ num_changed_rows }}
                {{ num_changed_rows > 1 ? "entries" : "entry" }} modified</span>
            </span>
            <cdx-button
              v-if="has_red_links"
              @click="mark_all_deleted_as_completed"
            >
              Mark all deleted articles as completed
            </cdx-button>
          </div>

          <div class="ainb-batch-edit-table-scroll">
            <table class="ainb-batch-edit-table-grid">
              <colgroup>
                <col class="ainb-col-check" />
                <col class="ainb-col-article" />
                <col class="ainb-col-status" />
                <col />
              </colgroup>
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      :checked="all_selected"
                      :disabled="!selectable_rows.length"
                      @change="toggle_all"
                    />
                  </th>
                  <th>Article</th>
                  <th>Status</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in filtered_rows"
                  :key="row.article"
                  v-memo="[
                    row.status,
                    row.notes,
                    row.row_error,
                    row.match_count,
                    row.is_new,
                    selected_set.has(row.article),
                  ]"
                >
                  <td>
                    <input
                      type="checkbox"
                      :checked="selected_set.has(row.article)"
                      :disabled="!!row.row_error"
                      @change="toggle_row(row.article, $event.target.checked)"
                    />
                  </td>
                  <td>
                    <a
                      :href="get_article_url(row.article)"
                      :class="['ainb-article-link', { new: row.is_new }]"
                      :title="row.article"
                      rel="mw:WikiLink"
                      target="_blank"
                    >
                      {{ row.article }}
                    </a>
                    <a
                      :href="get_history_url(row.article)"
                      class="ainb-history-link"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      (hist)
                    </a>
                    <cdx-message
                      v-if="row.match_count > 1"
                      type="warning"
                      inline
                    >
                      {{ row.match_count }} entries in this table; all will be
                      updated.
                    </cdx-message>
                    <cdx-message v-if="row.row_error" type="warning" inline>
                      Appears in multiple tables, so it can't be edited here.
                      <a href="#" @click.prevent="open_table_indexer">Reindex tables</a>
                      to fix.
                    </cdx-message>
                  </td>
                  <td>
                    <select
                      v-model="row.status"
                      class="ainb-batch-status-select"
                      :disabled="!!row.row_error"
                    >
                      <option
                        v-for="option in status_options"
                        :key="option.value"
                        :value="option.value"
                        :title="option.description"
                      >
                        {{ option.label }}
                      </option>
                    </select>
                  </td>
                  <td>
                    <note-editor
                      v-model="row.notes"
                      :disabled="!!row.row_error"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>

      <template #footer>
        <div v-if="selected_rows.length" class="ainb-bulk-bar">
          <strong>{{ selected_rows.length }} selected.</strong> Set status to:
          <select class="ainb-batch-status-select" @change="apply_bulk_status">
            <option value="" selected disabled>Choose…</option>
            <option
              v-for="option in status_options"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </div>

        <div class="ainb-dialog-footer">
          <div v-if="rows.length >= 1" class="ainb-dialog-edit-summary">
            <cdx-text-input
              id="ainb_custom_summary"
              v-model="custom_summary"
              name="ainb_custom_summary"
              placeholder="Edit summary (optional)"
              maxlength="200"
              aria-label="Custom edit summary"
            ></cdx-text-input>
          </div>
          <div>
            <cdx-button @click="close_app">Cancel</cdx-button>
            <cdx-button
              :disabled="!can_save"
              action="progressive"
              weight="primary"
              @click="save_changes"
            >
              Save
            </cdx-button>
          </div>
        </div>
      </template>
    </cdx-dialog>
  </div>
</template>

<style>
@import "../stylesheets/edit-table.css";
</style>
